'use client'
import { useState, useRef } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { compressImage } from '../../lib/imageUtils'

export default function SolicitudServicioPage() {
    // FASES: 1 = Validación, 2 = Formulario, 3 = Éxito
    const [fase, setFase] = useState(1); 
    const [buscando, setBuscando] = useState(false);
    const [enviando, setEnviando] = useState(false);
    const [terminado, setTerminado] = useState<string | null>(null);
    const [errorValidacion, setErrorValidacion] = useState('');

    // Datos del Usuario Validado
    const [usuarioValidado, setUsuarioValidado] = useState<any>(null);

    // Formulario (Solo los datos variables)
    const [formData, setFormData] = useState({
        contacto: '',
        ubicacion_sede: '',
        ubicacion_area: '',
        tipo: '',
        descripcion: ''
    });

    const fileInputRef = useRef<HTMLInputElement>(null);
    const [foto, setFoto] = useState<File | null>(null);
    const [emailInput, setEmailInput] = useState('');

    // --- PASO 1: VALIDAR CORREO (EL CANDADO) ---
    const verificarUsuario = async (e: React.FormEvent) => {
        e.preventDefault();
        setBuscando(true);
        setErrorValidacion('');

        try {
            // Buscamos en la tabla de perfiles (o clientes si tienes una tabla separada de emails autorizados)
            const { data, error } = await supabase
                .from('perfiles')
                .select('*')
                .ilike('email', emailInput.trim())
                .maybeSingle();

            if (error) throw error;

            if (data) {
                // ¡Usuario Encontrado! Pasamos a la siguiente fase
                setUsuarioValidado(data);
                // Pre-llenamos el teléfono si lo tenemos
                setFormData(prev => ({ ...prev, contacto: data.telefono || '' }));
                setFase(2);
            } else {
                setErrorValidacion('❌ Este correo no está registrado en el sistema central. Por favor contacta a administración.');
            }
        } catch (err) {
            setErrorValidacion('Error de conexión. Intenta de nuevo.');
        } finally {
            setBuscando(false);
        }
    };

    // --- PASO 2: ENVIAR REPORTE ---
    const generarTicketId = () => `SR${Math.floor(100000 + Math.random() * 900000)}`;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.tipo) return alert("Selecciona un tipo de servicio");
        
        setEnviando(true);

        try {
            const ticketID = generarTicketId();
            let urlEvidencia = '';

            // Subir Foto
            if (foto) {
                const compressed = await compressImage(foto);
                const path = `publicos/${ticketID}_${Date.now()}.jpg`;
                const { error: uploadError } = await supabase.storage.from('evidencias').upload(path, compressed);
                if (!uploadError) {
                    const { data: publicUrlData } = supabase.storage.from('evidencias').getPublicUrl(path);
                    urlEvidencia = publicUrlData.publicUrl;
                }
            }

            // Construir Ubicación Completa
            const ubicacionFinal = `${formData.ubicacion_sede} - ${formData.ubicacion_area}`;

            // Insertar usando los datos del usuario VALIDADO (No lo que escriba, sino lo que es real)
            const { error: insertError } = await supabase.from('servicios').insert({
                codigo_servicio: ticketID,
                "Empresa": usuarioValidado.empresa || 'Empresa Registrada', // Toma la empresa del perfil
                "Nombre Completo": usuarioValidado.nombre_completo, // Toma el nombre real del perfil
                "Número de Contacto": formData.contacto,
                ubicacion: ubicacionFinal,
                tipo_mantenimiento: formData.tipo,
                detalle_problema: formData.descripcion,
                evidencia_visual: urlEvidencia,
                fecha_solicitud: new Date().toISOString(),
                estatus: 'SIN ASIGNAR', 
                coordinador: '', // Activa alerta amarilla
                personal_operativo: ''
            });

            if (insertError) throw insertError;
            setTerminado(ticketID);
            setFase(3);

        } catch (error: any) {
            alert("Error al enviar: " + error.message);
        } finally {
            setEnviando(false);
        }
    };

    // --- VISTA: ÉXITO ---
    if (fase === 3) {
        return (
            <div className="min-h-screen bg-[#f4f7fa] flex items-center justify-center p-4">
                <div className="bg-white p-8 rounded-3xl shadow-xl max-w-md w-full text-center border-t-8 border-emerald-500 animate-in zoom-in duration-300">
                    <div className="text-6xl mb-4">✅</div>
                    <h2 className="text-2xl font-black text-[#121c32] mb-2">¡SOLICITUD RECIBIDA!</h2>
                    <p className="text-slate-500 text-sm mb-6">Hemos notificado a nuestro equipo central.</p>
                    <div className="bg-slate-100 p-4 rounded-xl mb-6">
                        <p className="text-xs font-bold text-slate-400 uppercase">FOLIO DE SEGUIMIENTO</p>
                        <p className="text-4xl font-black text-emerald-600 tracking-tighter mt-1">{terminado}</p>
                    </div>
                    <button onClick={() => window.location.reload()} className="w-full bg-[#121c32] text-white py-3 rounded-xl font-bold hover:bg-blue-900 transition-all">
                        FINALIZAR
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#121c32] flex flex-col items-center justify-center p-4 md:p-8">
            <div className="w-full max-w-3xl bg-white rounded-[2rem] shadow-2xl overflow-hidden">
                
                {/* Header Institucional */}
                <div className="bg-blue-600 p-6 md:p-8 text-white relative overflow-hidden">
                    <div className="relative z-10">
                        <h1 className="text-3xl font-black italic tracking-tighter">WUOTTO</h1>
                        <p className="text-blue-200 font-bold text-xs tracking-widest uppercase mt-1">Portal de Solicitud de Servicios</p>
                    </div>
                    <div className="absolute -right-10 -top-10 text-white/10 text-9xl font-black italic rotate-12">W</div>
                </div>

                {/* --- FASE 1: CANDADO DE SEGURIDAD --- */}
                {fase === 1 && (
                    <div className="p-8 md:p-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <h2 className="text-xl font-black text-[#121c32] mb-2">🔐 VALIDACIÓN DE CLIENTE</h2>
                        <p className="text-sm text-slate-500 mb-6">
                            Para evitar folios no autorizados, por favor ingresa el <b>correo electrónico registrado</b> de tu empresa.
                        </p>

                        <form onSubmit={verificarUsuario} className="space-y-4">
                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Correo Corporativo</label>
                                <input 
                                    type="email" 
                                    required 
                                    autoFocus
                                    placeholder="nombre@tuempresa.com"
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-4 font-bold text-slate-700 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-lg"
                                    value={emailInput}
                                    onChange={e => setEmailInput(e.target.value)}
                                />
                            </div>

                            {errorValidacion && (
                                <div className="space-y-3">
                                    <div className="bg-red-50 text-red-600 p-3 rounded-lg text-xs font-bold border border-red-100 flex items-center gap-2">
                                        <span>🚫</span> {errorValidacion}
                                    </div>
                                    <a href="/registro" className="block w-full text-center bg-amber-100 text-amber-800 py-2 rounded-lg text-xs font-black hover:bg-amber-200 transition-colors">
                                        ¿NO TIENES CUENTA? REGÍSTRATE AQUÍ ➜
                                    </a>
                                </div>
                            )}

                            <button 
                                type="submit" 
                                disabled={buscando}
                                className="w-full bg-[#121c32] hover:bg-blue-900 text-white font-black py-4 rounded-xl shadow-lg transition-all active:scale-95 disabled:opacity-70 flex items-center justify-center gap-2"
                            >
                                {buscando ? 'VERIFICANDO...' : 'VERIFICAR ACCESO ➜'}
                            </button>
                        </form>
                    </div>
                )}

                {/* --- FASE 2: FORMULARIO DETALLADO --- */}
                {fase === 2 && (
                    <form onSubmit={handleSubmit} className="p-6 md:p-8 space-y-6 animate-in fade-in slide-in-from-right-8 duration-500">
                        
                        {/* Datos del Solicitante (Solo Lectura) */}
                        <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 flex items-center justify-between">
                            <div>
                                <p className="text-[9px] font-black text-blue-400 uppercase tracking-widest">SOLICITANTE AUTORIZADO</p>
                                <p className="text-sm font-bold text-[#121c32]">{usuarioValidado.nombre_completo}</p>
                                <p className="text-xs text-slate-500">{usuarioValidado.email}</p>
                            </div>
                            <div className="text-2xl">👤</div>
                        </div>

                        {/* Fila 1: Ubicación Detallada */}
                        <div className="space-y-3">
                            <h3 className="text-xs font-black text-[#121c32] uppercase border-b pb-1">📍 Ubicación del Servicio</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-[9px] font-bold text-slate-400 uppercase">Sede / Sucursal *</label>
                                    <input required type="text" placeholder="Ej. Sucursal Del Valle" 
                                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 font-bold text-slate-700 outline-none focus:border-blue-500 transition-all"
                                        value={formData.ubicacion_sede} onChange={e => setFormData({...formData, ubicacion_sede: e.target.value})}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[9px] font-bold text-slate-400 uppercase">Área Específica (Piso, Sala, etc.) *</label>
                                    <input required type="text" placeholder="Ej. Piso 1 - Escritorio 4" 
                                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 font-bold text-slate-700 outline-none focus:border-blue-500 transition-all"
                                        value={formData.ubicacion_area} onChange={e => setFormData({...formData, ubicacion_area: e.target.value})}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Fila 2: Tipo de Mantenimiento (Radio Buttons Grandes) */}
                        <div className="space-y-3">
                            <h3 className="text-xs font-black text-[#121c32] uppercase border-b pb-1">🛠 Tipo de Mantenimiento *</h3>
                            <div className="space-y-2">
                                {[
                                    "Mantenimiento Correctivo Programado - Reparación de fallo no crítico",
                                    "Instalación/Montaje - Equipos nuevos o configuración inicial",
                                    "Configuración/Ajuste - Software o ajustes finos",
                                    "Visita Técnica o Levantamiento - Cotización o inspección",
                                    "Conservación de Inmueble - Electricidad, fontanería, pintura",
                                    "Mantenimiento Correctivo (EMERGENCIA) - Fallo crítico"
                                ].map((opcion) => (
                                    <label key={opcion} className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all hover:bg-slate-50 ${formData.tipo === opcion ? 'border-blue-500 bg-blue-50/50 ring-1 ring-blue-500' : 'border-slate-200'}`}>
                                        <input 
                                            type="radio" 
                                            name="tipoServicio" 
                                            className="mt-1"
                                            checked={formData.tipo === opcion}
                                            onChange={() => setFormData({...formData, tipo: opcion})}
                                        />
                                        <span className={`text-[10px] font-bold ${opcion.includes('EMERGENCIA') ? 'text-red-600' : 'text-slate-600'}`}>{opcion}</span>
                                    </label>
                                ))}
                            </div>
                        </div>

                        {/* Fila 3: Detalle del Problema */}
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Detalle del Problema *</label>
                            <p className="text-[9px] text-slate-400 mb-1">Incluye: ¿Qué falla?, ¿Dónde? y ¿Cuándo ocurrió?</p>
                            <textarea required rows={4} placeholder="Describe detalladamente la situación..." 
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-bold text-slate-700 outline-none focus:border-blue-500 focus:bg-white transition-all resize-none"
                                value={formData.descripcion} onChange={e => setFormData({...formData, descripcion: e.target.value})}
                            />
                        </div>

                        {/* Fila 4: Contacto y Foto */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Teléfono de Contacto *</label>
                                <input required type="tel" 
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-bold text-slate-700 outline-none focus:border-blue-500 transition-all"
                                    value={formData.contacto} onChange={e => setFormData({...formData, contacto: e.target.value})}
                                />
                            </div>
                            <div 
                                onClick={() => fileInputRef.current?.click()}
                                className="border-2 border-dashed border-slate-300 rounded-xl flex flex-col items-center justify-center text-slate-400 cursor-pointer hover:bg-slate-50 hover:border-blue-400 transition-all h-full min-h-[80px]"
                            >
                                {foto ? (
                                    <p className="text-xs font-bold text-blue-600">📸 {foto.name}</p>
                                ) : (
                                    <p className="text-[10px] font-bold uppercase">📷 Adjuntar Evidencia (Opcional)</p>
                                )}
                                <input 
                                    type="file" 
                                    ref={fileInputRef} 
                                    className="hidden" 
                                    accept="image/*" 
                                    onChange={(e) => { 
                                        if(e.target.files?.[0]) setFoto(e.target.files[0]); 
                                    }} 
                                />
                            </div>
                        </div>

                        <div className="flex gap-3 pt-4">
                            <button type="button" onClick={() => { setFase(1); setUsuarioValidado(null); }} className="px-6 py-3 rounded-xl font-bold text-slate-500 hover:bg-slate-100 transition-all">
                                ATRÁS
                            </button>
                            <button 
                                type="submit" 
                                disabled={enviando}
                                className="flex-1 bg-[#121c32] hover:bg-blue-900 text-white font-black py-3 rounded-xl shadow-lg transition-all active:scale-95 disabled:opacity-70 flex items-center justify-center gap-2"
                            >
                                {enviando ? 'GENERANDO...' : '🚀 GENERAR TICKET'}
                            </button>
                        </div>

                    </form>
                )}
            </div>
            <p className="mt-8 text-white/20 text-[10px] font-bold tracking-widest">SISTEMA CENTRALIZADO WUOTTO</p>
        </div>
    )
}