'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../supabaseClient' 

// Definición del correo maestro del Kiosco
const KIOSCO_CORREO_MAESTRO = 'asistencia@cmw.com.mx';

// Interfaz para los perfiles que vamos a obtener
interface Perfil {
    email: string; // Columna usada para la identificación única
    pin: number | null;
    contrasena: string | null; 
}

export default function LoginPage() {
  // --- Estados de Sesión ---
  const [correoInput, setCorreoInput] = useState('')
  const [contrasenaInput, setContrasenaInput] = useState('') 
  
  // --- Estados de Kiosco (Paso 2) ---
  const [pin, setPin] = useState('')
  const [usuarioSeleccionado, setUsuarioSeleccionado] = useState('') 
  const [isKioscoMode, setIsKioscoMode] = useState(false) 
  const [perfilesOperativos, setPerfilesOperativos] = useState<Perfil[]>([])
  const [cargandoPerfiles, setCargandoPerfiles] = useState(true)
  const router = useRouter()

  useEffect(() => {
    if (isKioscoMode) {
      fetchOperativos();
    }
  }, [isKioscoMode]);

  async function fetchOperativos() {
    setCargandoPerfiles(true);
    // Obtener todos los perfiles que están asignados al kiosco maestro
    const { data, error } = await supabase
      .from('perfiles')
      .select('email, pin')
      .eq('kiosco_correo', KIOSCO_CORREO_MAESTRO)
      .not('pin', 'is', null);
    
    setCargandoPerfiles(false);

    if (error) {
      console.error('Error al cargar perfiles operativos:', error);
      alert('Error al cargar la lista de personal operativo.');
    } else {
      setPerfilesOperativos(data || []);
      if (data && data.length > 0) {
        setUsuarioSeleccionado(data[0].email); 
      }
    }
  }

  const handleLoginInicial = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // 🚨 Convertimos SIEMPRE a minúsculas ANTES de buscar 🚨
    const correoNormalizado = correoInput.toLowerCase().trim()
    
    // 1. Buscar el perfil por email
    const { data: perfil, error: fetchError } = await supabase
        .from('perfiles')
        .select('email, contrasena')
        .eq('email', correoNormalizado)
        .single();
        
    // 2. Manejo de Errores y Validación
    if (fetchError || !perfil) {
        // El error 406 (No Rows Found) o cualquier otro error de fetch cae aquí
        alert('Credenciales incorrectas. (Error: Usuario no encontrado o credenciales inválidas)');
        return;
    }

    // Comparamos la contraseña directamente
    if (perfil.contrasena !== contrasenaInput) {
        alert('Credenciales incorrectas. Verifica tu correo y contraseña.');
        return;
    }

    // --- Validación Exitosa de Correo/Contraseña ---
    // Usamos el valor de la DB como identificador único
    const userIdentifier = perfil.email; 

    if (userIdentifier === KIOSCO_CORREO_MAESTRO) {
        // 🚨 CASO 1: Correo Maestro. Pasar a Modo Kiosco (Paso 2).
        setIsKioscoMode(true);
        setContrasenaInput(''); 
        
    } else {
        // 🚨 CASO 2: Admin/Coordinador. Iniciar sesión simulada.
        localStorage.setItem('USUARIO_ACTIVO', userIdentifier);
        router.push('/dashboard');
    }
  }

  const handleLoginKiosco = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!usuarioSeleccionado || !pin || pin.length !== 4) {
        alert("Por favor, selecciona un usuario e introduce un PIN válido de 4 dígitos.");
        return;
    }

    // Buscar si el PIN coincide con el Nombre/ID del usuario seleccionado
    const { data, error } = await supabase
      .from('perfiles')
      .select('email')
      .eq('email', usuarioSeleccionado)
      .eq('pin', pin)
      .eq('kiosco_correo', KIOSCO_CORREO_MAESTRO)
      .single();
    
    if (error || !data) {
      alert('PIN incorrecto para el usuario seleccionado. Intenta de nuevo.');
      return;
    }

    // Login exitoso: Iniciamos sesión con el Nombre/ID (almacenado en 'email')
    localStorage.setItem('USUARIO_ACTIVO', usuarioSeleccionado.toLowerCase());
    router.push('/dashboard');
  }

  // --- COMPONENTE DE LOGIN ---
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900 p-4">
      <div className="bg-gray-800 p-8 rounded-lg shadow-xl w-full max-w-md border-t-4 border-blue-500">
        <h2 className="text-3xl font-bold text-white text-center mb-6">
          🔐 Panel de Acceso
        </h2>
        
        {/* PANTALLA DE PASO 1: CORREO Y CONTRASEÑA */}
        {!isKioscoMode && (
          <form onSubmit={handleLoginInicial} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-300">
                Correo de Usuario
              </label>
              <input
                id="email"
                type="email"
                placeholder={`ej. admin_master o ${KIOSCO_CORREO_MAESTRO}`}
                value={correoInput}
                onChange={(e) => setCorreoInput(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-600 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-gray-700 text-white"
                required
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-300">
                Contraseña
              </label>
              <input
                id="password"
                type="password"
                placeholder="Contraseña (ej. 12345678)"
                value={contrasenaInput}
                onChange={(e) => setContrasenaInput(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-600 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-gray-700 text-white"
                required
              />
            </div>
            
            <button
              type="submit"
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
            >
              Verificar Credenciales
            </button>
          </form>
        )}

        {/* PANTALLA DE PASO 2: KIOSCO (Usuario y PIN) */}
        {isKioscoMode && (
          <form onSubmit={handleLoginKiosco} className="space-y-6">
            <div className="bg-blue-900/50 p-3 rounded-md text-center">
                <p className="text-sm font-medium text-blue-200">
                    Modo Kiosco activado por: {KIOSCO_CORREO_MAESTRO}
                </p>
            </div>

            {/* Selector de Usuario */}
            <div>
                <label htmlFor="usuario" className="block text-sm font-medium text-gray-300 mb-1">
                    1. Selecciona tu Usuario
                </label>
                {cargandoPerfiles ? (
                  <p className="text-gray-400 text-sm">Cargando personal...</p>
                ) : (
                  <select
                    id="usuario"
                    value={usuarioSeleccionado}
                    onChange={(e) => setUsuarioSeleccionado(e.target.value)}
                    className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-600 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md bg-gray-700 text-white"
                    required
                  >
                    {/* El valor 'p.email' es el Nombre/ID Único */}
                    {perfilesOperativos.map(p => (
                      <option key={p.email} value={p.email}>{p.email}</option>
                    ))}
                  </select>
                )}
            </div>

            {/* Campo de PIN */}
            <div>
                <label htmlFor="pin" className="block text-sm font-medium text-gray-300 mb-1">
                    2. Ingresa tu PIN
                </label>
                <input
                    id="pin"
                    type="password"
                    pattern="\d{4}"
                    maxLength={4}
                    placeholder="PIN de 4 dígitos"
                    value={pin}
                    onChange={(e) => setPin(e.target.value)}
                    className="mt-1 block w-full px-3 py-2 border border-gray-600 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-gray-700 text-white text-center text-xl tracking-widest"
                    required
                />
            </div>
          
            <button
              type="submit"
              disabled={cargandoPerfiles}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-colors disabled:opacity-50"
            >
              {cargandoPerfiles ? 'Cargando...' : 'Acceder a Servicios'}
            </button>
            
            <button 
                onClick={() => { setIsKioscoMode(false); setPin(''); setContrasenaInput(''); }} 
                type="button"
                className="w-full text-blue-400 hover:text-blue-200 mt-4 text-xs"
            >
                ← Volver al Login Inicial
            </button>
          </form>
        )}
      </div>
    </div>
  )
}