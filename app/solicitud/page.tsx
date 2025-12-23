'use client'
import { useState, useRef, useEffect } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { compressImage } from '../../lib/imageUtils'

export default function SolicitudServicioPage() {
    const [fase, setFase] = useState(1); 
    const [buscando, setBuscando] = useState(false);
    const [enviando, setEnviando] = useState(false);
    const [terminado, setTerminado] = useState<string | null>(null);
    const [errorValidacion, setErrorValidacion] = useState('');

    const [usuarioValidado, setUsuarioValidado] = useState<any>(null);
    const [emailInput, setEmailInput] = useState('');
    const [passwordInput, setPasswordInput] = useState('');

    const [formData, setFormData] = useState({
        contacto: '',
        ubicacion_sede: '',
        ubicacion_area: '',
        tipo: '',
        descripcion: ''
    });

    const fileInputRef = useRef<HTMLInputElement>(null);
    const [foto, setFoto] = useState<File | null>(null);

    // --- AUTO-LOGIN: VERIFICAR SESIÓN ACTIVA ---
    useEffect(() => {
        const revisarSesion = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user) {
                cargarPerfil(session.user.id);
            }
        };
        revisarSesion();
    }, []);

    const cargarPerfil = async (userId: string) => {
        const { data } = await supabase.from('perfiles').select('*').eq('id', userId).single();
        if (data) {
            setUsuarioValidado(data);
            setFormData(prev => ({ ...prev, contacto: data.telefono || '' }));
            setFase(2);
        }
    };

    // --- PASO 1: LOGIN SEGURO ---
    const manejarLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setBuscando(true);
        setErrorValidacion('');

        try {
            const { data, error } = await supabase.auth.signInWithPassword({
                email: emailInput.trim(),
                password: passwordInput
            });

            if (error) {
                setErrorValidacion('❌ Credenciales incorrectas o acceso no autorizado.');
                return;
            }

            if (data.user) {
                await cargarPerfil(data.user.id);
            }
        } catch (err) {
            setErrorValidacion('Error de conexión. Intenta de nuevo.');
        } finally {
            setBuscando(false);
        }
    };

    const generarTicketId = () => `SR${Math.floor(100000 + Math.random() * 900000)}`;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.tipo) return alert("Selecciona un tipo de servicio");
        setEnviando(true);

        try {
            const ticketID = generarTicketId();
            let urlEvidencia = '';

            if (foto) {
                const compressed = await compressImage(foto);
                const path = `publicos/${ticketID}_${Date.now()}.jpg`;
                const { error: uploadError } = await supabase.storage.from('evidencias').upload(path, compressed);
                if (!uploadError) {
                    const { data: publicUrlData } = supabase.storage.from('evidencias').getPublicUrl(path);
                    urlEvidencia = publicUrlData.publicUrl;
                }
            }

            const coordinadorFijo = usuarioValidado.coordinador_asignado || '';
            const { error: insertError } = await supabase.from('servicios').insert({
                codigo_servicio: ticketID,
                "Empresa": usuarioValidado.empresa || 'Empresa Registrada',
                "Nombre Completo": usuarioValidado.nombre_completo,
                "Número de Contacto": formData.contacto,
                ubicacion: `${formData.ubicacion_sede} - ${formData.ubicacion_area}`,
                tipo_mantenimiento: formData.tipo,
                detalle_problema: formData.descripcion,
                evidencia_visual: urlEvidencia,
                fecha_solicitud: new Date().toISOString(),
                estatus: coordinadorFijo ? 'ASIGNADO' : 'SIN ASIGNAR', 
                coordinador: coordinadorFijo,
                personal_operativo: ''
            });

            if (insertError) throw insertError;
            setTerminado(ticketID);
            setFase(3);
        } catch (error: any) {
            alert("Error al enviar solicitud: " + error.message);
        } finally {
            setEnviando(false);
        }
    };

    const cerrarSesion = async () => {
        await supabase.auth.signOut();
        window.location.reload();
    };

    if (fase === 3) {
        return (
            <div className="min-h-screen bg-[#f4f7fa] flex items-center justify-center p-4">
                <div className="bg-white p-8 rounded-3xl shadow-xl max-w-md w-full text-center border-t-8 border-emerald-500 animate-in zoom-in duration-300">
                    <div className="text-6xl mb-4">✅</div>
                    <h2 className="text-2xl font-black text-[#121c32] mb-2 uppercase">¡Solicitud Recibida!</h2>
                    <p className="text-slate-500 text-sm mb-6 uppercase italic">Hemos notificado a nuestro equipo central.</p>
                    <div className="bg-slate-100 p-4 rounded-xl mb-6">
                        <p className="text-xs font-bold text-slate-400 uppercase italic">Folio de seguimiento</p>
                        <p className="text-4xl font-black text-emerald-600 tracking-tighter mt-1">{terminado}</p>
                    </div>
                    <button onClick={() => setFase(2)} className="w-full bg-[#121c32] text-white py-3 rounded-xl font-black uppercase italic hover:bg-blue-900 transition-all">Levantar otro servicio</button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#121c32] flex flex-col items-center justify-center p-4 md:p-8">
            <div className="w-full max-w-3xl bg-white rounded-[2rem] shadow-2xl overflow-hidden relative">
                
                <div className="bg-blue-600 p-6 md:p-8 text-white relative overflow-hidden flex justify-between items-center">
                    <div className="relative z-10">
                        <h1 className="text-3xl font-black italic tracking-tighter leading-none">WUOTTO</h1>
                        <p className="text-blue-200 font-bold text-[9px] tracking-widest uppercase mt-1 leading-none italic">Portal de Solicitud de Servicios</p>
                    </div>
                    {usuarioValidado && (
                        <button onClick={cerrarSesion} className="relative z-10 text-[9px] font-black uppercase border border-white/20 px-3 py-1.5 rounded-lg hover:bg-white/10 italic transition-all">Cerrar Sesión</button>
                    )}
                    <div className="absolute -right-10 -top-10 text-white/10 text-9xl font-black italic rotate-12">W</div>
                </div>

                {fase === 1 && (
                    <div className="p-8 md:p-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <h2 className="text-xl font-black text-[#121c32] mb-2 uppercase italic tracking-tighter leading-none flex items-center gap-3">🔐 Acceso Seguro</h2>
                        <p className="text-[11px] text-slate-400 mb-8 uppercase font-bold italic tracking-wide">Inicia sesión para autorizar tus solicitudes</p>

                        <form onSubmit={manejarLogin} className="space-y-4">
                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block italic">Email Corporativo</label>
                                <input type="email" required autoFocus placeholder="nombre@tuempresa.com" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-4 font-black text-[#121c32] outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all uppercase italic" value={emailInput} onChange={e => setEmailInput(e.target.value)} />
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block italic">Contraseña</label>
                                <input type="password" required placeholder="••••••••" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-4 font-black text-[#121c32] outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all italic" value={passwordInput} onChange={e => setPasswordInput(e.target.value)} />
                            </div>

                            {errorValidacion && <div className="bg-red-50 text-red-600 p-3 rounded-lg text-[10px] font-black border border-red-100 uppercase italic tracking-wider">{errorValidacion}</div>}

                            <button type="submit" disabled={buscando} className="w-full bg-[#121c32] hover:bg-blue-900 text-white font-black py-4 rounded-xl shadow-lg transition-all active:scale-95 disabled:opacity-70 uppercase italic">
                                {buscando ? 'Verificando...' : 'Iniciar Acceso ➜'}
                            </button>
                        </form>
                    </div>
                )}

                {fase === 2 && usuarioValidado && (
                    <form onSubmit={handleSubmit} className="p-6 md:p-8 space-y-6 animate-in fade-in slide-in-from-right-8 duration-500">
                        <div className="bg-blue-50 p-5 rounded-2xl border border-blue-100 flex items-center justify-between">
                            <div>
                                <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest italic mb-1">Solicitante Identificado</p>
                                <p className="text-base font-black text-[#121c32] uppercase italic leading-none">{usuarioValidado.nombre_completo}</p>
                                <p className="text-[10px] font-bold text-slate-500 uppercase mt-1 italic tracking-widest">{usuarioValidado.empresa}</p>
                            </div>
                            <div className="text-3xl opacity-20 italic font-black">WUOTTO</div>
                        </div>

                        <div className="space-y-3">
                            <h3 className="text-[11px] font-black text-slate-400 uppercase italic border-b pb-1 tracking-[0.2em]">📍 Ubicación</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-[9px] font-black text-slate-400 uppercase italic">Sede *</label>
                                    <input required type="text" placeholder="Corporativo Santa Fe" className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-3 font-black text-[#121c32] outline-none focus:border-blue-500 uppercase italic" value={formData.ubicacion_sede} onChange={e => setFormData({...formData, ubicacion_sede: e.target.value})} />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[9px] font-black text-slate-400 uppercase italic">Área Específica *</label>
                                    <input required type="text" placeholder="Almacén / Oficina 2" className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-3 font-black text-[#121c32] outline-none focus:border-blue-500 uppercase italic" value={formData.ubicacion_area} onChange={e => setFormData({...formData, ubicacion_area: e.target.value})} />
                                </div>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <h3 className="text-[11px] font-black text-slate-400 uppercase italic border-b pb-1 tracking-[0.2em]">🛠 Tipo de Mantenimiento</h3>
                            <div className="space-y-2">
                                {[
                                    "Mantenimiento Correctivo Programado - Reparación de fallo no crítico",
                                    "Instalación/Montaje - Equipos nuevos o configuración inicial",
                                    "Configuración/Ajuste - Software o ajustes finos",
                                    "Visita Técnica o Levantamiento - Cotización o inspección",
                                    "Conservación de Inmueble - Electricidad, fontanería, pintura",
                                    "Mantenimiento Correctivo (EMERGENCIA) - Fallo crítico"
                                ].map((opcion) => (
                                    <label key={opcion} className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all hover:bg-slate-50 ${formData.tipo === opcion ? 'border-blue-500 bg-blue-50/50 ring-1 ring-blue-500 shadow-sm' : 'border-slate-200'}`}>
                                        <input type="radio" name="tipoServicio" className="mt-1 accent-[#121c32]" checked={formData.tipo === opcion} onChange={() => setFormData({...formData, tipo: opcion})} />
                                        <span className={`text-[10px] font-black uppercase italic ${opcion.includes('EMERGENCIA') ? 'text-red-600' : 'text-slate-600'}`}>{opcion}</span>
                                    </label>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-400 uppercase italic tracking-widest mb-1 block">Detalle del Problema *</label>
                            <textarea required rows={4} placeholder="Describe el problema a detalle..." className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-4 font-black text-[#121c32] outline-none focus:border-blue-500 focus:bg-white uppercase italic resize-none" value={formData.descripcion} onChange={e => setFormData({...formData, descripcion: e.target.value})} />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-slate-400 uppercase italic tracking-widest block">Teléfono *</label>
                                <input required type="tel" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-4 font-black text-[#121c32] outline-none focus:border-blue-500 italic" value={formData.contacto} onChange={e => setFormData({...formData, contacto: e.target.value})} />
                            </div>
                            <div onClick={() => fileInputRef.current?.click()} className="border-2 border-dashed border-slate-300 rounded-xl flex flex-col items-center justify-center text-slate-400 cursor-pointer hover:bg-slate-50 hover:border-blue-400 transition-all h-full min-h-[80px]">
                                {foto ? <p className="text-[10px] font-black text-blue-600 uppercase italic tracking-wider">📸 {foto.name}</p> : <p className="text-[10px] font-black uppercase text-center px-4 italic leading-tight">📷 Adjuntar Evidencia Visual (Opcional)</p>}
                                <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={(e) => { if(e.target.files?.[0]) setFoto(e.target.files[0]); }} />
                            </div>
                        </div>

                        <div className="flex gap-3 pt-4 border-t border-slate-100">
                            <button type="submit" disabled={enviando} className="flex-1 bg-[#121c32] hover:bg-blue-900 text-white font-black py-4 rounded-xl shadow-lg transition-all active:scale-95 disabled:opacity-70 uppercase italic flex items-center justify-center gap-2">
                                {enviando ? 'Procesando...' : '🚀 Generar Reporte Oficial'}
                            </button>
                        </div>
                    </form>
                )}
            </div>
            <p className="mt-8 text-white/20 text-[9px] font-black tracking-[0.4em] uppercase italic">Sistema Centralizado WUOTTO • Seguridad Bancaria</p>
        </div>
    )
}