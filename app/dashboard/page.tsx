import { redirect } from 'next/navigation'
import { DashboardHeader } from '@/components/dashboard/dashboard-header'
import { NewProjectDialog } from '@/components/dashboard/new-project-dialog'
import { createClient } from '@/lib/supabase/server'
import { isMissingProjectsTableError, listProjectsForUser } from '@/lib/project-store'

export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  let projects: any[] = []
  let error: { message: string } | null = null

  try {
    const response = await supabase
      .from('projects')
      .select('id, name, description, template, deploy_url, updated_at, created_at')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })

    projects = response.data ?? []
    error = response.error ? { message: response.error.message } : null
  } catch (caught) {
    if (isMissingProjectsTableError(caught)) {
      projects = await listProjectsForUser(user.id)
      error = null
    } else {
      error = { message: 'Unable to load projects' }
    }
  }

  if (error && isMissingProjectsTableError(error)) {
    projects = await listProjectsForUser(user.id)
    error = null
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <DashboardHeader email={user.email ?? 'user@example.com'} />

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div className="mb-8 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Workspace</p>
            <h1 className="text-3xl font-semibold tracking-tight">Your projects</h1>
          </div>
          <NewProjectDialog />
        </div>

        {error ? (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            {error.message}
          </div>
        ) : !projects || projects.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
            <h2 className="text-xl font-semibold">No projects yet</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Create your first project to start building.
            </p>
            <div className="mt-6 flex justify-center">
              <NewProjectDialog />
            </div>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {projects.map((project) => (
              <a
                key={project.id}
                href={`/builder/${project.id}`}
                className="group rounded-2xl border border-border bg-card p-5 transition hover:border-primary/60 hover:bg-accent/30"
              >
                <div className="mb-3 flex items-center justify-between">
                  <span className="rounded-full border border-border bg-secondary px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                    {project.template}
                  </span>
                  {project.deploy_url ? (
                    <span className="text-xs text-emerald-500">Live</span>
                  ) : null}
                </div>

                <h3 className="text-lg font-semibold text-foreground">{project.name}</h3>
                <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">
                  {project.description || 'No description yet.'}
                </p>

                <div className="mt-5 flex items-center justify-between text-xs text-muted-foreground">
                  <span>
                    {new Date(project.updated_at ?? project.created_at).toLocaleDateString()}
                  </span>
                  <span className="group-hover:text-primary">Open →</span>
                </div>
              </a>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
