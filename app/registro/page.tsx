'use client'
import { useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import Link from 'next/link'

// Definimos la interfaz para el tipado de los datos
interface RegistroForm {
    nombre: string;
    email: string;
    empresa: string;
    telefono: string;
}

export default function RegistroPage() {
    const [enviando, setEnviando] = useState(false);
    const [terminado, setTerminado] = useState(false);
    
    const [formData, setFormData] = useState<RegistroForm>({
        nombre: '',
        email: '',
        empresa: '',
        telefono: ''
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        // normalización de datos para la base de datos
        const emailLimpio = formData.email.trim().toLowerCase();
        const nombreLimpio = formData.nombre.trim().toUpperCase();
        const empresaLimpia = formData.empresa.trim().toUpperCase();

        setEnviando(true);

        try {
            // 1. Verificar si ya existe en perfiles
            const { data: existe, error: errorCheck } = await supabase
                .from('perfiles')
                .select('email')
                .ilike('email', emailLimpio)
                .maybeSingle();

            if (errorCheck) throw new Error("Error al verificar disponibilidad.");
            
            if (existe) {
                alert("Este correo YA está registrado. Puedes ir directamente a solicitar servicio.");
                setEnviando(false);
                return;
            }

            // 2. Insertar en solicitudes_registro (sala de espera)
            const { error: errorInsert } = await supabase
                .from('solicitudes_registro')
                .insert({
                    nombre_completo: nombreLimpio,
                    email: emailLimpio,
                    empresa: empresaLimpia,
                    telefono: formData.telefono.trim(),
                    created_at: new Date().toISOString()
                });

            if (errorInsert) throw errorInsert;

            setTerminado(true);

        } catch (error: any) {
            alert("Ocurrió un error: " + (error.message || "Error desconocido"));
        } finally {
            setEnviando(false);
        }
    };

    if (terminado) {
        return (
            <div className="min-h-screen bg-[#121c32] flex items-center justify-center p-4">
                <div className="bg-white p-8 rounded-3xl shadow-xl max-w-md w-full text-center border-t-8 border-amber-400 animate-in fade-in zoom-in duration-500">
                    <div className="text-6xl mb-4">⏳</div>
                    <h2 className="text-2xl font-black text-[#121c32] mb-2 uppercase italic">Solicitud Recibida</h2>
                    <p className="text-slate-500 text-sm mb-6 font-medium">
                        Gracias <span className="text-[#121c32] font-bold">{formData.nombre.split(' ')[0].toUpperCase()}</span>. 
                        Un administrador validará tus datos y activará tu cuenta en breve.
                    </p>
                    <Link href="/solicitud" className="block w-full bg-[#121c32] text-white py-4 rounded-xl font-black hover:bg-blue-900 transition-all uppercase text-xs tracking-widest shadow-lg">
                        VOLVER AL INICIO
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#121c32] flex flex-col items-center justify-center p-4 md:p-8">
            <div className="w-full max-w-lg bg-white rounded-[2rem] shadow-2xl overflow-hidden animate-in zoom-in duration-300">
                <div className="bg-amber-400 p-6 text-[#121c32] text-center border-b-4 border-black/10">
                    <h1 className="text-2xl font-black italic tracking-tighter uppercase leading-none">Alta de Nuevo Cliente</h1>
                    <p className="text-[10px] font-black opacity-60 mt-2 tracking-[0.2em]">SISTEMA CENTRAL WUOTTO</p>
                </div>

                <form onSubmit={handleSubmit} className="p-8 space-y-5">
                    {/* NOMBRE COMPLETO */}
                    <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                            Nombre Completo (USAR MAYÚSCULAS) *
                        </label>
                        <input 
                            required 
                            type="text" 
                            placeholder="NOMBRE APELLIDO PATERNO APELLIDO MATERNO"
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-bold text-slate-700 outline-none focus:border-amber-400 focus:ring-4 focus:ring-amber-400/10 transition-all uppercase"
                            value={formData.nombre} 
                            onChange={e => setFormData({...formData, nombre: e.target.value})} 
                        />
                    </div>

                    {/* CORREO CORPORATIVO */}
                    <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                            Correo Corporativo *
                        </label>
                        <input 
                            required 
                            type="email" 
                            placeholder="usuario@empresa.com"
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-bold text-slate-700 outline-none focus:border-amber-400 focus:ring-4 focus:ring-amber-400/10 transition-all"
                            value={formData.email} 
                            onChange={e => setFormData({...formData, email: e.target.value})} 
                        />
                    </div>

                    {/* EMPRESA */}
                    <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                            Empresa / Razón Social (USAR MAYÚSCULAS) *
                        </label>
                        <input 
                            required 
                            type="text" 
                            placeholder="NOMBRE DE LA COMPAÑÍA EN MAYÚSCULAS"
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-bold text-slate-700 outline-none focus:border-amber-400 focus:ring-4 focus:ring-amber-400/10 transition-all uppercase"
                            value={formData.empresa} 
                            onChange={e => setFormData({...formData, empresa: e.target.value})} 
                        />
                    </div>

                    {/* TELÉFONO */}
                    <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                            Teléfono de Contacto
                        </label>
                        <input 
                            type="tel" 
                            placeholder="10 DÍGITOS"
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-bold text-slate-700 outline-none focus:border-amber-400 focus:ring-4 focus:ring-amber-400/10 transition-all"
                            value={formData.telefono} 
                            onChange={e => setFormData({...formData, telefono: e.target.value})} 
                        />
                    </div>

                    <div className="pt-2">
                        <button 
                            type="submit" 
                            disabled={enviando} 
                            className="w-full bg-[#121c32] hover:bg-blue-900 text-white font-black py-4 rounded-xl shadow-lg transition-all active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed uppercase italic tracking-wider"
                        >
                            {enviando ? 'PROCESANDO SOLICITUD...' : 'SOLICITAR ACCESO'}
                        </button>
                    </div>
                    
                    <div className="text-center pt-2">
                        <Link href="/solicitud" className="text-[10px] font-black text-slate-400 hover:text-[#121c32] transition-colors flex items-center justify-center gap-2 uppercase tracking-tighter">
                            <span>¿YA TIENES CUENTA?</span>
                            <span className="text-amber-500 underline">IR A SOLICITUD</span>
                        </Link>
                    </div>
                </form>
            </div>
        </div>
    )
}