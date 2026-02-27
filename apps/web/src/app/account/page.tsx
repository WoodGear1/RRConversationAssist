import { getServerSession } from 'next-auth'
import { authOptions } from '../api/auth/[...nextauth]/route'
import { redirect } from 'next/navigation'
import pool from '@/lib/db'
import LinkDiscordForm from './link-discord-form'

export default async function AccountPage() {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect('/login')
  }

  // Get Discord link
  const discordResult = await pool.query(
    'SELECT discord_user_id, discord_username, discord_avatar FROM user_discord_links WHERE user_id = $1',
    [session.user.id]
  )

  const discordLink = discordResult.rows[0] || null

  return (
    <main className="container mx-auto p-8 max-w-2xl">
      <h1 className="text-3xl font-bold mb-8">Мой аккаунт</h1>

      <div className="space-y-6">
        <div className="rounded-lg border border-border bg-card p-6">
          <h2 className="text-xl font-semibold mb-4">Профиль</h2>
          <div className="space-y-2">
            <div>
              <span className="text-sm text-muted-foreground">Email:</span>
              <p className="text-foreground">{session.user.email}</p>
            </div>
            <div>
              <span className="text-sm text-muted-foreground">Роль:</span>
              <p className="text-foreground">{session.user.role}</p>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-6">
          <h2 className="text-xl font-semibold mb-4">Привязка Discord</h2>
          {discordLink ? (
            <div className="space-y-2">
              <div>
                <span className="text-sm text-muted-foreground">Discord ID:</span>
                <p className="text-foreground">{discordLink.discord_user_id}</p>
              </div>
              {discordLink.discord_username && (
                <div>
                  <span className="text-sm text-muted-foreground">Имя пользователя:</span>
                  <p className="text-foreground">{discordLink.discord_username}</p>
                </div>
              )}
            </div>
          ) : (
            <LinkDiscordForm />
          )}
        </div>
      </div>
    </main>
  )
}
