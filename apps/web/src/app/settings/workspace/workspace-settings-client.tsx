'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Guild {
  id: string
  discord_guild_id: string
  name: string
  icon: string | null
  settings: {
    consent_channel_id: string | null
    consent_message_template: string | null
  }
}

export default function WorkspaceSettingsClient({
  guilds,
}: {
  guilds: Guild[]
}) {
  const router = useRouter()
  const [saving, setSaving] = useState<string | null>(null)

  const handleSaveConsentChannel = async (
    guildId: string,
    consentChannelId: string
  ) => {
    setSaving(guildId)
    try {
      const response = await fetch(`/api/guilds/${guildId}/consent-channel`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          consent_channel_id: consentChannelId || null,
        }),
      })

      if (response.ok) {
        router.refresh()
      } else {
        const data = await response.json()
        alert(data.error || 'Ошибка при сохранении')
      }
    } catch (error) {
      console.error('Error saving consent channel:', error)
      alert('Ошибка при сохранении')
    } finally {
      setSaving(null)
    }
  }

  return (
    <div className="space-y-4">
      {guilds.map((guild) => (
        <div
          key={guild.id}
          className="rounded-md border border-border p-4 space-y-3"
        >
          <div className="flex items-center gap-3">
            {guild.icon && (
              <img
                src={guild.icon}
                alt={guild.name}
                className="w-10 h-10 rounded-full"
              />
            )}
            <div>
              <h3 className="font-semibold">{guild.name}</h3>
              <p className="text-xs text-muted-foreground">
                ID: {guild.discord_guild_id}
              </p>
            </div>
          </div>

          <div>
            <label
              htmlFor={`consent-channel-${guild.id}`}
              className="block text-sm font-medium mb-1"
            >
              Канал для уведомлений о записи
            </label>
            <div className="flex gap-2">
              <input
                id={`consent-channel-${guild.id}`}
                type="text"
                defaultValue={guild.settings.consent_channel_id || ''}
                placeholder="Discord Channel ID (или оставьте пустым для Text in Voice)"
                className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
              />
              <button
                onClick={() => {
                  const input = document.getElementById(
                    `consent-channel-${guild.id}`
                  ) as HTMLInputElement
                  handleSaveConsentChannel(guild.id, input.value)
                }}
                disabled={saving === guild.id}
                className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {saving === guild.id ? 'Сохранение...' : 'Сохранить'}
              </button>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Если не указан, будет использован Text in Voice канал голосового
              канала или ЛС инициатору
            </p>
          </div>
        </div>
      ))}
    </div>
  )
}
