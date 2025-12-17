'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
// ✅ RUTA CORREGIDA: Asumiendo que moviste 'lib' a la raíz del proyecto.
// Si te da error, cambia a '../lib/supabaseClient'
import { supabase } from '../../lib/supabaseClient'; 

// 🔵 CONFIGURACIÓN: Correo maestro que activa el Modo Kiosco
const KIOSCO_CORREO_MAESTRO = 'asistencia@cmw.com.mx';

// ====================================================================
// INTERFAZ DE TIPOS (Corregida para evitar errores de Build)
// ====================================================================
interface Perfil {
  email: string;      // Aquí vendrá el Nombre del Operativo (según tu BD) o el Correo del Admin
  pin: number | null;
  contrasena?: string | null; // ✅ Opcional: Los operativos no traen contraseña en la carga inicial
}

export default function LoginPage() {
  // --- Estados de Sesión (Paso 1) ---
  const [correoInput, setCorreoInput] = useState('')
  const [contrasenaInput, setContrasenaInput] = useState('') 
  
  // --- Estados de Kiosco (Paso 2) ---
  const [pin, setPin] = useState('')
  const [usuarioSeleccionado, setUsuarioSeleccionado] = useState('') 
  const [isKioscoMode, setIsKioscoMode] = useState(false) 
  const [perfilesOperativos, setPerfilesOperativos] = useState<Perfil[]>([])
  const [cargandoPerfiles, setCargandoPerfiles] = useState(false) // Iniciamos en false
  const router = useRouter()

  // Efecto: Cargar la lista de operativos solo cuando se active el Modo Kiosco
  useEffect(() => {
    if (isKioscoMode) {
      fetchOperativos();
    }
  }, [isKioscoMode]);

  async function fetchOperativos() {
    setCargandoPerfiles(true);
    
    // 🔍 BUSCAR OPERATIVOS:
    // Traemos a todos los que tengan 'kiosco_correo' igual al correo maestro.
    // OJO: NO traemos la contraseña por seguridad.
    const { data, error } = await supabase
      .from('perfiles')
      .select('email, pin')
      .eq('kiosco_correo', KIOSCO_CORREO_MAESTRO)
      .not('pin', 'is', null); // Solo los que tengan PIN asignado
    
    setCargandoPerfiles(false);

    if (error) {
      console.error('Error cargando operativos:', error);
      alert('Error al cargar la lista del personal.');
    } else {
      setPerfilesOperativos(data || []);
      // Seleccionar el primero por defecto para facilitar el uso
      if (data && data.length > 0) {
        setUsuarioSeleccionado(data[0].email); 
      }
    }
  }

  // 1️⃣ MANEJO DEL LOGIN INICIAL (Correo + Contraseña)
  const handleLoginInicial = async (e: React.FormEvent) => {
    e.preventDefault()
    
    const correoNormalizado = correoInput.toLowerCase().trim()
    
    // A. Buscar usuario en la BD
    const { data: perfil, error: fetchError } = await supabase
        .from('perfiles')
        .select('email, contrasena, rol')
        .eq('email', correoNormalizado)
        .single();
        
    // B. Validar si existe y si la contraseña coincide
    if (fetchError || !perfil || perfil.contrasena !== contrasenaInput) {
        alert('Credenciales incorrectas o usuario no encontrado.');
        return;
    }

    // C. DECIDIR EL DESTINO
    if (perfil.email === KIOSCO_CORREO_MAESTRO) {
        // 👉 ES EL KIOSCO: No entramos al dashboard, activamos la pantalla de selección
        setIsKioscoMode(true);
        setContrasenaInput(''); // Limpiamos la contraseña por seguridad
    } else {
        // 👉 ES ADMIN/COORDINADOR: Entramos directo
        localStorage.setItem('USUARIO_ACTIVO', perfil.email);
        router.push('/dashboard');
    }
  }

  // 2️⃣ MANEJO DEL LOGIN DE KIOSCO (Usuario + PIN)
  const handleLoginKiosco = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!usuarioSeleccionado || pin.length !== 4) {
        alert("Introduce un PIN válido de 4 dígitos.");
        return;
    }

    // Validar que ese Usuario específico tenga ese PIN
    const { data, error } = await supabase
      .from('perfiles')
      .select('email, nombre_completo')
      .eq('email', usuarioSeleccionado) // En tu BD el nombre está en la columna 'email' para operativos
      .eq('pin', pin)
      .eq('kiosco_correo', KIOSCO_CORREO_MAESTRO)
      .single();
    
    if (error || !data) {
      alert('PIN incorrecto. Intenta de nuevo.');
      return;
    }

    // ✅ LOGIN EXITOSO COMO OPERATIVO
    localStorage.setItem('USUARIO_ACTIVO', data.email); // Guardamos el nombre/ID
    // Opcional: Guardar nombre bonito si existe, si no usar el email
    localStorage.setItem('TECNICO_SESION', data.nombre_completo || data.email); 
    
    router.push('/dashboard');
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 p-4 font-sans uppercase">
      <div className="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-md animate-in fade-in zoom-in duration-300">
        
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-[#121c32] rounded-lg flex items-center justify-center text-white font-black italic mx-auto mb-3 text-xl">W</div>
          <h1 className="text-2xl font-black text-slate-800 italic tracking-tighter">ACCESO <span className="text-[#0055b8]">WUOTTO</span></h1>
          <p className="text-[10px] font-bold text-slate-400 tracking-[0.3em] mt-1">Intelligence Dashboard</p>
        </div>

        {/* PANTALLA 1: LOGIN GENERAL (O MAESTRO) */}
        {!isKioscoMode && (
          <form onSubmit={handleLoginInicial} className="space-y-5">
            <div className="bg-blue-50 p-3 rounded-xl border border-blue-100 text-center mb-4">
                <p className="text-[9px] font-bold text-blue-600 tracking-wide">
                    INGRESO ADMINISTRATIVO O APERTURA DE KIOSCO
                </p>
            </div>

            <div className="space-y-1">
              <label className="text-[9px] font-black text-slate-400 tracking-widest ml-1">CORREO ELECTRÓNICO</label>
              <input
                type="email"
                value={correoInput}
                onChange={(e) => setCorreoInput(e.target.value)}
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-[11px] font-bold text-slate-800 outline-none focus:ring-2 focus:ring-[#0055b8] transition-all"
                placeholder="admin@empresa.com"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-[9px] font-black text-slate-400 tracking-widest ml-1">CONTRASEÑA</label>
              <input
                type="password"
                value={contrasenaInput}
                onChange={(e) => setContrasenaInput(e.target.value)}
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-[11px] font-bold text-slate-800 outline-none focus:ring-2 focus:ring-[#0055b8] transition-all"
                placeholder="••••••••"
                required
              />
            </div>
            
            <button
              type="submit"
              className="w-full py-4 rounded-xl text-white text-[10px] font-black tracking-[0.2em] shadow-lg shadow-blue-900/20 bg-[#121c32] hover:bg-[#0055b8] transition-all active:scale-[0.98]"
            >
              INGRESAR
            </button>
          </form>
        )}

        {/* PANTALLA 2: SELECCIÓN DE OPERATIVO (SOLO SI SE INGRESÓ EL CORREO MAESTRO) */}
        {isKioscoMode && (
          <form onSubmit={handleLoginKiosco} className="space-y-5">
            <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-100 text-center mb-2">
                <p className="text-[9px] font-black text-emerald-600 tracking-widest">
                    ✅ MODO KIOSCO ACTIVADO
                </p>
                <p className="text-[8px] font-bold text-emerald-400 mt-0.5">{KIOSCO_CORREO_MAESTRO}</p>
            </div>

            <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-400 tracking-widest ml-1">SELECCIONAR USUARIO</label>
                {cargandoPerfiles ? (
                  <div className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-[10px] text-slate-400 font-bold text-center animate-pulse">
                      CARGANDO PERSONAL...
                  </div>
                ) : (
                  <select
                    value={usuarioSeleccionado}
                    onChange={(e) => setUsuarioSeleccionado(e.target.value)}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-[10px] font-bold text-slate-800 outline-none focus:ring-2 focus:ring-[#0055b8] cursor-pointer uppercase"
                    required
                  >
                    {perfilesOperativos.map(p => (
                      <option key={p.email} value={p.email}>
                        {p.email} {/* Muestra el nombre guardado en la columna email */}
                      </option>
                    ))}
                  </select>
                )}
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
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-[12px] font-black text-slate-800 outline-none focus:ring-2 focus:ring-[#0055b8] text-center tracking-[0.5em]"
                    placeholder="• • • •"
                    required
                />
            </div>
          
            <button
              type="submit"
              disabled={cargandoPerfiles}
              className="w-full py-4 rounded-xl text-white text-[10px] font-black tracking-[0.2em] shadow-lg bg-emerald-600 hover:bg-emerald-500 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {cargandoPerfiles ? 'ESPERANDO...' : 'INICIAR TURNO'}
            </button>
            
            <button 
                onClick={() => { setIsKioscoMode(false); setPin(''); setContrasenaInput(''); }} 
                type="button"
                className="w-full text-slate-400 hover:text-slate-600 mt-2 text-[9px] font-bold tracking-widest py-2"
            >
                ← CERRAR KIOSCO
            </button>
          </form>
        )}
      </div>
    </div>
  )
}