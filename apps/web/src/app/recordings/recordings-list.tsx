'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import RecordingStatusDisplay from '@/components/recording-status'
import { RecordingStatus } from '@rrconversationassist/db'

interface Recording {
  id: string
  started_at: string
  ended_at: string | null
  duration_ms: number | null
  status: RecordingStatus
  source: string
  guild_name: string | null
  channel_name: string | null
}

export default function RecordingsList() {
  const [recordings, setRecordings] = useState<Recording[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchRecordings()
  }, [])

  const fetchRecordings = async () => {
    try {
      const response = await fetch('/api/v1/recordings')

      if (!response.ok) {
        setError('Ошибка при загрузке записей')
        return
      }

      const data = await response.json()
      setRecordings(data)
    } catch (err) {
      setError('Ошибка при загрузке записей')
    } finally {
      setLoading(false)
    }
  }

  const formatTime = (ms: number | null) => {
    if (!ms) return '—'
    const seconds = Math.floor(ms / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)

    if (hours > 0) {
      return `${hours}ч ${minutes % 60}м`
    }
    return `${minutes}м`
  }


  if (loading) {
    return <div className="text-muted-foreground">Загрузка...</div>
  }

  if (error) {
    return <div className="text-destructive">{error}</div>
  }

  if (recordings.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Нет записей. Создайте запись через Discord бота.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {recordings.map((recording) => (
        <Link
          key={recording.id}
          href={`/recordings/${recording.id}`}
          className="block rounded-lg border border-border bg-card p-6 hover:bg-accent transition-colors"
        >
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <h3 className="font-semibold mb-1">
                {recording.guild_name || 'Неизвестная гильдия'} - {recording.channel_name || 'Неизвестный канал'}
              </h3>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span>{new Date(recording.started_at).toLocaleString('ru-RU')}</span>
                <span>•</span>
                <span>{formatTime(recording.duration_ms)}</span>
                <span>•</span>
                <RecordingStatusDisplay status={recording.status} />
              </div>
            </div>
            <div className="text-muted-foreground">→</div>
          </div>
        </Link>
      ))}
    </div>
  )
}
