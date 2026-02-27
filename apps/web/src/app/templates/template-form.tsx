'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface Template {
  id?: string
  name: string
  description: string | null
  prompt: string
  output_schema_json: any
}

const DEFAULT_SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    summary: { type: 'string' },
    decisions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          text: { type: 'string' },
          evidence: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                start_ms: { type: 'number' },
                end_ms: { type: 'number' },
                quote: { type: 'string' },
              },
            },
          },
        },
      },
    },
    action_items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          text: { type: 'string' },
          assignee: { type: 'string' },
          evidence: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                start_ms: { type: 'number' },
                end_ms: { type: 'number' },
                quote: { type: 'string' },
              },
            },
          },
        },
      },
    },
    risks: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          text: { type: 'string' },
          evidence: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                start_ms: { type: 'number' },
                end_ms: { type: 'number' },
                quote: { type: 'string' },
              },
            },
          },
        },
      },
    },
    topics: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          text: { type: 'string' },
          evidence: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                start_ms: { type: 'number' },
                end_ms: { type: 'number' },
                quote: { type: 'string' },
              },
            },
          },
        },
      },
    },
  },
  required: ['title', 'summary'],
}

export default function TemplateForm({ template }: { template?: Template }) {
  const router = useRouter()
  const [name, setName] = useState(template?.name || '')
  const [description, setDescription] = useState(template?.description || '')
  const [prompt, setPrompt] = useState(
    template?.prompt ||
      'Проанализируй транскрипт встречи и создай структурированное саммари.'
  )
  const [schema, setSchema] = useState(
    JSON.stringify(template?.output_schema_json || DEFAULT_SCHEMA, null, 2)
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSaving(true)

    try {
      // Validate JSON schema
      JSON.parse(schema)

      const url = template?.id
        ? `/api/v1/templates/${template.id}`
        : '/api/v1/templates'
      const method = template?.id ? 'PATCH' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          description: description || null,
          prompt,
          output_schema_json: schema,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        setError(data.error || 'Ошибка при сохранении')
        return
      }

      router.push('/templates')
      router.refresh()
    } catch (err: any) {
      if (err.message.includes('JSON')) {
        setError('Невалидный JSON в схеме')
      } else {
        setError('Ошибка при сохранении')
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label htmlFor="name" className="block text-sm font-medium mb-1">
          Название *
        </label>
        <input
          id="name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground"
        />
      </div>

      <div>
        <label htmlFor="description" className="block text-sm font-medium mb-1">
          Описание
        </label>
        <textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground"
        />
      </div>

      <div>
        <label htmlFor="prompt" className="block text-sm font-medium mb-1">
          Промпт *
        </label>
        <textarea
          id="prompt"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          required
          rows={6}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground font-mono text-sm"
        />
        <p className="mt-1 text-xs text-muted-foreground">
          Используйте переменные: {'{recording_title}'}, {'{duration_minutes}'}
        </p>
      </div>

      <div>
        <label htmlFor="schema" className="block text-sm font-medium mb-1">
          JSON Schema *
        </label>
        <textarea
          id="schema"
          value={schema}
          onChange={(e) => setSchema(e.target.value)}
          required
          rows={20}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground font-mono text-sm"
        />
        <p className="mt-1 text-xs text-muted-foreground">
          JSON Schema для валидации ответа LLM
        </p>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="flex gap-4">
        <button
          type="submit"
          disabled={saving}
          className="rounded-md bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {saving ? 'Сохранение...' : 'Сохранить'}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-md bg-secondary px-4 py-2 text-secondary-foreground hover:bg-secondary/80"
        >
          Отмена
        </button>
      </div>
    </form>
  )
}
