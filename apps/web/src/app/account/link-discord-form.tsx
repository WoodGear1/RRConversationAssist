'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function LinkDiscordForm() {
  const router = useRouter()
  const [discordUserId, setDiscordUserId] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const response = await fetch('/api/account/link-discord', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ discordUserId }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Ошибка при привязке Discord')
        return
      }

      setSuccess(true)
      router.refresh()
    } catch (err) {
      setError('Произошла ошибка')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="rounded-md bg-green-500/10 p-3 text-sm text-green-500">
        Discord успешно привязан!
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="discordUserId" className="block text-sm font-medium mb-1">
          Discord User ID (Snowflake)
        </label>
        <input
          id="discordUserId"
          type="text"
          value={discordUserId}
          onChange={(e) => setDiscordUserId(e.target.value)}
          required
          pattern="[0-9]{17,19}"
          placeholder="123456789012345678"
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground"
        />
        <p className="mt-1 text-xs text-muted-foreground">
          Введите ваш Discord User ID (можно получить через Developer Mode в Discord)
        </p>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="rounded-md bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
      >
        {loading ? 'Привязка...' : 'Привязать Discord'}
      </button>
    </form>
  )
}
