import { createClient } from '@/lib/supabase/server'
import { SiteHeader } from '@/components/landing/site-header'
import { Hero } from '@/components/landing/hero'
import { Features } from '@/components/landing/features'
import { HowItWorks } from '@/components/landing/how-it-works'
import { Cta, SiteFooter } from '@/components/landing/cta'

export default async function HomePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const isAuthed = Boolean(user)

  return (
    <div className="flex min-h-svh flex-col">
      <SiteHeader isAuthed={isAuthed} />
      <main className="flex-1">
        <Hero isAuthed={isAuthed} />
        <Features />
        <HowItWorks />
        <Cta isAuthed={isAuthed} />
      </main>
      <SiteFooter />
    </div>
  )
}
