'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function UploadPage() {
  const router = useRouter()
  const [file, setFile] = useState<File | null>(null)
  const [title, setTitle] = useState('')
  const [projectId, setProjectId] = useState<string | null>(null)
  const [tagIds, setTagIds] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0])
      if (!title) {
        setTitle(e.target.files[0].name)
      }
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0])
      if (!title) {
        setTitle(e.dataTransfer.files[0].name)
      }
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!file) {
      setError('Выберите файл')
      return
    }

    setUploading(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('title', title)
      if (projectId) {
        formData.append('project_id', projectId)
      }
      formData.append('tag_ids', JSON.stringify(tagIds))
      formData.append('participants', JSON.stringify([]))

      const response = await fetch('/api/v1/recordings/upload', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const data = await response.json()
        setError(data.error || 'Ошибка при загрузке')
        return
      }

      const data = await response.json()
      router.push(`/recordings/${data.recording_id}`)
    } catch (err) {
      setError('Ошибка при загрузке файла')
    } finally {
      setUploading(false)
    }
  }

  return (
    <main className="container mx-auto p-8 max-w-2xl">
      <h1 className="text-3xl font-bold mb-8">Загрузить запись</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label
            htmlFor="file"
            className="block text-sm font-medium mb-2"
            onDrop={handleDrop}
            onDragOver={handleDragOver}
          >
            Файл (mp3, wav, m4a, ogg, opus)
          </label>
          <div className="mt-2 flex justify-center rounded-lg border border-dashed border-border px-6 py-10">
            <div className="text-center">
              {file ? (
                <div>
                  <p className="text-sm font-medium">{file.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                  <button
                    type="button"
                    onClick={() => setFile(null)}
                    className="mt-2 text-sm text-destructive hover:underline"
                  >
                    Удалить
                  </button>
                </div>
              ) : (
                <div>
                  <p className="text-sm text-muted-foreground">
                    Перетащите файл сюда или
                  </p>
                  <label
                    htmlFor="file"
                    className="mt-2 cursor-pointer rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground hover:bg-primary/90"
                  >
                    Выберите файл
                  </label>
                  <input
                    id="file"
                    type="file"
                    accept="audio/*"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        <div>
          <label htmlFor="title" className="block text-sm font-medium mb-1">
            Название
          </label>
          <input
            id="title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground"
          />
        </div>

        {error && (
          <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="flex gap-4">
          <button
            type="submit"
            disabled={uploading || !file}
            className="rounded-md bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {uploading ? 'Загрузка...' : 'Загрузить'}
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
    </main>
  )
}
