import { supabase } from './supabaseClient.js'

// Household CRUD runs directly under RLS (households_owner / hh_members_owner) —
// no Edge Function needed since it's not money/points/votes. A client owns at
// most one household (the primary holder), created lazily on first member add.

export async function getHouseholdId(userId) {
  const { data, error } = await supabase
    .from('households')
    .select('id')
    .eq('primary_profile_id', userId)
    .maybeSingle()
  if (error) throw error
  return data?.id ?? null
}

async function ensureHousehold(userId) {
  const existing = await getHouseholdId(userId)
  if (existing) return existing
  const { data, error } = await supabase
    .from('households')
    .insert({ primary_profile_id: userId })
    .select('id')
    .single()
  if (error) throw error
  return data.id
}

export async function listMembers(userId) {
  const householdId = await getHouseholdId(userId)
  if (!householdId) return []
  const { data, error } = await supabase
    .from('household_members')
    .select('id,display_name,member_type,birth_year')
    .eq('household_id', householdId)
    .order('created_at')
  if (error) throw error
  return data
}

export async function addMember(userId, { display_name, member_type, birth_year }) {
  const householdId = await ensureHousehold(userId)
  const { data, error } = await supabase
    .from('household_members')
    .insert({ household_id: householdId, display_name, member_type, birth_year: birth_year || null })
    .select('id,display_name,member_type,birth_year')
    .single()
  if (error) throw error
  return data
}

export async function removeMember(memberId) {
  const { error } = await supabase.from('household_members').delete().eq('id', memberId)
  if (error) throw error
}
