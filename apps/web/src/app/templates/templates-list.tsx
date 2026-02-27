'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

interface Template {
  id: string
  name: string
  description: string | null
  prompt: string
  output_schema_json: any
  owner_user_id: string | null
  is_default: boolean
  created_at: string
  updated_at: string
}

export default function TemplatesList() {
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchTemplates()
  }, [])

  const fetchTemplates = async () => {
    try {
      const response = await fetch('/api/v1/templates')

      if (!response.ok) {
        setError('Ошибка при загрузке шаблонов')
        return
      }

      const data = await response.json()
      setTemplates(data.templates || [])
    } catch (err) {
      setError('Ошибка при загрузке шаблонов')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Удалить шаблон?')) {
      return
    }

    try {
      const response = await fetch(`/api/v1/templates/${id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        fetchTemplates()
      } else {
        const data = await response.json()
        alert(data.error || 'Ошибка при удалении')
      }
    } catch (err) {
      alert('Ошибка при удалении')
    }
  }

  if (loading) {
    return <div className="text-muted-foreground">Загрузка...</div>
  }

  if (error) {
    return <div className="text-destructive">{error}</div>
  }

  if (templates.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Нет шаблонов. Создайте первый шаблон.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {templates.map((template) => (
        <div
          key={template.id}
          className="rounded-lg border border-border bg-card p-6"
        >
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <h3 className="text-xl font-semibold">{template.name}</h3>
                {template.is_default && (
                  <span className="text-xs bg-primary/20 text-primary px-2 py-1 rounded">
                    По умолчанию
                  </span>
                )}
                {template.owner_user_id === null && (
                  <span className="text-xs bg-secondary text-secondary-foreground px-2 py-1 rounded">
                    Глобальный
                  </span>
                )}
              </div>
              {template.description && (
                <p className="text-sm text-muted-foreground mb-2">
                  {template.description}
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                Обновлён: {new Date(template.updated_at).toLocaleString('ru-RU')}
              </p>
            </div>
            <div className="flex gap-2">
              <Link
                href={`/templates/${template.id}`}
                className="rounded-md bg-secondary px-3 py-1 text-sm text-secondary-foreground hover:bg-secondary/80"
              >
                Редактировать
              </Link>
              <button
                onClick={() => handleDelete(template.id)}
                className="rounded-md bg-destructive px-3 py-1 text-sm text-destructive-foreground hover:bg-destructive/90"
              >
                Удалить
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
