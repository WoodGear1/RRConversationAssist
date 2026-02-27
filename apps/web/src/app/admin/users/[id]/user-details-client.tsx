'use client'

import { useState, useEffect } from 'react'

interface UserDetails {
  id: string
  email: string
  role: 'user' | 'admin'
  is_active: boolean
  created_at: string
  updated_at: string
  discord_user_id: string | null
  discord_username: string | null
  discord_discriminator: string | null
  discord_avatar: string | null
  discord_linked_at: string | null
  workspaces: Array<{
    id: string
    name: string
    role: string
    created_at: string
  }>
}

export default function UserDetailsClient({ userId }: { userId: string }) {
  const [user, setUser] = useState<UserDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [newRole, setNewRole] = useState<'user' | 'admin'>('user')
  const [newActive, setNewActive] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchUser()
  }, [userId])

  const fetchUser = async () => {
    try {
      const response = await fetch(`/api/admin/users/${userId}`)
      if (!response.ok) {
        throw new Error('Ошибка при загрузке пользователя')
      }

      const data = await response.json()
      setUser(data)
      setNewRole(data.role)
      setNewActive(data.is_active)
    } catch (error) {
      console.error('Error fetching user:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: newRole,
          is_active: newActive,
        }),
      })

      if (!response.ok) {
        throw new Error('Ошибка при обновлении пользователя')
      }

      setEditing(false)
      fetchUser()
    } catch (error) {
      console.error('Error updating user:', error)
      alert('Ошибка при обновлении пользователя')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="text-muted-foreground">Загрузка...</div>
  }

  if (!user) {
    return <div className="text-destructive">Пользователь не найден</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Пользователь: {user.email}</h1>
        {!editing ? (
          <button
            onClick={() => setEditing(true)}
            className="rounded-md bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90"
          >
            Редактировать
          </button>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="rounded-md bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {saving ? 'Сохранение...' : 'Сохранить'}
            </button>
            <button
              onClick={() => {
                setEditing(false)
                setNewRole(user.role)
                setNewActive(user.is_active)
              }}
              className="rounded-md bg-secondary px-4 py-2 text-secondary-foreground hover:bg-secondary/80"
            >
              Отмена
            </button>
          </div>
        )}
      </div>

      <div className="rounded-lg border border-border bg-card p-6 space-y-4">
        <div>
          <label className="text-sm font-medium text-muted-foreground">Email</label>
          <p className="text-foreground">{user.email}</p>
        </div>

        <div>
          <label className="text-sm font-medium text-muted-foreground">Роль</label>
          {editing ? (
            <select
              value={newRole}
              onChange={(e) => setNewRole(e.target.value as 'user' | 'admin')}
              className="mt-1 rounded-md border border-input bg-background px-3 py-2"
            >
              <option value="user">User</option>
              <option value="admin">Admin</option>
            </select>
          ) : (
            <p className="text-foreground">
              <span className={`px-2 py-1 rounded text-xs ${
                user.role === 'admin' ? 'bg-purple-500/20 text-purple-500' : 'bg-blue-500/20 text-blue-500'
              }`}>
                {user.role}
              </span>
            </p>
          )}
        </div>

        <div>
          <label className="text-sm font-medium text-muted-foreground">Статус</label>
          {editing ? (
            <label className="flex items-center gap-2 mt-1">
              <input
                type="checkbox"
                checked={newActive}
                onChange={(e) => setNewActive(e.target.checked)}
                className="rounded border-input"
              />
              <span>Активен</span>
            </label>
          ) : (
            <p className="text-foreground">
              <span className={`px-2 py-1 rounded text-xs ${
                user.is_active ? 'bg-green-500/20 text-green-500' : 'bg-red-500/20 text-red-500'
              }`}>
                {user.is_active ? 'Активен' : 'Неактивен'}
              </span>
            </p>
          )}
        </div>

        <div>
          <label className="text-sm font-medium text-muted-foreground">Discord</label>
          {user.discord_username ? (
            <div className="flex items-center gap-2 mt-1">
              {user.discord_avatar && (
                <img
                  src={user.discord_avatar}
                  alt={user.discord_username}
                  className="w-8 h-8 rounded-full"
                />
              )}
              <div>
                <p className="text-foreground">
                  {user.discord_username}
                  {user.discord_discriminator && `#${user.discord_discriminator}`}
                </p>
                <p className="text-xs text-muted-foreground">
                  ID: {user.discord_user_id}
                </p>
                {user.discord_linked_at && (
                  <p className="text-xs text-muted-foreground">
                    Привязан: {new Date(user.discord_linked_at).toLocaleString('ru-RU')}
                  </p>
                )}
              </div>
            </div>
          ) : (
            <p className="text-muted-foreground">Не привязан</p>
          )}
        </div>

        <div>
          <label className="text-sm font-medium text-muted-foreground">Workspaces</label>
          {user.workspaces.length > 0 ? (
            <div className="mt-2 space-y-2">
              {user.workspaces.map((ws) => (
                <div key={ws.id} className="flex items-center justify-between p-2 bg-muted rounded">
                  <span className="text-foreground">{ws.name}</span>
                  <span className="text-xs text-muted-foreground">{ws.role}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground">Нет workspace</p>
          )}
        </div>

        <div>
          <label className="text-sm font-medium text-muted-foreground">Создан</label>
          <p className="text-foreground">{new Date(user.created_at).toLocaleString('ru-RU')}</p>
        </div>
      </div>
    </div>
  )
}
