import { getServerSession } from 'next-auth';
import { authOptions } from '../../../auth/[...nextauth]/route';
import { NextResponse } from 'next/server';
import { setCurrentWorkspaceId } from '@/lib/workspace';
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
    // Verify user has access to workspace
    const memberResult = await pool.query(
      'SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2',
      [params.id, session.user.id]
    );

    if (memberResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'Нет доступа к workspace' },
        { status: 403 }
      );
    }

    await setCurrentWorkspaceId(params.id);

    return NextResponse.json({ success: true, workspaceId: params.id });
  } catch (error) {
    console.error('Error switching workspace:', error);
    return NextResponse.json(
      { error: 'Ошибка при переключении workspace' },
      { status: 500 }
    );
  }
}
