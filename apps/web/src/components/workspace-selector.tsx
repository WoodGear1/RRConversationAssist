'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface Workspace {
  id: string
  name: string
  owner_user_id: string
  created_at: string
}

export default function WorkspaceSelector() {
  const router = useRouter()
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [currentWorkspaceId, setCurrentWorkspaceId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchWorkspaces()
  }, [])

  const fetchWorkspaces = async () => {
    try {
      const response = await fetch('/api/workspaces')
      const data = await response.json()
      setWorkspaces(data.workspaces || [])
      setCurrentWorkspaceId(data.currentWorkspaceId || null)
    } catch (error) {
      console.error('Error fetching workspaces:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSwitch = async (workspaceId: string) => {
    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/switch`, {
        method: 'POST',
      })

      if (response.ok) {
        setCurrentWorkspaceId(workspaceId)
        router.refresh()
      }
    } catch (error) {
      console.error('Error switching workspace:', error)
    }
  }

  if (loading) {
    return <div className="text-sm text-muted-foreground">Загрузка...</div>
  }

  if (workspaces.length <= 1) {
    return null
  }

  const currentWorkspace = workspaces.find((w) => w.id === currentWorkspaceId)

  return (
    <div className="flex items-center gap-2">
      <label htmlFor="workspace-select" className="text-sm text-muted-foreground">
        Workspace:
      </label>
      <select
        id="workspace-select"
        value={currentWorkspaceId || ''}
        onChange={(e) => handleSwitch(e.target.value)}
        className="rounded-md border border-input bg-background px-3 py-1 text-sm text-foreground"
      >
        {workspaces.map((workspace) => (
          <option key={workspace.id} value={workspace.id}>
            {workspace.name}
          </option>
        ))}
      </select>
    </div>
  )
}
