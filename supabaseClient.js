import { createClient } from '@supabase/supabase-js'

// Tu URL de proyecto (extraída de tu token)
const supabaseUrl = 'https://agxdxtljhioojxcvritq.supabase.co'

// Tu Anon Key (el token que me compartiste)
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFneGR4dGxqaGlvb2p4Y3ZyaXRxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU4MTEyMDEsImV4cCI6MjA4MTM4NzIwMX0.rC0mAF9icFxGQuIlW1yn379-jUW56DeKy8T4iCtlykQ'

// Crear y exportar la conexión
export const supabase = createClient(supabaseUrl, supabaseKey)