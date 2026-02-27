import { getServerSession } from 'next-auth'
import { authOptions } from '../../api/auth/[...nextauth]/route'
import { redirect } from 'next/navigation'
import RecordingPlayer from './recording-player'

export default async function RecordingPage({
  params,
  searchParams,
}: {
  params: { id: string }
  searchParams: { time?: string }
}) {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect('/login')
  }

  const initialTime = searchParams.time ? parseInt(searchParams.time, 10) : 0

  return (
    <main className="container mx-auto p-8">
      <RecordingPlayer recordingId={params.id} initialTime={initialTime} />
    </main>
  )
}
