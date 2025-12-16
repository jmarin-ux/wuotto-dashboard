import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

// Validación de seguridad: Si faltan las llaves, detiene todo y avisa claramente
if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('ERROR CRÍTICO: Faltan las variables de entorno de Supabase en Vercel. Verifique Settings > Environment Variables.')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)