import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { SettingsForm } from './SettingsForm'
import type { Profile } from '@/types'

export default async function SettingsPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profileRaw } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  const profile = profileRaw as Profile | null
  if (!profile) redirect('/login')

  return <SettingsForm profile={profile} />
}
