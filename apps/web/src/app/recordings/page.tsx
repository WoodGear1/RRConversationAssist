import { getServerSession } from 'next-auth'
import { authOptions } from '../api/auth/[...nextauth]/route'
import { redirect } from 'next/navigation'
import RecordingsList from './recordings-list'

export default async function RecordingsPage() {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect('/login')
  }

  return (
    <main className="container mx-auto p-8">
      <h1 className="text-3xl font-bold mb-8">Мои записи</h1>
      <RecordingsList />
    </main>
  )
}
