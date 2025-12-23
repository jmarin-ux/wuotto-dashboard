'use client'
import { useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import Link from 'next/link'

// Interfaz para asegurar la integridad de los datos capturados
interface RegistroForm {
    nombre: string;
    email: string;
    empresa: string;
    telefono: string;
    puesto: string; 
}

export default function RegistroPage() {
    const [enviando, setEnviando] = useState(false);
    const [terminado, setTerminado] = useState(false);
    
    const [formData, setFormData] = useState<RegistroForm>({
        nombre: '',
        email: '',
        empresa: '',
        telefono: '',
        puesto: ''
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        // Optimización: Limpieza y normalización de datos antes de enviar
        const emailLimpio = formData.email.trim().toLowerCase();
        const nombreLimpio = formData.nombre.trim().toUpperCase();
        const empresaLimpia = formData.empresa.trim().toUpperCase();
        const puestoLimpio = formData.puesto.trim().toUpperCase();

        setEnviando(true);

        try {
            // 1. Verificación de duplicados para evitar errores de llave primaria
            const { data: existe, error: errorCheck } = await supabase
                .from('perfiles')
                .select('email')
                .ilike('email', emailLimpio)
                .maybeSingle();

            if (errorCheck) throw new Error("Error al conectar con el servidor.");
            
            if (existe) {
                alert("Este correo ya está registrado en el sistema central.");
                setEnviando(false);
                return;
            }

            // 2. Inserción en la sala de espera (solicitudes_registro)
            const { error: errorInsert } = await supabase
                .from('solicitudes_registro')
                .insert({
                    nombre_completo: nombreLimpio,
                    email: emailLimpio,
                    empresa: empresaLimpia,
                    telefono: formData.telefono.trim(),
                    puesto: puestoLimpio,
                    created_at: new Date().toISOString() // Sincronización de tiempo
                });

            if (errorInsert) throw errorInsert;
            setTerminado(true);

        } catch (error: any) {
            alert("Error de registro: " + (error.message || "Intente más tarde"));
        } finally {
            setEnviando(false);
        }
    };

    // Pantalla de Éxito Optimizada
    if (terminado) {
        return (
            <div className="min-h-screen bg-[#121c32] flex items-center justify-center p-6 relative overflow-hidden">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/10 rounded-full blur-[120px]"></div>
                <div className="bg-white p-10 rounded-[3rem] shadow-2xl max-w-md w-full text-center border-t-8 border-amber-400 animate-in fade-in zoom-in duration-700 z-10">
                    <div className="text-7xl mb-6">📩</div>
                    <h2 className="text-2xl font-black text-[#121c32] mb-3 uppercase italic leading-none">Solicitud Enviada</h2>
                    <p className="text-slate-500 text-[11px] font-bold mb-8 leading-relaxed uppercase">
                        Gracias <span className="text-blue-600">{formData.nombre.split(' ')[0]}</span>. 
                        Tu acceso está en proceso de validación por nuestro equipo administrativo.
                    </p>
                    <Link href="/" className="block w-full bg-[#121c32] text-white py-5 rounded-2xl font-black hover:bg-blue-900 transition-all uppercase text-[10px] tracking-[0.2em] shadow-xl active:scale-95">
                        VOLVER AL MENÚ PRINCIPAL
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#121c32] flex flex-col items-center justify-center p-6 relative overflow-hidden">
            {/* Efectos visuales de fondo consistentes con Wuotto Central */}
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/10 rounded-full blur-[120px]"></div>
            
            <div className="w-full max-w-lg bg-white rounded-[3rem] shadow-2xl overflow-hidden animate-in zoom-in duration-500 z-10 border border-white/20">
                <div className="bg-amber-400 p-8 text-[#121c32] text-center border-b-4 border-black/5">
                    <h1 className="text-3xl font-black italic tracking-tighter uppercase leading-none">Alta de Cliente</h1>
                    <p className="text-[10px] font-black opacity-60 mt-2 tracking-[0.3em] uppercase">Intelligence & Service Portal</p>
                </div>

                <form onSubmit={handleSubmit} className="p-10 space-y-5">
                    {/* NOMBRE */}
                    <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 italic">Nombre Completo *</label>
                        <input required type="text" placeholder="NOMBRE Y APELLIDOS" className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-6 py-4 font-black text-slate-700 outline-none focus:border-amber-400 focus:ring-4 focus:ring-amber-400/5 transition-all uppercase" value={formData.nombre} onChange={e => setFormData({...formData, nombre: e.target.value})} />
                    </div>

                    {/* CORREO */}
                    <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 italic">Correo Corporativo *</label>
                        <input required type="email" placeholder="usuario@empresa.com" className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-6 py-4 font-black text-slate-700 outline-none focus:border-amber-400 focus:ring-4 focus:ring-amber-400/5 transition-all" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
                    </div>

                    {/* EMPRESA Y PUESTO (GRID) */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 italic">Empresa *</label>
                            <input required type="text" placeholder="RAZÓN SOCIAL" className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-6 py-4 font-black text-slate-700 outline-none focus:border-amber-400 focus:ring-4 focus:ring-amber-400/5 transition-all uppercase" value={formData.empresa} onChange={e => setFormData({...formData, empresa: e.target.value})} />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 italic">Puesto / Cargo *</label>
                            <input required type="text" placeholder="EJ. GERENTE" className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-6 py-4 font-black text-slate-700 outline-none focus:border-amber-400 focus:ring-4 focus:ring-amber-400/5 transition-all uppercase" value={formData.puesto} onChange={e => setFormData({...formData, puesto: e.target.value})} />
                        </div>
                    </div>

                    {/* TELÉFONO */}
                    <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 italic">Teléfono de Contacto *</label>
                        <input required type="tel" placeholder="10 DÍGITOS" className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-6 py-4 font-black text-slate-700 outline-none focus:border-amber-400 focus:ring-4 focus:ring-amber-400/5 transition-all" value={formData.telefono} onChange={e => setFormData({...formData, telefono: e.target.value})} />
                    </div>

                    <div className="pt-4">
                        <button type="submit" disabled={enviando} className="w-full bg-[#121c32] hover:bg-blue-900 text-white font-black py-5 rounded-2xl shadow-xl shadow-blue-900/20 transition-all active:scale-95 disabled:opacity-70 uppercase italic tracking-widest text-xs">
                            {enviando ? 'Verificando Sistema...' : 'Solicitar Acceso al Portal'}
                        </button>
                    </div>
                    
                    <div className="text-center pt-2">
                        <Link href="/" className="text-[10px] font-black text-slate-400 hover:text-amber-500 transition-colors uppercase tracking-widest">
                            ¿Ya tienes cuenta? <span className="underline ml-1">Ir al Inicio</span>
                        </Link>
                    </div>
                </form>
            </div>
        </div>
    )
}