import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("FALTAN VARIABLES: Asegúrate de tener NEXT_PUBLIC_SUPABASE_URL y ANON_KEY en Vercel")
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)