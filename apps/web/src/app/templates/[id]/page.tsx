import { getServerSession } from 'next-auth'
import { authOptions } from '../../api/auth/[...nextauth]/route'
import { redirect } from 'next/navigation'
import TemplateForm from '../template-form'
import pool from '@/lib/db'

export default async function EditTemplatePage({
  params,
}: {
  params: { id: string }
}) {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect('/login')
  }

  const result = await pool.query(
    'SELECT * FROM summary_templates WHERE id = $1',
    [params.id]
  )

  if (result.rows.length === 0) {
    redirect('/templates')
  }

  const template = result.rows[0]

  return (
    <main className="container mx-auto p-8 max-w-4xl">
      <h1 className="text-3xl font-bold mb-8">Редактировать шаблон</h1>
      <TemplateForm template={template} />
    </main>
  )
}
