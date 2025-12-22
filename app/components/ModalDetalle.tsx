'use client'
import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { supabase } from '../../lib/supabaseClient' 
import { compressImage } from '../../lib/imageUtils'
import { generarPDF } from '../../lib/pdfGenerator'
import { getStatusStyles, formatDate } from '../../lib/utils'

// --- FUNCIÓN DE LIMPIEZA DE LINKS MEJORADA ---
const extraerLinks = (texto: string) => {
    if (!texto || typeof texto !== 'string') return [];
    const matches = texto.match(/\bhttps?:\/\/[^\s,;"'<>()]+/gi);
    if (!matches) return [];
    return matches.map(url => url.replace(/[.,;)]+$/, ''));
};

export const ModalDetalle = ({ ticket, onClose, onUpdate, perfiles, usuarioActivo, rolUsuario }: any) => {
    const [activeTab, setActiveTab] = useState('info');
    const [cargandoBtn, setCargandoBtn] = useState(false);
    
    // --- ESTADOS DE CONTROL DE EDICIÓN ---
    const [modoEdicion, setModoEdicion] = useState(false);
    const [motivoCorreccion, setMotivoCorreccion] = useState('');
    const [servicioCerrado, setServicioCerrado] = useState(!!ticket.hora_fin);

    // Estados Técnicos
    const [hallazgos, setHallazgos] = useState(ticket.hallazgos || '');
    const [diagnostico, setDiagnostico] = useState(ticket.diagnostico || '');
    const [materiales, setMateriales] = useState(ticket.materiales || '');
    const [recomendaciones, setRecomendaciones] = useState(ticket.recomendaciones || '');
    
    // --- CORRECCIÓN DE ESTATUS (NORMALIZACIÓN) ---
    // Forzamos mayúsculas para que coincida con los <option> del select
    const [nuevoEstatus, setNuevoEstatus] = useState((ticket.estatus || 'SIN ASIGNAR').toUpperCase());
    
    // Tiempos y GPS
    const [horaInicio, setHoraInicio] = useState(ticket.hora_inicio);
    const [gpsInicio, setGpsInicio] = useState(ticket.ubicacion_gps || '');
    const [horaFin, setHoraFin] = useState(ticket.hora_fin);
    const [gpsFin, setGpsFin] = useState(ticket.ubicacion_gps_fin || '');
    
    // --- CORRECCIÓN DE ASIGNACIÓN (NORMALIZACIÓN) ---
    // Buscamos el correo en la lista de perfiles ignorando mayúsculas/minúsculas
    const coordinadorInicial = useMemo(() => {
        if (!ticket.coordinador) return '';
        const correoTicket = ticket.coordinador.trim().toLowerCase();
        // Buscamos el perfil que tenga ese correo
        const perfilEncontrado = perfiles.find((p: any) => p.email.trim().toLowerCase() === correoTicket);
        // Si existe, devolvemos el email TAL CUAL está en la base de perfiles (para que el select lo agarre)
        // Si no existe, devolvemos el del ticket original
        return perfilEncontrado ? perfilEncontrado.email : ticket.coordinador;
    }, [ticket.coordinador, perfiles]);

    const [nuevoCoordinador, setNuevoCoordinador] = useState(coordinadorInicial);
    
    // Misma lógica para Operativo
    const operativoInicial = useMemo(() => {
        if (!ticket.personal_operativo) return '';
        const correoTicket = ticket.personal_operativo.trim().toLowerCase();
        const perfilEncontrado = perfiles.find((p: any) => p.email.trim().toLowerCase() === correoTicket);
        return perfilEncontrado ? perfilEncontrado.email : ticket.personal_operativo;
    }, [ticket.personal_operativo, perfiles]);

    const [nuevoOperativo, setNuevoOperativo] = useState(operativoInicial);
    
    // Datos y Bitácora
    const [evidencias, setEvidencias] = useState<any[]>([]); 
    const [versiones, setVersiones] = useState<any[]>([]);   
    const [bitacora, setBitacora] = useState<any[]>([]);     
    const [nuevoComentario, setNuevoComentario] = useState(''); 
    const [subiendoFoto, setSubiendoFoto] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const esCritico = (ticket.tipo_mantenimiento || "").toUpperCase().includes("EMERGENCIA");
    
    // Extracción de Links
    const textoEvidencia = (ticket.evidencia_visual || '') + ' ' + (ticket.evidencia || '');
    const linksEvidencia = extraerLinks(textoEvidencia);

    // Bloqueo de campos
    const camposBloqueados = !horaInicio || (servicioCerrado && !modoEdicion);

    const loadData = useCallback(async () => {
        const { data: evs } = await supabase.from('evidencias').select('*').eq('ticket_id', ticket.id).order('creado_en', { ascending: true });
        if(evs) setEvidencias(evs);

        const { data: vs } = await supabase.from('historial_versiones').select('*').eq('ticket_id', ticket.id).order('fecha_version', { ascending: false });
        if(vs) {
            setVersiones(vs.filter((v:any) => v.evidencias_snapshot)); 
            setBitacora(vs); 
        }
    }, [ticket.id]);

    useEffect(() => { loadData(); }, [loadData]);

    const agregarComentario = async () => {
        if (!nuevoComentario.trim()) return;
        setCargandoBtn(true);
        await supabase.from('historial_versiones').insert({
            ticket_id: ticket.id,
            creado_por: usuarioActivo,
            razon_cambio: nuevoComentario,
            fecha_version: new Date().toISOString()
        });
        setNuevoComentario('');
        loadData();
        setCargandoBtn(false);
    };

    const habilitarCorreccion = () => {
        const motivo = prompt("⚠️ MODO CORRECCIÓN\n\nJustifica el cambio (Mínimo 10 caracteres):");
        if (motivo && motivo.trim().length >= 10) {
            setMotivoCorreccion(motivo);
            setModoEdicion(true);
        } else if (motivo !== null) {
            alert("❌ El motivo es muy corto.");
        }
    };

    // --- GPS ---
    const capturarGPS = (): Promise<string> => {
        return new Promise((resolve) => {
            if (!navigator.geolocation) {
                alert("Navegador no soporta GPS.");
                resolve("No Soportado");
                return;
            }
            navigator.geolocation.getCurrentPosition(
                (pos) => resolve(`${pos.coords.latitude.toFixed(6)}, ${pos.coords.longitude.toFixed(6)}`),
                (err) => { 
                    console.error(err); 
                    if(err.code === 1) resolve("Permiso Denegado");
                    else resolve("Error GPS");
                },
                { enableHighAccuracy: true, timeout: 15000 }
            );
        });
    };

    const iniciarAtencion = async () => {
        if (!confirm("¿Confirmar INICIO de servicio en sitio?")) return;
        setCargandoBtn(true);
        const coords = await capturarGPS();
        const ahora = new Date().toISOString();
        
        const { error } = await supabase.from('servicios').update({
            hora_inicio: ahora, 
            estatus: 'EN PROCESO', 
            ubicacion_gps: coords
        }).eq('id', ticket.id);
        
        if(!error) { 
            setHoraInicio(ahora); 
            setGpsInicio(coords);
            setNuevoEstatus('EN PROCESO'); 
            await supabase.from('historial_versiones').insert({
                ticket_id: ticket.id,
                creado_por: usuarioActivo,
                razon_cambio: `Inicio de Atención (GPS: ${coords})`
            });
            onUpdate(); loadData();
        } else { 
            alert("Error al guardar inicio: " + error.message); 
        }
        setCargandoBtn(false);
    };

    const finalizarServicio = async () => {
        if (!hallazgos || !diagnostico || !materiales || !recomendaciones) return alert("⚠️ Completa el reporte técnico.");
        if (evidencias.length === 0) return alert("⚠️ Sube evidencia fotográfica.");
        
        const mensaje = modoEdicion ? "¿Guardar corrección?" : "¿Finalizar y cerrar servicio?";
        if (!confirm(mensaje)) return;

        setCargandoBtn(true);
        const ahora = new Date().toISOString();
        const coordsFin = await capturarGPS();
        const razonLog = modoEdicion ? `CORRECCIÓN: ${motivoCorreccion}` : "Cierre Final de Servicio";

        await supabase.from('historial_versiones').insert({
            ticket_id: ticket.id, 
            diagnostico_guardado: diagnostico, 
            materiales_guardado: materiales,
            recomendaciones_guardado: recomendaciones, 
            evidencias_snapshot: evidencias,
            creado_por: usuarioActivo, 
            razon_cambio: razonLog
        });

        const updateData: any = {
            hallazgos, diagnostico, materiales, recomendaciones
        };

        if (!servicioCerrado) {
            updateData.hora_fin = ahora;
            updateData.estatus = 'EJECUTADO';
            updateData.ubicacion_gps = coordsFin; 
        }

        const { error } = await supabase.from('servicios').update(updateData).eq('id', ticket.id);
        
        if(!error) {
            if (!servicioCerrado) {
                setGpsFin(coordsFin);
                setHoraFin(ahora);
                setServicioCerrado(true);
            }
            setModoEdicion(false);
            setMotivoCorreccion('');
            alert("✅ Guardado correctamente.");
            onUpdate(); loadData();
        } else {
             // Fallback
             if(error.message.includes('ubicacion_gps_fin')) {
                 delete updateData.ubicacion_gps_fin;
                 updateData.ubicacion_gps = coordsFin;
                 await supabase.from('servicios').update(updateData).eq('id', ticket.id);
                 if (!servicioCerrado) { setGpsFin(coordsFin); setHoraFin(ahora); setServicioCerrado(true); }
                 setModoEdicion(false);
                 alert("✅ Guardado (GPS principal).");
                 onUpdate(); loadData();
             } else {
                 alert("Error al guardar: " + error.message);
             }
        }
        setCargandoBtn(false);
    };

    // --- TAB 1: FICHA Y BITÁCORA ---
    const renderFichaTab1 = () => (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* PANEL ADMIN (ASIGNACIÓN) */}
            <div className={`px-5 py-4 rounded-[1.5rem] shadow-lg text-white border-l-4 transition-all duration-300 ${(!nuevoCoordinador || nuevoCoordinador === "") ? 'bg-amber-500 border-amber-700' : 'bg-[#121c32] border-blue-500'}`}>
                
                {/* ALERTA VISUAL: SI NO HAY COORDINADOR */}
                {(!nuevoCoordinador || nuevoCoordinador === "") && (
                    <div className="mb-4 flex items-center justify-center gap-2 bg-black/10 p-2 rounded-lg animate-pulse">
                        <span className="text-xl">⚠️</span>
                        <p className="text-[10px] font-black uppercase tracking-widest">SERVICIO SIN COORDINADOR ASIGNADO</p>
                    </div>
                )}

                <div className="flex flex-col md:flex-row gap-4 items-end">
                    <div className="flex-1 w-full grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div className="flex flex-col gap-1">
                            <label className="text-[7px] font-bold uppercase opacity-70 tracking-wider">Estatus</label>
                            <select value={nuevoEstatus} onChange={(e)=>setNuevoEstatus(e.target.value)} className="w-full py-1.5 px-3 bg-white/10 border border-white/20 rounded-lg text-[10px] font-bold uppercase text-white outline-none">
                                <option className="text-black" value="SIN ASIGNAR">⚪ SIN ASIGNAR</option>
                                <option className="text-black" value="ASIGNADO">🔵 ASIGNADO</option>
                                <option className="text-black" value="EN PROCESO">🟡 EN PROCESO</option>
                                <option className="text-black" value="PENDIENTE">🔴 PENDIENTE</option>
                                <option className="text-black" value="EJECUTADO">🟢 EJECUTADO</option>
                                <option className="text-black" value="REVISION DE CONTROL INTERNO">🔘 REVISION</option>
                                <option className="text-black" value="CIERRE ADMINISTRATIVO">🟢 CIERRE</option>
                                <option className="text-black" value="CERRADO">🏢 CERRADO</option>
                                <option className="text-black" value="CANCELADO">⚫ CANCELADO</option>
                            </select>
                        </div>
                        {rolUsuario === 'admin' && (
                            <div className="flex flex-col gap-1">
                                <label className="text-[7px] font-bold uppercase opacity-70 tracking-wider">Coordinador</label>
                                <select value={nuevoCoordinador} onChange={(e)=>setNuevoCoordinador(e.target.value)} className="w-full py-1.5 px-3 bg-white/10 border border-white/20 rounded-lg text-[10px] font-bold uppercase text-white outline-none">
                                    <option className="text-black" value="">-- SELECCIONAR --</option>
                                    {perfiles.filter((p:any)=>p.rol==='coordinador').map((p:any)=><option key={p.email} className="text-black" value={p.email}>{p.nombre_completo || p.email}</option>)}
                                </select>
                            </div>
                        )}
                        {(rolUsuario === 'admin' || rolUsuario === 'coordinador') && (
                            <div className="flex flex-col gap-1">
                                <label className="text-[7px] font-bold uppercase opacity-70 tracking-wider">Operativo</label>
                                <select value={nuevoOperativo} onChange={(e)=>setNuevoOperativo(e.target.value)} className="w-full py-1.5 px-3 bg-white/10 border border-white/20 rounded-lg text-[10px] font-bold uppercase text-white outline-none">
                                    <option className="text-black" value="">-- SELECCIONAR --</option>
                                    {perfiles.filter((p:any)=>p.rol==='operativo').map((p:any)=><option key={p.email} className="text-black" value={p.email}>{p.nombre_completo || p.email}</option>)}
                                </select>
                            </div>
                        )}
                    </div>
                    <button 
                        onClick={async () => { 
                            setCargandoBtn(true); 
                            
                            // REGLA: Si no hay coordinador, forzar SIN ASIGNAR
                            let estatusFinal = nuevoEstatus;
                            if (!nuevoCoordinador || nuevoCoordinador === "") { 
                                estatusFinal = "SIN ASIGNAR"; 
                                setNuevoEstatus("SIN ASIGNAR"); 
                            }

                            const updates: any = { estatus: estatusFinal }; 
                            if (rolUsuario === 'admin') updates.coordinador = nuevoCoordinador; 
                            if (rolUsuario === 'admin' || rolUsuario === 'coordinador') updates.personal_operativo = nuevoOperativo; 
                            
                            await supabase.from('servicios').update(updates).eq('id', ticket.id); 
                            await supabase.from('historial_versiones').insert({ ticket_id: ticket.id, creado_por: usuarioActivo, razon_cambio: `Cambio admin: ${estatusFinal}` });
                            
                            onUpdate(); setCargandoBtn(false); loadData();
                            
                            if (estatusFinal === "SIN ASIGNAR" && nuevoEstatus !== "SIN ASIGNAR") {
                                alert("⚠️ ALERTA: Se guardó como 'SIN ASIGNAR' porque no se seleccionó un Coordinador.");
                            } else {
                                alert("✅ Sincronizado correctamente.");
                            }
                        }} 
                        className="w-full md:w-auto px-6 py-2 bg-white text-[#121c32] rounded-lg font-black text-[9px] hover:bg-slate-200 uppercase italic tracking-widest shadow-md border-b-2 border-slate-300"
                    >
                        SINCRONIZAR
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* IZQUIERDA: DATOS */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col gap-5">
                        <div className="grid grid-cols-2 gap-4 pb-4 border-b border-slate-50">
                            <CompactInfo label="Empresa" value={ticket["Empresa"]} icon="🏢" />
                            <CompactInfo label="Ubicación" value={ticket.ubicacion} icon="📍" />
                            <CompactInfo label="Solicitante" value={ticket["Nombre Completo"]} icon="👤" />
                            <CompactInfo label="Contacto" value={ticket["Número de Contacto"]} icon="📞" />
                        </div>
                        
                        <div>
                            <label className="text-[9px] font-black text-blue-600 uppercase block mb-1 tracking-widest">TIPO DE SERVICIO</label>
                            <p className="text-[10px] font-bold text-slate-700 bg-slate-50 p-3 rounded-xl border border-slate-100 leading-relaxed mb-4">
                                {ticket["tipo_mantenimiento"] || "No especificado"}
                            </p>

                            <label className="text-[9px] font-black text-blue-600 uppercase block mb-1 tracking-widest">REPORTE DEL PROBLEMA</label>
                            <p className="text-[10px] font-medium text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-100 leading-relaxed whitespace-pre-wrap">
                                {ticket.detalle_problema || ticket.detalle || "Sin detalles."}
                            </p>
                        </div>

                        {/* LINKS VIVOS */}
                        {linksEvidencia.length > 0 ? (
                            <div className="relative z-10">
                                <label className="text-[8px] font-black text-slate-400 uppercase block mb-2 tracking-widest">
                                    EVIDENCIA ADJUNTA ({linksEvidencia.length})
                                </label>
                                <div className="grid grid-cols-1 gap-2">
                                    {linksEvidencia.map((link, index) => (
                                        <div 
                                            key={index} 
                                            onClick={(e) => { e.stopPropagation(); window.open(link, '_blank', 'noopener,noreferrer'); }}
                                            className="bg-blue-50 px-4 py-3 rounded-xl border-l-4 border-blue-500 hover:bg-blue-100 transition-all flex items-center gap-3 group relative cursor-pointer shadow-sm"
                                        >
                                            <span className="text-xl">🔗</span>
                                            <div className="flex-1 overflow-hidden">
                                                <p className="text-[10px] font-bold text-blue-700 truncate underline decoration-blue-300 group-hover:text-blue-900">{link}</p>
                                            </div>
                                            <span className="text-[8px] font-black text-white bg-blue-600 px-3 py-1 rounded-full whitespace-nowrap hover:bg-blue-500">ABRIR ↗</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <div className="px-4 py-3 bg-slate-50 rounded-xl border border-slate-100 text-center border-dashed">
                                <p className="text-[9px] font-bold text-slate-400 uppercase italic">🚫 Sin evidencia visual adjunta</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* DERECHA: BITÁCORA */}
                <div className="lg:col-span-1 flex flex-col gap-4 h-full">
                    <div className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm flex-1 flex flex-col max-h-[600px]">
                        <h3 className="text-[9px] font-black text-slate-400 uppercase italic mb-3 tracking-widest border-b pb-2">Bitácora</h3>
                        <div className="flex-1 overflow-y-auto space-y-3 pr-2 mb-3">
                            {bitacora.length > 0 ? bitacora.map((b) => (
                                <div key={b.id} className="border-l-2 border-slate-200 pl-3 py-1 relative">
                                    <div className="absolute -left-[5px] top-1.5 w-2 h-2 rounded-full bg-blue-400"></div>
                                    <p className="text-[9px] font-bold text-[#121c32] leading-tight break-words">{b.razon_cambio}</p>
                                    <p className="text-[7px] text-slate-400 mt-0.5">{formatDate(b.fecha_version)} • {b.creado_por?.split('@')[0]}</p>
                                </div>
                            )) : <p className="text-center text-[8px] text-slate-300 italic py-10">Sin actividad</p>}
                        </div>
                        <div className="flex gap-2 mt-auto pt-3 border-t border-slate-50">
                            <input 
                                type="text" 
                                value={nuevoComentario} 
                                onChange={(e) => setNuevoComentario(e.target.value)}
                                placeholder="Comentario..." 
                                className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-[9px] font-bold outline-none focus:border-blue-300"
                            />
                            <button onClick={agregarComentario} disabled={!nuevoComentario.trim()} className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-[9px] font-black hover:bg-blue-500 disabled:opacity-50">OK</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );

    // --- TAB 2: REPORTE ---
    const renderReporteTab = () => (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="grid grid-cols-2 gap-4">
                <TimeGpsBox title="INICIO" time={horaInicio} gps={gpsInicio} statusColor="text-blue-600" />
                <TimeGpsBox title="CIERRE" time={horaFin} gps={gpsFin} statusColor="text-emerald-600" />
            </div>

            {!horaInicio && (
                <div className="flex justify-center py-4">
                    <button onClick={iniciarAtencion} disabled={cargandoBtn} className="bg-[#121c32] hover:bg-blue-900 text-white px-8 py-3 rounded-full font-black text-[10px] uppercase tracking-widest shadow-lg transition-all active:scale-95 border-b-4 border-blue-900 flex items-center gap-3">
                        {cargandoBtn ? <span className="animate-spin">⌛</span> : <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>}
                        {cargandoBtn ? 'REGISTRANDO...' : 'MARCAR INICIO DE SERVICIO (GPS)'}
                    </button>
                </div>
            )}

            <div className={`grid grid-cols-1 md:grid-cols-2 gap-6 transition-all duration-500 ${camposBloqueados ? 'opacity-60 pointer-events-none grayscale' : ''}`}>
                <TextArea label="Hallazgos" value={hallazgos} onChange={setHallazgos} disabled={camposBloqueados} />
                <TextArea label="Diagnóstico" value={diagnostico} onChange={setDiagnostico} disabled={camposBloqueados} />
                <TextArea label="Materiales" value={materiales} onChange={setMateriales} disabled={camposBloqueados} />
                <TextArea label="Recomendaciones" value={recomendaciones} onChange={setRecomendaciones} disabled={camposBloqueados} />
            </div>

            <div className={`bg-white p-6 rounded-[2rem] border shadow-sm transition-all duration-500 ${camposBloqueados ? 'opacity-60 pointer-events-none grayscale' : ''}`}>
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-[9px] font-black uppercase text-[#121c32]">Evidencia ({evidencias.length})</h3>
                    <button onClick={()=>fileInputRef.current?.click()} disabled={camposBloqueados} className="bg-blue-600 text-white px-4 py-2 rounded-lg font-black text-[8px] uppercase hover:bg-blue-500 shadow-md transition-all disabled:opacity-50">+ FOTO</button>
                    <input type="file" ref={fileInputRef} onChange={async (e) => { 
                        const file = e.target.files?.[0]; if(!file) return; setSubiendoFoto(true);
                        const optimized = await compressImage(file);
                        const path = `${ticket.id}/${Date.now()}.jpg`;
                        const { data } = await supabase.storage.from('evidencias').upload(path, optimized);
                        if(data){
                            const { data: { publicUrl } } = supabase.storage.from('evidencias').getPublicUrl(path);
                            await supabase.from('evidencias').insert({ ticket_id: ticket.id, url_foto: publicUrl, autor_email: usuarioActivo, descripcion: '' });
                            loadData();
                        }
                        setSubiendoFoto(false);
                    }} hidden accept="image/*" disabled={camposBloqueados} />
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {evidencias.map((ev) => (
                        <div key={ev.id} className="bg-slate-50 rounded-xl overflow-hidden border shadow-sm group">
                            <div className="aspect-square w-full relative">
                                <img src={ev.url_foto} className="w-full h-full object-cover" alt="evidencia" />
                            </div>
                            <div className="p-2 bg-white border-t">
                                <input type="text" placeholder="Nota..." value={ev.descripcion || ''} disabled={camposBloqueados} className="w-full text-[9px] font-bold bg-slate-50 border rounded px-2 py-1" onChange={async (e) => {
                                    const val = e.target.value;
                                    setEvidencias(prev => prev.map(i => i.id === ev.id ? {...i, descripcion: val} : i));
                                    await supabase.from('evidencias').update({ descripcion: val }).eq('id', ev.id);
                                }} />
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="flex justify-end pt-4 pb-10 gap-4">
                {horaInicio && (!servicioCerrado || modoEdicion) && (
                    <button onClick={finalizarServicio} disabled={cargandoBtn} className="bg-emerald-600 text-white px-8 py-3 rounded-xl font-black text-[10px] uppercase shadow-lg hover:bg-emerald-500 transition-all active:scale-95 disabled:opacity-50 border-b-4 border-emerald-800">
                        {cargandoBtn ? 'GUARDANDO...' : (modoEdicion ? '💾 GUARDAR CAMBIOS' : '🏁 FINALIZAR Y CERRAR SERVICIO')}
                    </button>
                )}
                {servicioCerrado && !modoEdicion && (
                    <button onClick={habilitarCorreccion} className="bg-amber-500 text-white px-8 py-3 rounded-xl font-black text-[10px] uppercase shadow-lg hover:bg-amber-400 transition-all active:scale-95 border-b-4 border-amber-700 flex items-center gap-2">
                        <span>✏️</span> CORREGIR REPORTE
                    </button>
                )}
            </div>
        </div>
    );

    return (
        <div className="fixed inset-0 bg-[#121c32]/95 backdrop-blur-md flex justify-center items-center z-[100] p-4 animate-in fade-in duration-300">
            <div className={`bg-[#f8fafc] w-full max-w-6xl h-full md:h-fit max-h-[96vh] rounded-[2rem] overflow-hidden flex flex-col shadow-2xl border ${esCritico ? 'border-red-500 ring-[4px] ring-red-500/30' : 'border-white/10'}`}>
                {esCritico && <div className="bg-red-600 text-white text-[7px] font-black py-1.5 text-center tracking-[0.3em] animate-pulse uppercase shadow-md z-20">⚠️ EMERGENCIA CRÍTICA ⚠️</div>}
                
                <div className="bg-[#121c32] px-6 py-4 flex justify-between items-center text-white shrink-0 relative z-10 border-b border-white/5">
                    <div className="flex-1">
                        <h2 className="text-xl md:text-3xl font-black italic tracking-tighter uppercase text-white">{ticket.codigo_servicio}</h2>
                        <div className="flex items-center gap-2 mt-1">
                            <span className={`px-3 py-0.5 rounded-full text-[7px] font-black shadow-lg ${getStatusStyles(nuevoEstatus).badge}`}>{nuevoEstatus}</span>
                        </div>
                    </div>
                    <button onClick={onClose} className="bg-white/10 hover:bg-white/20 rounded-full w-8 h-8 flex items-center justify-center text-sm transition-all border border-white/10">✕</button>
                </div>

                <div className="flex border-b border-slate-200 bg-white text-[8px] font-black px-6 overflow-x-auto no-scrollbar shrink-0 shadow-sm z-10">
                    <button onClick={()=>setActiveTab('info')} className={`flex-1 py-3 border-b-4 transition-all ${activeTab==='info'?'border-blue-600 text-blue-600 bg-blue-50/50':'border-transparent text-slate-400 hover:text-slate-600'}`}>FICHA Y BITÁCORA</button>
                    <button onClick={()=>setActiveTab('reporte')} className={`flex-1 py-3 border-b-4 transition-all ${activeTab==='reporte'?'border-blue-600 text-blue-600 bg-blue-50/50':'border-transparent text-slate-400 hover:text-slate-600'}`}>REPORTE TÉCNICO</button>
                    <button onClick={()=>setActiveTab('versiones')} className={`flex-1 py-3 border-b-4 transition-all ${activeTab==='versiones'?'border-blue-600 text-blue-600 bg-blue-50/50':'border-transparent text-slate-400 hover:text-slate-600'}`}>HISTORIAL PDF ({versiones.length})</button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-[#f8fafc]">
                    {activeTab === 'info' ? renderFichaTab1() : activeTab === 'reporte' ? renderReporteTab() : (
                        <div className="space-y-3 animate-in fade-in">
                            {versiones.length > 0 ? versiones.map((v) => (
                                <div key={v.id} className="bg-white p-4 rounded-xl border shadow-sm flex justify-between items-center hover:border-blue-200 transition-all">
                                    <div>
                                        <p className="text-[8px] font-black text-blue-600 uppercase">Versión PDF</p>
                                        <p className="text-xs font-black text-[#121c32] italic">{formatDate(v.fecha_version)}</p>
                                        <p className="text-[7px] font-bold text-slate-500 uppercase mt-1 italic">{v.razon_cambio}</p>
                                    </div>
                                    <button onClick={() => generarPDF(ticket, v, true)} className="bg-[#121c32] text-white px-4 py-1.5 rounded-lg text-[7px] font-black uppercase hover:bg-blue-600 shadow-md transition-all">VER PDF</button>
                                </div>
                            )) : <div className="text-center py-20 text-slate-300 font-bold italic text-xs">SIN HISTORIAL PDF</div>}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// --- SUB-COMPONENTS ---
const CompactInfo = ({ label, value, icon }: any) => (
    <div className="group">
        <label className="text-[7px] font-black text-slate-400 uppercase block mb-0.5 tracking-tighter flex items-center gap-1"><span>{icon}</span> {label}</label>
        <p className="text-[9px] font-bold text-[#121c32] uppercase italic truncate border-b border-transparent group-hover:border-slate-200 transition-all">{value || '---'}</p>
    </div>
);

const TimeGpsBox = ({ title, time, gps, statusColor }: any) => {
    const esCoordenada = gps && gps.includes(',') && !gps.toLowerCase().includes('error');
    return (
        <div className={`p-3 rounded-xl border bg-white shadow-sm flex flex-col justify-center items-center text-center transition-all ${time ? 'border-slate-200' : 'border-dashed border-slate-200 opacity-60'}`}>
            <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest mb-1">{title}</p>
            {time ? (
                <>
                    <p className="text-sm font-black text-[#121c32] italic">{formatDate(time)}</p>
                    {esCoordenada ? (
                        <a href={`https://www.google.com/maps/search/?api=1&query=${gps}`} target="_blank" rel="noopener noreferrer" className={`text-[7px] font-bold ${statusColor} mt-0.5 hover:underline cursor-pointer flex items-center gap-1`}>📍 VER UBICACIÓN</a>
                    ) : (
                        <p className={`text-[7px] font-bold ${statusColor} mt-0.5`}>📍 {gps || 'GPS OK'}</p>
                    )}
                </>
            ) : <p className="text-[8px] font-bold text-slate-300 uppercase italic">--</p>}
        </div>
    );
};

const TextArea = ({ label, value, onChange, disabled }: any) => (
    <div className={`bg-white p-4 rounded-xl border shadow-sm transition-all ${disabled ? 'bg-slate-50 border-slate-100' : 'hover:shadow-md border-slate-100'}`}>
        <label className={`text-[7px] font-black uppercase block mb-2 tracking-widest ${disabled ? 'text-slate-400' : 'text-blue-500'}`}>{label}</label>
        <textarea value={value} onChange={(e)=>onChange(e.target.value)} disabled={disabled} className={`w-full h-20 text-[9px] font-semibold outline-none resize-none p-2 rounded-lg border transition-all ${disabled ? 'bg-slate-50 text-slate-400 cursor-not-allowed border-slate-100' : 'text-slate-700 bg-slate-50/50 border-slate-100 focus:bg-white focus:border-blue-200'}`} />
    </div>
);