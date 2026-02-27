import { getServerSession } from 'next-auth';
import { authOptions } from '../../../api/auth/[...nextauth]/route';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import UserDetailsClient from './user-details-client';

export default async function UserDetailsPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect('/login');
  }

  if (session.user.role !== 'admin') {
    redirect('/');
  }

  return (
    <main className="container mx-auto p-8 max-w-4xl">
      <div className="mb-4">
        <Link href="/admin/users" className="text-primary hover:underline">
          ← Назад к списку пользователей
        </Link>
      </div>
      <UserDetailsClient userId={params.id} />
    </main>
  );
}
