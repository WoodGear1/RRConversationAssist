import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentWorkspaceId } from '@/lib/workspace';
import { getAllowedRanges, isRangeAllowed } from '@/lib/acl';
import pool from '@/lib/db';
import { apiRateLimit } from '@/middleware/rate-limit';

export async function GET(request: NextRequest) {
  // Apply rate limiting
  const rateLimitResponse = await apiRateLimit(request);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });
  }

  try {
    const workspaceId = await getCurrentWorkspaceId();

    if (!workspaceId) {
      return NextResponse.json(
        { error: 'Workspace не выбран' },
        { status: 400 }
      );
    }

    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    if (!query || query.trim().length === 0) {
      return NextResponse.json(
        { error: 'Запрос обязателен' },
        { status: 400 }
      );
    }

    // Get user's Discord ID for ACL
    const discordResult = await pool.query(
      'SELECT discord_user_id FROM user_discord_links WHERE user_id = $1',
      [session.user.id]
    );

    const discordUserId =
      discordResult.rows.length > 0
        ? discordResult.rows[0].discord_user_id
        : null;

    const isAdmin = session.user.role === 'admin';

    // Get embedding for query
    const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: query,
      }),
    });

    if (!embeddingResponse.ok) {
      throw new Error('Failed to get embedding');
    }

    const embeddingResult = await embeddingResponse.json();
    const queryEmbedding = embeddingResult.data[0].embedding;

    // Prepare query for tsquery (escape special characters and join with &)
    const escapedQuery = query
      .split(/\s+/)
      .map((word) => word.replace(/[^\wа-яё]/gi, ''))
      .filter((word) => word.length > 0)
      .join(' & ');

    // Hybrid search: combine semantic (pgvector) and full-text (tsvector) search
    // Use RRF (Reciprocal Rank Fusion) for combining results
    const hybridQuery = `
      WITH semantic_results AS (
        SELECT sc.id, sc.recording_id, sc.start_ms, sc.end_ms, sc.text,
               1 - (sc.embedding <-> $1::vector) as semantic_score,
               ROW_NUMBER() OVER (ORDER BY sc.embedding <-> $1::vector) as semantic_rank
        FROM search_chunks sc
        INNER JOIN recordings r ON r.id = sc.recording_id
        WHERE r.workspace_id = $3
          AND sc.embedding IS NOT NULL
        ORDER BY sc.embedding <-> $1::vector
        LIMIT $4
      ),
      fulltext_results AS (
        SELECT sc.id, sc.recording_id, sc.start_ms, sc.end_ms, sc.text,
               ts_rank(sc.text_vector, to_tsquery('russian', $2)) as lexical_score,
               ROW_NUMBER() OVER (ORDER BY ts_rank(sc.text_vector, to_tsquery('russian', $2)) DESC) as lexical_rank
        FROM search_chunks sc
        INNER JOIN recordings r ON r.id = sc.recording_id
        WHERE r.workspace_id = $3
          AND sc.text_vector @@ to_tsquery('russian', $2)
        ORDER BY lexical_score DESC
        LIMIT $4
      ),
      combined_results AS (
        SELECT 
          COALESCE(s.recording_id, f.recording_id) as recording_id,
          COALESCE(s.start_ms, f.start_ms) as start_ms,
          COALESCE(s.end_ms, f.end_ms) as end_ms,
          COALESCE(s.text, f.text) as text,
          COALESCE(s.semantic_score, 0) as semantic_score,
          COALESCE(f.lexical_score, 0) as lexical_score,
          COALESCE(1.0 / (60 + s.semantic_rank), 0) as semantic_rrf,
          COALESCE(1.0 / (60 + f.lexical_rank), 0) as lexical_rrf,
          (COALESCE(1.0 / (60 + s.semantic_rank), 0) + COALESCE(1.0 / (60 + f.lexical_rank), 0)) as combined_score
        FROM semantic_results s
        FULL OUTER JOIN fulltext_results f ON s.id = f.id
      )
      SELECT recording_id, start_ms, end_ms, text, combined_score
      FROM combined_results
      WHERE combined_score > 0
      ORDER BY combined_score DESC
      LIMIT $4
    `;

    const searchResult = await pool.query(hybridQuery, [
      JSON.stringify(queryEmbedding),
      escapedQuery || ':*', // Fallback to match all if query is empty after escaping
      workspaceId,
      limit * 2, // Get more to filter by ACL
    ]);

    // Filter by ACL
    const results = [];

    for (const chunk of searchResult.rows) {
      if (isAdmin) {
        results.push({
          recording_id: chunk.recording_id,
          start_ms: chunk.start_ms,
          end_ms: chunk.end_ms,
          snippet: chunk.text.substring(0, 200),
          score: chunk.combined_score,
        });
        continue;
      }

      if (!discordUserId) {
        continue;
      }

      // Get allowed ranges for this recording
      const allowedRanges = await getAllowedRanges(
        chunk.recording_id,
        session.user.id
      );

      if (
        allowedRanges.length > 0 &&
        isRangeAllowed(chunk.start_ms, chunk.end_ms, allowedRanges)
      ) {
        results.push({
          recording_id: chunk.recording_id,
          start_ms: chunk.start_ms,
          end_ms: chunk.end_ms,
          snippet: chunk.text.substring(0, 200),
          score: chunk.combined_score,
        });
      }

      if (results.length >= limit) {
        break;
      }
    }

    // Add links
    const resultsWithLinks = results.map((result) => ({
      ...result,
      link: `/recordings/${result.recording_id}?time=${result.start_ms}`,
      play_url: `/api/media/${result.recording_id}?start_ms=${result.start_ms}&end_ms=${result.end_ms}`,
    }));

    return NextResponse.json({
      results: resultsWithLinks,
      total: resultsWithLinks.length,
    });
  } catch (error) {
    console.error('Error searching:', error);
    return NextResponse.json(
      { error: 'Ошибка при поиске' },
      { status: 500 }
    );
  }
}
