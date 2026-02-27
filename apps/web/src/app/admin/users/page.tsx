import { getServerSession } from 'next-auth';
import { authOptions } from '../../api/auth/[...nextauth]/route';
import { redirect } from 'next/navigation';
import UsersManagementClient from './users-management-client';

export default async function AdminUsersPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect('/login');
  }

  if (session.user.role !== 'admin') {
    redirect('/');
  }

  return (
    <main className="container mx-auto p-8 max-w-6xl">
      <h1 className="text-3xl font-bold mb-8">Управление пользователями</h1>
      <UsersManagementClient />
    </main>
  );
}
