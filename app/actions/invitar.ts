'use server'
import { createClient } from '@supabase/supabase-js'

export async function invitarUsuarioPorCorreo(email: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  // 1. Validación de Credenciales antes de intentar conectar
  if (!supabaseUrl) {
    console.error("❌ Error: Falta NEXT_PUBLIC_SUPABASE_URL en .env.local");
    return { success: false, error: "Error de configuración del servidor (URL)." };
  }
  if (!serviceRoleKey) {
    console.error("❌ Error: Falta SUPABASE_SERVICE_ROLE_KEY en .env.local");
    return { success: false, error: "Error de configuración del servidor (KEY)." };
  }

  try {
    // 2. Conexión Segura
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // 3. Envío de Invitación
    const { data, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email);

    if (error) {
      console.error("Error Supabase Auth:", error.message);
      return { success: false, error: "Supabase: " + error.message };
    }
    
    return { success: true, userId: data.user.id };

  } catch (err: any) {
    return { success: false, error: "Error inesperado: " + err.message };
  }
}