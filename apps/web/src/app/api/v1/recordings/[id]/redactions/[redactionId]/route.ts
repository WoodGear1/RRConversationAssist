import { getServerSession } from 'next-auth';
import { authOptions } from '../../../../../../auth/[...nextauth]/route';
import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function DELETE(
  request: Request,
  { params }: { params: { id: string; redactionId: string } }
) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });
  }

  if (session.user.role !== 'admin') {
    return NextResponse.json(
      { error: 'Только админ может удалять redactions' },
      { status: 403 }
    );
  }

  try {
    await pool.query(
      'DELETE FROM redactions WHERE id = $1 AND recording_id = $2',
      [params.redactionId, params.id]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting redaction:', error);
    return NextResponse.json(
      { error: 'Ошибка при удалении redaction' },
      { status: 500 }
    );
  }
}
