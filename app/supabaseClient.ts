// app/supabaseClient.ts
import { createClient } from '@supabase/supabase-js'

// 🚨 VERIFICA ESTAS CLAVES EN LA CONFIGURACIÓN DE TU PROYECTO SUPABASE 🚨
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)