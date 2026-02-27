import { getServerSession } from 'next-auth'
import { authOptions } from '../../auth/[...nextauth]/route'
import { NextResponse } from 'next/server'
import pool from '@/lib/db'

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  }

  try {
    const { discordUserId } = await request.json()

    if (!discordUserId || !/^\d{17,19}$/.test(discordUserId)) {
      return NextResponse.json(
        { error: 'Неверный формат Discord User ID' },
        { status: 400 }
      )
    }

    // Check if already linked
    const existing = await pool.query(
      'SELECT id FROM user_discord_links WHERE discord_user_id = $1',
      [discordUserId]
    )

    if (existing.rows.length > 0) {
      return NextResponse.json(
        { error: 'Этот Discord аккаунт уже привязан к другому пользователю' },
        { status: 400 }
      )
    }

    // Link Discord account
    await pool.query(
      `INSERT INTO user_discord_links (user_id, discord_user_id)
       VALUES ($1, $2)
       ON CONFLICT (discord_user_id) 
       DO UPDATE SET user_id = $1, updated_at = CURRENT_TIMESTAMP`,
      [session.user.id, discordUserId]
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error linking Discord:', error)
    return NextResponse.json(
      { error: 'Ошибка при привязке Discord' },
      { status: 500 }
    )
  }
}
