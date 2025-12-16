import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

// Si estas variables no existen, el código fallará en la consola del navegador
// avisándonos exactamente qué falta.
if (!supabaseUrl || !supabaseAnonKey) {
  console.error("ERROR: Faltan las variables de entorno de Supabase.")
}

export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '')