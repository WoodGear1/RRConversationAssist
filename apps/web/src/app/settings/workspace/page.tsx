import { getServerSession } from 'next-auth'
import { authOptions } from '../../api/auth/[...nextauth]/route'
import { redirect } from 'next/navigation'
import { getCurrentWorkspaceId, getWorkspaceGuilds } from '@/lib/workspace'
import pool from '@/lib/db'
import WorkspaceSettingsClient from './workspace-settings-client'

export default async function WorkspaceSettingsPage() {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect('/login')
  }

  const workspaceId = await getCurrentWorkspaceId()

  if (!workspaceId) {
    redirect('/')
  }

  // Get workspace details
  const workspaceResult = await pool.query(
    'SELECT id, name, owner_user_id FROM workspaces WHERE id = $1',
    [workspaceId]
  )

  if (workspaceResult.rows.length === 0) {
    redirect('/')
  }

  const workspace = workspaceResult.rows[0]

  // Get guilds
  const guilds = await getWorkspaceGuilds(workspaceId)

  // Get guild settings
  const guildSettingsPromises = guilds.map(async (guild) => {
    const settingsResult = await pool.query(
      'SELECT consent_channel_id, consent_message_template FROM guild_settings WHERE guild_id = $1',
      [guild.id]
    )
    return {
      ...guild,
      settings: settingsResult.rows[0] || {
        consent_channel_id: null,
        consent_message_template: null,
      },
    }
  })

  const guildsWithSettings = await Promise.all(guildSettingsPromises)

  return (
    <main className="container mx-auto p-8 max-w-4xl">
      <h1 className="text-3xl font-bold mb-8">Настройки Workspace</h1>

      <div className="space-y-6">
        <div className="rounded-lg border border-border bg-card p-6">
          <h2 className="text-xl font-semibold mb-4">Информация</h2>
          <div className="space-y-2">
            <div>
              <span className="text-sm text-muted-foreground">Название:</span>
              <p className="text-foreground">{workspace.name}</p>
            </div>
            <div>
              <span className="text-sm text-muted-foreground">ID:</span>
              <p className="text-foreground font-mono text-sm">{workspace.id}</p>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-6">
          <h2 className="text-xl font-semibold mb-4">Гильдии</h2>
          {guildsWithSettings.length === 0 ? (
            <p className="text-muted-foreground">
              Нет подключенных гильдий. Добавьте бота на сервер Discord.
            </p>
          ) : (
            <WorkspaceSettingsClient guilds={guildsWithSettings} />
          )}
        </div>
      </div>
    </main>
  )
}
