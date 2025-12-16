import { createClient } from '@supabase/supabase-js'

// Intentamos leer las variables reales. 
// Si Vercel no las encuentra durante el build, usamos valores "dummy" para que no explote.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co"
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-key"

export const supabase = createClient(supabaseUrl, supabaseAnonKey)