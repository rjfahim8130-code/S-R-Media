const { createClient } = supabase
window.sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// Helper: get current user
async function getUser() {
  const { data: { user } } = await window.sb.auth.getUser()
  return user
}

// Helper: get profile
async function getProfile(userId) {
  const { data } = await window.sb.from('profiles').select('*').eq('id', userId).single()
  return data
}

// Helper: get settings
async function getSettings() {
  const { data } = await window.sb.from('site_settings').select('*').eq('id', 1).single()
  return data
}
