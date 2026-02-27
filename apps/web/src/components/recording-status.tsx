'use client'

import { RecordingStatus } from '@rrconversationassist/db'

interface RecordingStatusProps {
  status: RecordingStatus
  showProgress?: boolean
  className?: string
}

// Status labels mapping
const STATUS_LABELS: Record<RecordingStatus, string> = {
  created: 'Создана',
  recording: 'Идёт запись',
  uploaded: 'Загружена',
  audio_ready: 'Аудио готово',
  vad_done: 'VAD выполнен',
  transcribing: 'Транскрибируется',
  transcript_ready: 'Транскрипт готов',
  chapters_draft_ready: 'Главы готовы',
  indexing_ready: 'Готово к индексации',
  indexed: 'Проиндексировано',
  summaries_ready: 'Саммари готовы',
  ready: 'Готово',
  failed: 'Ошибка',
}

// Status progress mapping (0-100)
const STATUS_PROGRESS: Record<RecordingStatus, number> = {
  created: 0,
  recording: 10,
  uploaded: 15,
  audio_ready: 20,
  vad_done: 30,
  transcribing: 40,
  transcript_ready: 50,
  chapters_draft_ready: 55,
  indexing_ready: 60,
  indexed: 70,
  summaries_ready: 85,
  ready: 100,
  failed: 0,
}

// Status color mapping
const STATUS_COLORS: Record<RecordingStatus, string> = {
  created: 'text-muted-foreground',
  recording: 'text-blue-500',
  uploaded: 'text-blue-500',
  audio_ready: 'text-blue-500',
  vad_done: 'text-blue-500',
  transcribing: 'text-yellow-500',
  transcript_ready: 'text-green-500',
  chapters_draft_ready: 'text-green-500',
  indexing_ready: 'text-yellow-500',
  indexed: 'text-green-500',
  summaries_ready: 'text-green-500',
  ready: 'text-green-600',
  failed: 'text-destructive',
}

export default function RecordingStatusDisplay({
  status,
  showProgress = false,
  className = '',
}: RecordingStatusProps) {
  const label = STATUS_LABELS[status] || status
  const progress = STATUS_PROGRESS[status] || 0
  const colorClass = STATUS_COLORS[status] || 'text-muted-foreground'

  return (
    <div className={className}>
      <div className="flex items-center gap-2">
        <span className={`text-sm font-medium ${colorClass}`}>{label}</span>
        {status === 'transcribing' || status === 'recording' ? (
          <span className="inline-block w-2 h-2 bg-current rounded-full animate-pulse" />
        ) : null}
      </div>
      {showProgress && status !== 'ready' && status !== 'failed' && (
        <div className="mt-2">
          <div className="w-full bg-muted rounded-full h-1.5">
            <div
              className="bg-primary h-1.5 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="text-xs text-muted-foreground mt-1">{progress}%</div>
        </div>
      )}
    </div>
  )
}
