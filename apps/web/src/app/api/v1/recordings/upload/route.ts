import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import { NextResponse } from 'next/server';
import { getCurrentWorkspaceId } from '@/lib/workspace';
import { uploadToS3 } from '@/lib/s3';
import pool from '@/lib/db';
import { Queue } from 'bullmq';
import Redis from 'ioredis';
import { updateRecordingStatus } from '@rrconversationassist/db';

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
const vadQueue = new Queue('vad', { connection: redis });

export async function POST(request: Request) {
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

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const title = formData.get('title') as string;
    const projectId = formData.get('project_id') as string | null;
    const tagIds = JSON.parse((formData.get('tag_ids') as string) || '[]');
    const participants = JSON.parse(
      (formData.get('participants') as string) || '[]'
    );

    if (!file) {
      return NextResponse.json(
        { error: 'Файл обязателен' },
        { status: 400 }
      );
    }

    // Validate file type
    const allowedTypes = [
      'audio/mpeg',
      'audio/mp3',
      'audio/wav',
      'audio/x-m4a',
      'audio/ogg',
      'audio/opus',
    ];

    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Неподдерживаемый формат файла' },
        { status: 400 }
      );
    }

    // Check file size (500 MB limit)
    const MAX_SIZE = 500 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: 'Файл слишком большой (максимум 500 MB)' },
        { status: 400 }
      );
    }

    // Read file
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Create recording
    const recordingResult = await pool.query(
      `INSERT INTO recordings (
        workspace_id, initiator_user_id, source, status, started_at, title
      ) VALUES ($1, $2, 'upload', 'uploaded', CURRENT_TIMESTAMP, $3)
      RETURNING id`,
      [workspaceId, session.user.id, title || file.name]
    );

    const recordingId = recordingResult.rows[0].id;

    // Upload to S3
    const objectKey = `recordings/${recordingId}/upload/${file.name}`;
    await uploadToS3(objectKey, buffer, file.type);

    // Save audio track
    await pool.query(
      `INSERT INTO audio_tracks (
        recording_id, track_type, object_key, file_size_bytes
      ) VALUES ($1, 'mixed', $2, $3)`,
      [recordingId, objectKey, file.size]
    );

    // Update status to audio_ready using state machine
    await updateRecordingStatus(pool, recordingId, 'audio_ready');

    // Add participants if provided
    for (const participant of participants) {
      if (participant.discord_user_id) {
        await pool.query(
          `INSERT INTO recording_participants (
            recording_id, discord_user_id, display_name, avatar_url
          ) VALUES ($1, $2, $3, $4)
          ON CONFLICT DO NOTHING`,
          [
            recordingId,
            participant.discord_user_id,
            participant.display_name || null,
            participant.avatar_url || null,
          ]
        );
      }
    }

    // Set project if provided
    if (projectId) {
      await pool.query(
        `INSERT INTO recording_project (recording_id, project_id)
         VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        [recordingId, projectId]
      );
    }

    // Add tags
    for (const tagId of tagIds) {
      await pool.query(
        `INSERT INTO recording_tags (recording_id, tag_id)
         VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        [recordingId, tagId]
      );
    }

    // Trigger processing pipeline
    await vadQueue.add('vad', { recordingId });

    return NextResponse.json({ recording_id: recordingId });
  } catch (error) {
    console.error('Error uploading recording:', error);
    return NextResponse.json(
      { error: 'Ошибка при загрузке записи' },
      { status: 500 }
    );
  }
}
