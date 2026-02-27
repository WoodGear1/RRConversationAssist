'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import ChatPanel from './chat-panel'
import Timeline from './timeline'
import RecordingStatusDisplay from '@/components/recording-status'
import { RecordingStatus } from '@rrconversationassist/db'

interface TranscriptSegment {
  speaker: string
  start_ms: number
  end_ms: number
  text: string
}

interface RecordingData {
  recording: {
    id: string
    guild: { id: string; name: string }
    channel: { id: string; name: string }
    started_at: string
    ended_at: string | null
    duration_ms: number | null
    status: RecordingStatus
  }
  participants: Array<{
    discord_user_id: string
    display_name: string
    avatar_url: string | null
    allowed_ranges_ms: Array<{ start_ms: number; end_ms: number }>
  }>
  media: {
    playback: {
      type: string
      url: string | null
    }
  }
  transcript: {
    segments: TranscriptSegment[]
  } | null
}

export default function RecordingPlayer({
  recordingId,
  initialTime = 0,
}: {
  recordingId: string
  initialTime?: number
}) {
  const router = useRouter()
  const [showChat, setShowChat] = useState(false)
  const [data, setData] = useState<RecordingData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentTime, setCurrentTime] = useState(initialTime)
  const [playing, setPlaying] = useState(false)
  const audioRef = useRef<HTMLAudioElement>(null)
  const [activeSegmentIndex, setActiveSegmentIndex] = useState<number | null>(null)

  useEffect(() => {
    fetchRecording()
  }, [recordingId])

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.currentTime = initialTime / 1000
    }
  }, [initialTime])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const updateTime = () => {
      setCurrentTime(Math.floor(audio.currentTime * 1000))
    }

    audio.addEventListener('timeupdate', updateTime)
    audio.addEventListener('play', () => setPlaying(true))
    audio.addEventListener('pause', () => setPlaying(false))

    return () => {
      audio.removeEventListener('timeupdate', updateTime)
      audio.removeEventListener('play', () => setPlaying(true))
      audio.removeEventListener('pause', () => setPlaying(false))
    }
  }, [])

  useEffect(() => {
    if (!data?.transcript) return

    // Find active segment
    const segmentIndex = data.transcript.segments.findIndex(
      (seg) => currentTime >= seg.start_ms && currentTime <= seg.end_ms
    )

    setActiveSegmentIndex(segmentIndex >= 0 ? segmentIndex : null)
  }, [currentTime, data])

  const fetchRecording = async () => {
    try {
      const response = await fetch(`/api/v1/recordings/${recordingId}`)

      if (!response.ok) {
        if (response.status === 403) {
          setError('Нет доступа к записи')
        } else if (response.status === 404) {
          setError('Запись не найдена')
        } else {
          setError('Ошибка при загрузке записи')
        }
        return
      }

      const recordingData = await response.json()
      setData(recordingData)
    } catch (err) {
      setError('Ошибка при загрузке записи')
    } finally {
      setLoading(false)
    }
  }

  const handleSegmentClick = (segment: TranscriptSegment) => {
    if (audioRef.current) {
      audioRef.current.currentTime = segment.start_ms / 1000
      setCurrentTime(segment.start_ms)
    }
  }

  const handlePlayPause = () => {
    if (audioRef.current) {
      if (playing) {
        audioRef.current.pause()
      } else {
        audioRef.current.play()
      }
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
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-muted-foreground">Загрузка...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-8 space-y-4">
        <div className="text-destructive">{error}</div>
        <button
          onClick={() => router.push('/recordings')}
          className="rounded-md bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90"
        >
          Вернуться к списку
        </button>
      </div>
    )
  }

  if (!data) {
    return null
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">
          {data.recording.guild.name} - {data.recording.channel.name}
        </h1>
        <div className="flex items-center gap-4 mb-2">
          <p className="text-sm text-muted-foreground">
            {new Date(data.recording.started_at).toLocaleString('ru-RU')}
            {data.recording.duration_ms && ` • ${formatTime(data.recording.duration_ms)}`}
          </p>
          <RecordingStatusDisplay status={data.recording.status} showProgress={true} />
        </div>
      </div>

      {/* Player */}
      <div className="rounded-lg border border-border bg-card p-6">
        <audio
          ref={audioRef}
          src={data.media.playback.url || undefined}
          className="w-full"
          controls
        />
        <div className="mt-4 flex items-center gap-4">
          <button
            onClick={handlePlayPause}
            className="rounded-md bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90"
            aria-label={playing ? 'Пауза' : 'Воспроизведение'}
          >
            {playing ? '⏸ Пауза' : '▶ Воспроизведение'}
          </button>
          <span className="text-sm text-muted-foreground">
            {formatTime(currentTime)}
            {data.recording.duration_ms && ` / ${formatTime(data.recording.duration_ms)}`}
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-4">
        <button
          onClick={() => router.push(`/recordings/${recordingId}?action=summary`)}
          className="rounded-md bg-secondary px-4 py-2 text-secondary-foreground hover:bg-secondary/80"
        >
          Создать саммари
        </button>
        <button
          onClick={() => router.push(`/recordings/${recordingId}?action=export`)}
          className="rounded-md bg-secondary px-4 py-2 text-secondary-foreground hover:bg-secondary/80"
        >
          Экспорт
        </button>
        <button
          onClick={() => setShowChat(!showChat)}
          className="rounded-md bg-secondary px-4 py-2 text-secondary-foreground hover:bg-secondary/80"
        >
          {showChat ? 'Скрыть чат' : 'Спросить запись'}
        </button>
      </div>

      {/* Chat Panel */}
      {showChat && <ChatPanel recordingId={recordingId} />}

      {/* Timeline */}
      <Timeline recordingId={recordingId} />

      {/* Transcript */}
      {data.transcript && (
        <div className="rounded-lg border border-border bg-card p-6">
          <h2 className="text-xl font-semibold mb-4">Транскрипт</h2>
          <div className="space-y-2 max-h-[600px] overflow-y-auto">
            {data.transcript.segments.map((segment, index) => {
              const participant = data.participants.find(
                (p) => p.discord_user_id === segment.speaker
              )
              const isActive = activeSegmentIndex === index

              return (
                <div
                  key={index}
                  onClick={() => handleSegmentClick(segment)}
                  className={`p-3 rounded-md cursor-pointer transition-colors ${
                    isActive
                      ? 'bg-primary/20 border border-primary'
                      : 'hover:bg-accent'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0">
                      {participant?.avatar_url ? (
                        <img
                          src={participant.avatar_url}
                          alt={participant.display_name}
                          className="w-8 h-8 rounded-full"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                          {participant?.display_name?.[0] || '?'}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium">
                          {participant?.display_name || 'Неизвестный'}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {formatTime(segment.start_ms)} - {formatTime(segment.end_ms)}
                        </span>
                      </div>
                      <p className="text-sm">{segment.text}</p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
