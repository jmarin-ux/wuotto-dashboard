'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { useRouter } from 'next/navigation'

// ====================================================================
// DEFINICIÓN DE TIPOS (SOLUCIÓN AL ERROR DE VERCEL)
// ====================================================================
// Usamos '?' para indicar que ciertos campos pueden no venir de la BD
interface Perfil {
  id?: number;
  email: string;
  rol?: string;
  nombre_completo?: string;
  contrasena?: string; // Solución: Ahora es opcional
  pin?: string;        // Solución: Ahora es opcional
}

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [modo, setModo] = useState<'admin' | 'operativo'>('admin')
  
  // Para modo operativo
  const [perfilesOperativos, setPerfilesOperativos] = useState<Perfil[]>([])
  const [usuarioSeleccionado, setUsuarioSeleccionado] = useState('')
  const [pin, setPin] = useState('')

  const router = useRouter()

  // Cargar operativos al iniciar si cambiamos a ese modo
  useEffect(() => {
    const cargarOperativos = async () => {
      // Solicitamos email y pin (y nombre si existe), pero NO la contraseña
      const { data, error } = await supabase
        .from('perfiles')
        .select('email, pin, nombre_completo') 
        .eq('rol', 'operativo')
      
      if (error) {
        console.error('Error cargando operativos:', error)
      } else {
        // TypeScript ahora aceptará esto porque 'contrasena' es opcional en la Interfaz
        setPerfilesOperativos(data || [])
        if (data && data.length > 0) {
          setUsuarioSeleccionado(data[0].email)
        }
      }
    }

    cargarOperativos()
  }, [])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      let dataUsuario = null

      if (modo === 'admin') {
        // 1. Login Administrativo (Email + Contraseña)
        const { data, error } = await supabase
          .from('perfiles')
          .select('*')
          .eq('email', email.trim())
          .eq('contrasena', password.trim()) // Nota: Idealmente usar hash en futuro
          .single()

        if (error || !data) throw new Error('Credenciales incorrectas')
        dataUsuario = data

      } else {
        // 2. Login Operativo (Selección + PIN)
        const { data, error } = await supabase
          .from('perfiles')
          .select('*')
          .eq('email', usuarioSeleccionado)
          .eq('pin', pin.trim())
          .single()

        if (error || !data) throw new Error('PIN incorrecto')
        dataUsuario = data
      }

      // Guardar sesión y redirigir
      localStorage.setItem('USUARIO_ACTIVO', dataUsuario.email)
      localStorage.setItem('TECNICO_SESION', dataUsuario.nombre_completo || dataUsuario.email) // Fallback seguro
      
      router.push('/dashboard')

    } catch (error: any) {
      alert(error.message || 'Error al iniciar sesión')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 p-4 font-sans uppercase">
      <div className="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-md animate-in fade-in zoom-in duration-300">
        
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-[#121c32] rounded-lg flex items-center justify-center text-white font-black italic mx-auto mb-3 text-xl">W</div>
          <h1 className="text-2xl font-black text-slate-800 italic tracking-tighter">ACCESO <span className="text-[#0055b8]">WUOTTO</span></h1>
          <p className="text-[10px] font-bold text-slate-400 tracking-[0.3em] mt-1">Intelligence Dashboard</p>
        </div>

        {/* Selector de Modo */}
        <div className="flex bg-slate-100 p-1 rounded-xl mb-6">
          <button 
            onClick={() => setModo('admin')}
            className={`flex-1 py-2 text-[10px] font-black rounded-lg transition-all ${modo === 'admin' ? 'bg-white text-[#0055b8] shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
          >
            ADMINISTRACIÓN
          </button>
          <button 
            onClick={() => setModo('operativo')}
            className={`flex-1 py-2 text-[10px] font-black rounded-lg transition-all ${modo === 'operativo' ? 'bg-white text-[#0055b8] shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
          >
            OPERATIVO (PIN)
          </button>
        </div>

        <form onSubmit={handleLogin} className="space-y-5">
          {modo === 'admin' ? (
            <>
              <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-400 tracking-widest ml-1">CORREO ELECTRÓNICO</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-[11px] font-bold text-slate-800 outline-none focus:ring-2 focus:ring-[#0055b8] transition-all"
                  placeholder="admin@empresa.com"
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-400 tracking-widest ml-1">CONTRASEÑA</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-[11px] font-bold text-slate-800 outline-none focus:ring-2 focus:ring-[#0055b8] transition-all"
                  placeholder="••••••••"
                  required
                />
              </div>
            </>
          ) : (
            <>
              <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-400 tracking-widest ml-1">SELECCIONAR USUARIO</label>
                <select
                  value={usuarioSeleccionado}
                  onChange={(e) => setUsuarioSeleccionado(e.target.value)}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-[11px] font-bold text-slate-800 outline-none focus:ring-2 focus:ring-[#0055b8] cursor-pointer"
                >
                  {perfilesOperativos.map((p) => (
                    <option key={p.id || p.email} value={p.email}>
                      {p.nombre_completo || p.email}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-400 tracking-widest ml-1">PIN DE ACCESO</label>
                <input
                  type="password"
                  pattern="[0-9]*"
                  inputMode="numeric"
                  maxLength={4}
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-[11px] font-bold text-slate-800 outline-none focus:ring-2 focus:ring-[#0055b8] text-center tracking-[0.5em]"
                  placeholder="• • • •"
                  required
                />
              </div>
            </>
          )}

          <button
            type="submit"
            disabled={loading}
            className={`w-full py-4 rounded-xl text-white text-[10px] font-black tracking-[0.2em] shadow-lg shadow-blue-900/20 transition-all active:scale-[0.98] ${loading ? 'bg-slate-400 cursor-not-allowed' : 'bg-[#121c32] hover:bg-[#0055b8]'}`}
          >
            {loading ? 'VERIFICANDO...' : 'INGRESAR AL SISTEMA'}
          </button>
        </form>
      </div>
    </div>
  )
}