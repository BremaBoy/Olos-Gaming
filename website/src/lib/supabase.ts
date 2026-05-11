import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Configure auth to avoid navigator LockManager contention in modern browsers
// - autoRefreshToken: false -> prevents the client from automatically attempting
//   token refreshes which use Navigator.locks and can timeout in dev or multi-tab
// - persistSession: true -> keep session in storage so manual setSession works
// - detectSessionInUrl: false -> prevent auth client from parsing URL on load
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
	auth: {
		autoRefreshToken: false,
		persistSession: true,
		detectSessionInUrl: false,
	},
})
