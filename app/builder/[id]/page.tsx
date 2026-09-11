import { redirect } from 'next/navigation'
import { Workbench } from '@/components/editor/workbench'
import { DashboardHeader } from '@/components/dashboard/dashboard-header'
import { createClient } from '@/lib/supabase/server'

export default async function BuilderPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  const { data: project, error } = await supabase
    .from('projects')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (error || !project) {
    redirect('/dashboard')
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <DashboardHeader email={user.email ?? 'user@example.com'} />
      <Workbench initialFiles={project.files ?? {}} />
    </div>
  )
}
