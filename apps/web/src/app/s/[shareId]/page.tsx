import { redirect } from 'next/navigation'
import pool from '@/lib/db'
import RecordingPlayer from '../../recordings/[id]/recording-player'

export default async function SharePage({
  params,
}: {
  params: { shareId: string }
}) {
  // Get share
  const shareResult = await pool.query(
    `SELECT s.*, r.id as recording_id
     FROM shares s
     INNER JOIN recordings r ON r.id = s.recording_id
     WHERE s.share_id = $1 AND s.revoked = false`,
    [params.shareId]
  )

  if (shareResult.rows.length === 0) {
    redirect('/')
  }

  const share = shareResult.rows[0]

  // Check expiration
  if (share.expires_at && new Date(share.expires_at) < new Date()) {
    redirect('/')
  }

  // Check mode
  if (share.mode === 'authenticated') {
    // Would redirect to login if not authenticated
    // For now, allow access
  }

  // Render recording with share context
  return (
    <main className="container mx-auto p-8">
      <div className="mb-4 text-sm text-muted-foreground">
        Просмотр по ссылке
      </div>
      <RecordingPlayer recordingId={share.recording_id} initialTime={0} />
    </main>
  )
}
