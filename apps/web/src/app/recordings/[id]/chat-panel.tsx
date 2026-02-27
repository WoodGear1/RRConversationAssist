'use client'

import { useState } from 'react'

interface Message {
  role: 'user' | 'assistant'
  content: string
  citations?: Array<{ start_ms: number; end_ms: number; text: string }>
}

export default function ChatPanel({ recordingId }: { recordingId: string }) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSend = async () => {
    if (!input.trim() || loading) return

    const userMessage: Message = { role: 'user', content: input }
    setMessages((prev) => [...prev, userMessage])
    setInput('')
    setLoading(true)

    try {
      const response = await fetch(`/api/v1/recordings/${recordingId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: input,
          history: messages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      })

      if (!response.ok) {
        throw new Error('Ошибка при отправке вопроса')
      }

      const data = await response.json()

      const assistantMessage: Message = {
        role: 'assistant',
        content: data.answer,
        citations: data.citations || [],
      }

      setMessages((prev) => [...prev, assistantMessage])
    } catch (error) {
      console.error('Error sending message:', error)
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: 'Ошибка при обработке вопроса. Попробуйте ещё раз.',
        },
      ])
    } finally {
      setLoading(false)
    }
  }

  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000)
    const minutes = Math.floor(seconds / 60)
    return `${minutes}:${String(seconds % 60).padStart(2, '0')}`
  }

  return (
    <div className="rounded-lg border border-border bg-card p-6 h-[600px] flex flex-col">
      <h2 className="text-xl font-semibold mb-4">Спросить запись</h2>

      <div className="flex-1 overflow-y-auto space-y-4 mb-4">
        {messages.length === 0 && (
          <div className="text-center text-muted-foreground py-8">
            Задайте вопрос о содержании записи
          </div>
        )}

        {messages.map((message, index) => (
          <div
            key={index}
            className={`p-3 rounded-md ${
              message.role === 'user'
                ? 'bg-primary/20 ml-auto max-w-[80%]'
                : 'bg-muted mr-auto max-w-[80%]'
            }`}
          >
            <p className="text-sm whitespace-pre-wrap">{message.content}</p>

            {message.citations && message.citations.length > 0 && (
              <div className="mt-2 space-y-1">
                {message.citations.map((citation, i) => (
                  <a
                    key={i}
                    href={`/recordings/${recordingId}?time=${citation.start_ms}`}
                    className="block text-xs text-primary hover:underline"
                  >
                    [{formatTime(citation.start_ms)}] {citation.text.substring(0, 50)}...
                  </a>
                ))}
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="text-muted-foreground text-sm">Думаю...</div>
        )}
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              handleSend()
            }
          }}
          placeholder="Задайте вопрос..."
          className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-foreground"
          disabled={loading}
        />
        <button
          onClick={handleSend}
          disabled={loading || !input.trim()}
          className="rounded-md bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          Отправить
        </button>
      </div>
    </div>
  )
}
