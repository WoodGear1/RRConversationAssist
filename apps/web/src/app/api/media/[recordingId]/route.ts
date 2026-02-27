import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import { NextResponse } from 'next/server';
import { getMediaUrl } from '@/lib/media';

export async function GET(
  request: Request,
  { params }: { params: { recordingId: string } }
) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const startMs = searchParams.get('start_ms')
      ? parseInt(searchParams.get('start_ms')!, 10)
      : undefined;
    const endMs = searchParams.get('end_ms')
      ? parseInt(searchParams.get('end_ms')!, 10)
      : undefined;
    const trackType = (searchParams.get('track_type') || 'user') as 'user' | 'mixed';
    const discordUserId = searchParams.get('discord_user_id') || undefined;
    const ttl = searchParams.get('ttl')
      ? parseInt(searchParams.get('ttl')!, 10)
      : undefined;

    // Use centralized getMediaUrl function
    const result = await getMediaUrl(session.user.id, {
      recordingId: params.recordingId,
      trackType,
      discordUserId,
      startMs,
      endMs,
      ttl,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error getting media URL:', error);
    if (error.message === 'Нет доступа к записи') {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (error.message === 'Запрашиваемый диапазон недоступен') {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (error.message === 'Аудио-трек не найден') {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    return NextResponse.json(
      { error: 'Ошибка при получении медиа URL' },
      { status: 500 }
    );
  }
}
