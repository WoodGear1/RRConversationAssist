'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

interface User {
  id: string
  email: string
  role: 'user' | 'admin'
  is_active: boolean
  created_at: string
  discord_user_id: string | null
  discord_username: string | null
  discord_discriminator: string | null
  discord_avatar: string | null
}

export default function UsersManagementClient() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<string>('')
  const [activeFilter, setActiveFilter] = useState<string>('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [createEmail, setCreateEmail] = useState('')
  const [createPassword, setCreatePassword] = useState('')
  const [createRole, setCreateRole] = useState<'user' | 'admin'>('user')
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    fetchUsers()
  }, [search, roleFilter, activeFilter])

  const fetchUsers = async () => {
    try {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      if (roleFilter) params.set('role', roleFilter)
      if (activeFilter) params.set('is_active', activeFilter)

      const response = await fetch(`/api/admin/users?${params}`)
      if (!response.ok) {
        throw new Error('Ошибка при загрузке пользователей')
      }

      const data = await response.json()
      setUsers(data.users)
    } catch (error) {
      console.error('Error fetching users:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreating(true)

    try {
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: createEmail,
          password: createPassword,
          role: createRole,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        alert(error.error || 'Ошибка при создании пользователя')
        return
      }

      setShowCreateModal(false)
      setCreateEmail('')
      setCreatePassword('')
      setCreateRole('user')
      fetchUsers()
    } catch (error) {
      console.error('Error creating user:', error)
      alert('Ошибка при создании пользователя')
    } finally {
      setCreating(false)
    }
  }

  const handleToggleActive = async (userId: string, currentActive: boolean) => {
    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !currentActive }),
      })

      if (!response.ok) {
        throw new Error('Ошибка при обновлении пользователя')
      }

      fetchUsers()
    } catch (error) {
      console.error('Error updating user:', error)
      alert('Ошибка при обновлении пользователя')
    }
  }

  if (loading) {
    return <div className="text-muted-foreground">Загрузка...</div>
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-4">
          <input
            type="text"
            placeholder="Поиск по email или Discord..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">Все роли</option>
            <option value="user">User</option>
            <option value="admin">Admin</option>
          </select>
          <select
            value={activeFilter}
            onChange={(e) => setActiveFilter(e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">Все</option>
            <option value="true">Активные</option>
            <option value="false">Неактивные</option>
          </select>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90"
        >
          Создать пользователя
        </button>
      </div>

      <div className="rounded-lg border border-border">
        <table className="w-full">
          <thead className="bg-muted">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-medium">Email</th>
              <th className="px-4 py-3 text-left text-sm font-medium">Discord</th>
              <th className="px-4 py-3 text-left text-sm font-medium">Роль</th>
              <th className="px-4 py-3 text-left text-sm font-medium">Статус</th>
              <th className="px-4 py-3 text-left text-sm font-medium">Создан</th>
              <th className="px-4 py-3 text-left text-sm font-medium">Действия</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-t border-border">
                <td className="px-4 py-3">{user.email}</td>
                <td className="px-4 py-3">
                  {user.discord_username ? (
                    <div className="flex items-center gap-2">
                      {user.discord_avatar && (
                        <img
                          src={user.discord_avatar}
                          alt={user.discord_username}
                          className="w-6 h-6 rounded-full"
                        />
                      )}
                      <span>
                        {user.discord_username}
                        {user.discord_discriminator && `#${user.discord_discriminator}`}
                      </span>
                    </div>
                  ) : (
                    <span className="text-muted-foreground">Не привязан</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded text-xs ${
                    user.role === 'admin' ? 'bg-purple-500/20 text-purple-500' : 'bg-blue-500/20 text-blue-500'
                  }`}>
                    {user.role}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded text-xs ${
                    user.is_active ? 'bg-green-500/20 text-green-500' : 'bg-red-500/20 text-red-500'
                  }`}>
                    {user.is_active ? 'Активен' : 'Неактивен'}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-muted-foreground">
                  {new Date(user.created_at).toLocaleDateString('ru-RU')}
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <Link
                      href={`/admin/users/${user.id}`}
                      className="text-sm text-primary hover:underline"
                    >
                      Подробнее
                    </Link>
                    <button
                      onClick={() => handleToggleActive(user.id, user.is_active)}
                      className="text-sm text-primary hover:underline"
                    >
                      {user.is_active ? 'Деактивировать' : 'Активировать'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card rounded-lg border border-border p-6 w-full max-w-md">
            <h2 className="text-xl font-semibold mb-4">Создать пользователя</h2>
            <form onSubmit={handleCreateUser} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Email</label>
                <input
                  type="email"
                  value={createEmail}
                  onChange={(e) => setCreateEmail(e.target.value)}
                  required
                  className="w-full rounded-md border border-input bg-background px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Пароль</label>
                <input
                  type="password"
                  value={createPassword}
                  onChange={(e) => setCreatePassword(e.target.value)}
                  required
                  minLength={8}
                  className="w-full rounded-md border border-input bg-background px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Роль</label>
                <select
                  value={createRole}
                  onChange={(e) => setCreateRole(e.target.value as 'user' | 'admin')}
                  className="w-full rounded-md border border-input bg-background px-3 py-2"
                >
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={creating}
                  className="flex-1 rounded-md bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {creating ? 'Создание...' : 'Создать'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 rounded-md bg-secondary px-4 py-2 text-secondary-foreground hover:bg-secondary/80"
                >
                  Отмена
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
