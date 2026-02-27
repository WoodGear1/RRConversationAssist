import { getServerSession } from 'next-auth';
import { authOptions } from '../../../auth/[...nextauth]/route';
import { NextResponse } from 'next/server';

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });
  }

  try {
    // Call bot API to stop recording
    const botResponse = await fetch(`http://bot:3001/api/recordings/${params.id}`, {
      method: 'POST',
    });

    if (!botResponse.ok) {
      const error = await botResponse.json();
      return NextResponse.json(
        { error: error.error || 'Ошибка при остановке записи' },
        { status: botResponse.status }
      );
    }

    const data = await botResponse.json();

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error stopping recording:', error);
    return NextResponse.json(
      { error: 'Ошибка при остановке записи' },
      { status: 500 }
    );
  }
}
