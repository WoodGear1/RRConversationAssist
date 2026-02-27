import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import { NextResponse } from 'next/server';
import { getAllowedRanges } from '@/lib/acl';
import pool from '@/lib/db';
import { randomBytes } from 'crypto';

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });
  }

  try {
    const {
      recording_id,
      allowed_ranges_override,
      expires_in_hours,
      mode,
      with_comments,
    } = await request.json();

    if (!recording_id) {
      return NextResponse.json(
        { error: 'recording_id обязателен' },
        { status: 400 }
      );
    }

    // Check access to recording
    const allowedRanges = await getAllowedRanges(recording_id, session.user.id);

    if (allowedRanges.length === 0) {
      return NextResponse.json(
        { error: 'Нет доступа к записи' },
        { status: 403 }
      );
    }

    // Generate share ID
    const shareId = randomBytes(16).toString('hex');

    // Calculate expires_at
    const expiresAt = expires_in_hours
      ? new Date(Date.now() + expires_in_hours * 60 * 60 * 1000)
      : null;

    const result = await pool.query(
      `INSERT INTO shares (
        recording_id, share_id, allowed_ranges_override, expires_at, mode, with_comments, created_by
      ) VALUES ($1, $2, $3::jsonb, $4, $5, $6, $7)
      RETURNING id, share_id, expires_at, mode, created_at`,
      [
        recording_id,
        shareId,
        allowed_ranges_override ? JSON.stringify(allowed_ranges_override) : null,
        expiresAt,
        mode || 'anyone',
        with_comments || false,
        session.user.id,
      ]
    );

    return NextResponse.json({
      share_id: shareId,
      url: `/s/${shareId}`,
      expires_at: expiresAt,
    });
  } catch (error) {
    console.error('Error creating share:', error);
    return NextResponse.json(
      { error: 'Ошибка при создании шары' },
      { status: 500 }
    );
  }
}
