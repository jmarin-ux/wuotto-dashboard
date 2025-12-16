import { createClient } from '@supabase/supabase-js'

// 1. Leemos las variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

// 2. Validación de seguridad
if (!supabaseUrl || !supabaseKey) {
  throw new Error('Faltan variables de entorno. Revisa tu archivo .env.local')
}

// 3. Exportamos la conexión
export const supabase = createClient(supabaseUrl, supabaseKey)