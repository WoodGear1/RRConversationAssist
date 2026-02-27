'use client'

import { useState, useEffect } from 'react'

interface Event {
  id: string
  ts: number
  type: string
  actor_discord_user_id: string | null
  payload_json: any
  created_at: string
}

const EVENT_LABELS: Record<string, string> = {
  participant_joined: 'Участник вошёл',
  participant_left: 'Участник вышел',
  recording_started: 'Запись началась',
  recording_stopped: 'Запись остановлена',
  transcript_ready: 'Транскрипт готов',
  summary_ready: 'Саммари готово',
  index_ready: 'Индексация завершена',
  vad_ready: 'VAD готов',
  error_bot: 'Ошибка бота',
}

export default function Timeline({ recordingId }: { recordingId: string }) {
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string | null>(null)

  useEffect(() => {
    fetchEvents()
  }, [recordingId, filter])

  const fetchEvents = async () => {
    try {
      const url = `/api/v1/recordings/${recordingId}/events${
        filter ? `?type=${filter}` : ''
      }`
      const response = await fetch(url)

      if (!response.ok) {
        return
      }

      const data = await response.json()
      setEvents(data.events || [])
    } catch (err) {
      console.error('Error fetching events:', err)
    } finally {
      setLoading(false)
    }
  }

  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)

    if (hours > 0) {
      return `${hours}:${String(minutes % 60).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
    }
    return `${minutes}:${String(seconds % 60).padStart(2, '0')}`
  }

  if (loading) {
    return <div className="text-sm text-muted-foreground">Загрузка...</div>
  }

  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">Timeline событий</h2>
        <select
          value={filter || ''}
          onChange={(e) => setFilter(e.target.value || null)}
          className="rounded-md border border-input bg-background px-3 py-1 text-sm text-foreground"
        >
          <option value="">Все события</option>
          <option value="participant_joined">Вход/выход</option>
          <option value="recording_started">Старт/стоп</option>
          <option value="error_bot">Ошибки</option>
        </select>
      </div>

      <div className="space-y-2 max-h-[400px] overflow-y-auto">
        {events.length === 0 ? (
          <div className="text-sm text-muted-foreground text-center py-4">
            Нет событий
          </div>
        ) : (
          events.map((event) => (
            <div
              key={event.id}
              className="flex items-start gap-3 p-2 rounded-md hover:bg-accent"
            >
              <div className="flex-shrink-0 text-xs text-muted-foreground w-16">
                {formatTime(event.ts)}
              </div>
              <div className="flex-1">
                <div className="text-sm font-medium">
                  {EVENT_LABELS[event.type] || event.type}
                </div>
                {event.actor_discord_user_id && (
                  <div className="text-xs text-muted-foreground">
                    Участник: {event.actor_discord_user_id}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
