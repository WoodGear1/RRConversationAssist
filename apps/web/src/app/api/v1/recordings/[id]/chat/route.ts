import { getServerSession } from 'next-auth';
import { authOptions } from '../../../../auth/[...nextauth]/route';
import { NextResponse } from 'next/server';
import { getAllowedRanges, filterSegmentsByRanges } from '@/lib/acl';
import { config } from '@/lib/s3';
import pool from '@/lib/db';

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });
  }

  try {
    // Get allowed ranges
    const allowedRanges = await getAllowedRanges(params.id, session.user.id);

    if (allowedRanges.length === 0) {
      return NextResponse.json(
        { error: 'Нет доступа к записи' },
        { status: 403 }
      );
    }

    const { question, history = [] } = await request.json();

    if (!question || typeof question !== 'string') {
      return NextResponse.json(
        { error: 'question обязателен' },
        { status: 400 }
      );
    }

    // Get transcript
    const transcriptResult = await pool.query(
      `SELECT ts.id, ts.version
       FROM transcripts ts
       WHERE ts.recording_id = $1 AND ts.is_official = true
       ORDER BY ts.version DESC LIMIT 1`,
      [params.id]
    );

    if (transcriptResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'Транскрипт не найден' },
        { status: 404 }
      );
    }

    const transcriptId = transcriptResult.rows[0].id;

    // Get segments (filtered by ACL)
    const segmentsResult = await pool.query(
      `SELECT start_ms, end_ms, text, discord_user_id
       FROM transcript_segments
       WHERE transcript_id = $1
       ORDER BY start_ms`,
      [transcriptId]
    );

    const filteredSegments = filterSegmentsByRanges(
      segmentsResult.rows,
      allowedRanges
    );

    // Get embedding for question
    const questionEmbeddingResponse = await fetch(
      'https://api.openai.com/v1/embeddings',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'text-embedding-3-small',
          input: question,
        }),
      }
    );

    if (!questionEmbeddingResponse.ok) {
      throw new Error('Failed to get embedding');
    }

    const questionEmbeddingResult = await questionEmbeddingResponse.json();
    const questionEmbedding = questionEmbeddingResult.data[0].embedding;

    // Search relevant chunks
    const searchResult = await pool.query(
      `SELECT start_ms, end_ms, text,
             1 - (embedding <-> $1::vector) as similarity
       FROM search_chunks
       WHERE recording_id = $2
       ORDER BY embedding <-> $1::vector
       LIMIT 5`,
      [JSON.stringify(questionEmbedding), params.id]
    );

    // Filter by ACL
    const relevantChunks = searchResult.rows.filter((chunk) =>
      allowedRanges.some(
        (range) => chunk.start_ms < range.end_ms && chunk.end_ms > range.start_ms
      )
    );

    // Build context from chunks
    const context = relevantChunks
      .map((chunk) => `[${chunk.start_ms}ms-${chunk.end_ms}ms] ${chunk.text}`)
      .join('\n\n');

    // Call LLM
    const llmResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content:
              'Ты помощник для анализа записей. Отвечай на вопросы на основе предоставленного контекста. Указывай таймкоды в формате [start_ms-end_ms] для цитат.',
          },
          ...history.slice(-10), // Last 10 messages
          {
            role: 'user',
            content: `Контекст из записи:\n\n${context}\n\nВопрос: ${question}`,
          },
        ],
      }),
    });

    if (!llmResponse.ok) {
      const error = await llmResponse.text();
      throw new Error(`OpenAI API error: ${error}`);
    }

    const llmResult = await llmResponse.json();
    const answer = llmResult.choices[0].message.content;

    // Extract citations (simple regex for [start_ms-end_ms])
    const citationRegex = /\[(\d+)ms-(\d+)ms\]/g;
    const citations: Array<{ start_ms: number; end_ms: number; text: string }> =
      [];
    let match;

    while ((match = citationRegex.exec(answer)) !== null) {
      const startMs = parseInt(match[1], 10);
      const endMs = parseInt(match[2], 10);

      // Find segment text
      const segment = filteredSegments.find(
        (s) => s.start_ms <= startMs && s.end_ms >= endMs
      );

      if (segment) {
        citations.push({
          start_ms: startMs,
          end_ms: endMs,
          text: segment.text,
        });
      }
    }

    return NextResponse.json({
      answer,
      citations,
    });
  } catch (error) {
    console.error('Error in chat:', error);
    return NextResponse.json(
      { error: 'Ошибка при обработке вопроса' },
      { status: 500 }
    );
  }
}
