import { createClient } from '@supabase/supabase-js'
import { Database } from './types'

export const createBrowserClient = (supabaseUrl: string, supabaseAnonKey: string) => {
  return createClient<Database>(supabaseUrl, supabaseAnonKey)
}

export type SupabaseClient = ReturnType<typeof createBrowserClient>
