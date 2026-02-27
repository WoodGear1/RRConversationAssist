import { getServerSession } from 'next-auth';
import { authOptions } from '../../../auth/[...nextauth]/route';
import { NextRequest, NextResponse } from 'next/server';
import { getAllowedRanges, isRangeAllowed } from '@/lib/acl';
import { s3Client, config } from '@/lib/s3';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import pool from '@/lib/db';

/**
 * Media proxy endpoint with Range support and ACL enforcement
 * Proxies requests to S3 while enforcing ACL and allowed_ranges
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { recordingId: string } }
) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const trackType = searchParams.get('track_type') || 'user';
    const discordUserId = searchParams.get('discord_user_id');
    const rangeHeader = request.headers.get('range');

    // Get allowed ranges
    const allowedRanges = await getAllowedRanges(params.recordingId, session.user.id);

    if (allowedRanges.length === 0) {
      return NextResponse.json(
        { error: 'Нет доступа к записи' },
        { status: 403 }
      );
    }

    // Get audio track
    let trackQuery =
      'SELECT object_key, file_size_bytes FROM audio_tracks WHERE recording_id = $1 AND track_type = $2';
    const trackParams: any[] = [params.recordingId, trackType];

    if (trackType === 'user' && discordUserId) {
      trackQuery += ' AND discord_user_id = $3';
      trackParams.push(discordUserId);
    }

    const trackResult = await pool.query(trackQuery, trackParams);

    if (trackResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'Аудио-трек не найден' },
        { status: 404 }
      );
    }

    const { object_key, file_size_bytes } = trackResult.rows[0];
    const fileSize = file_size_bytes || 0;

    // Parse Range header if present
    let startByte = 0;
    let endByte = fileSize - 1;

    if (rangeHeader) {
      const rangeMatch = rangeHeader.match(/bytes=(\d+)-(\d*)/);
      if (rangeMatch) {
        startByte = parseInt(rangeMatch[1], 10);
        endByte = rangeMatch[2] ? parseInt(rangeMatch[2], 10) : fileSize - 1;
      }
    }

    // Convert byte range to time range (approximate, assuming constant bitrate)
    // For accurate conversion, we'd need audio metadata, but for ACL we'll be conservative
    // Get recording duration
    const recordingResult = await pool.query(
      'SELECT duration_ms FROM recordings WHERE id = $1',
      [params.recordingId]
    );

    if (recordingResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'Запись не найдена' },
        { status: 404 }
      );
    }

    const durationMs = recordingResult.rows[0].duration_ms || 0;

    // Approximate time range from byte range
    // This is a rough estimate - for production, use actual audio metadata
    const startMs = durationMs > 0 ? Math.floor((startByte / fileSize) * durationMs) : 0;
    const endMs = durationMs > 0 ? Math.floor((endByte / fileSize) * durationMs) : durationMs;

    // Check if requested range is allowed
    if (!isRangeAllowed(startMs, endMs, allowedRanges)) {
      return NextResponse.json(
        { error: 'Запрашиваемый диапазон недоступен' },
        { status: 403 }
      );
    }

    // Build S3 GetObject command with Range if specified
    const command = new GetObjectCommand({
      Bucket: config.bucket,
      Key: object_key,
      Range: rangeHeader || undefined,
    });

    // Get object from S3
    const response = await s3Client.send(command);

    if (!response.Body) {
      return NextResponse.json(
        { error: 'Ошибка при получении медиа' },
        { status: 500 }
      );
    }

    // Convert stream to buffer
    // Note: For large files, consider streaming directly to response
    const chunks: Uint8Array[] = [];
    
    // Handle different Body types
    if ('transformToWebStream' in response.Body) {
      const reader = response.Body.transformToWebStream().getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }
    } else if (response.Body instanceof ReadableStream) {
      const reader = response.Body.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }
    } else {
      // Fallback: assume it's a stream-like object
      const stream = response.Body as any;
      for await (const chunk of stream) {
        chunks.push(chunk);
      }
    }

    const buffer = Buffer.concat(chunks);

    // Build response headers
    const headers = new Headers();
    headers.set('Content-Type', response.ContentType || 'audio/opus');
    headers.set('Content-Length', buffer.length.toString());
    headers.set('Accept-Ranges', 'bytes');

    if (rangeHeader) {
      headers.set('Content-Range', `bytes ${startByte}-${endByte}/${fileSize}`);
      headers.set('Content-Length', (endByte - startByte + 1).toString());
      return new NextResponse(buffer, {
        status: 206, // Partial Content
        headers,
      });
    }

    return new NextResponse(buffer, {
      status: 200,
      headers,
    });
  } catch (error) {
    console.error('Error proxying media:', error);
    return NextResponse.json(
      { error: 'Ошибка при получении медиа' },
      { status: 500 }
    );
  }
}
