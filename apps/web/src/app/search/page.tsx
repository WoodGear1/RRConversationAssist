import { getServerSession } from 'next-auth'
import { authOptions } from '../api/auth/[...nextauth]/route'
import { redirect } from 'next/navigation'

export default async function SearchPage() {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect('/login')
  }

  return (
    <main className="container mx-auto p-8">
      <h1 className="text-3xl font-bold mb-8">Поиск</h1>
      <p className="text-muted-foreground">Поиск по записям будет здесь</p>
    </main>
  )
}
