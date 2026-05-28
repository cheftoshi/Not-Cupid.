import { redirect, notFound } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { isAdminEmail } from '@/lib/admin'
import AdminClient from './admin-client'

export const dynamic = 'force-dynamic'

export default async function AdminPage() {
  const user = await getCurrentUser()

  if (!user) {
    redirect('/login?next=/admin')
  }

  if (!isAdminEmail(user.email)) {
    notFound()
  }

  return <AdminClient />
}
