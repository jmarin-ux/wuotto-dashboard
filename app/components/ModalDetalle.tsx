'use client'
import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabaseClient' 
import { compressImage } from '../../lib/imageUtils'
import { generarPDF } from '../../lib/pdfGenerator'
import { getStatusStyles, formatDate } from '../../lib/utils'

export const ModalDetalle = ({ ticket, onClose, onUpdate, perfiles, usuarioActivo, rolUsuario }: any) => {
    const [activeTab, setActiveTab] = useState('info');
    const [cargandoBtn, setCargandoBtn] = useState(false);
    const [modoEdicion, setModoEdicion] = useState(false);
    const [motivoCorreccion, setMotivoCorreccion] = useState('');
    
    // CAMPOS TÉCNICOS
    const [hallazgos, setHallazgos] = useState(ticket.hallazgos || '');
    const [diagnostico, setDiagnostico] = useState(ticket.diagnostico || '');
    const [materiales, setMateriales] = useState(ticket.materiales || '');
    const [recomendaciones, setRecomendaciones] = useState(ticket.recomendaciones || '');
    const [ubicacionGps, setUbicacionGps] = useState(ticket.ubicacion_gps || '');
    
    // ESTADOS DE CONTROL
    const [nuevoEstatus, setNuevoEstatus] = useState(ticket.estatus);
    const [horaInicio, setHoraInicio] = useState(ticket.hora_inicio);
    const [horaFin, setHoraFin] = useState(ticket.hora_fin);
    
    // ASIGNACIÓN
    const [nuevoCoordinador, setNuevoCoordinador] = useState(ticket.coordinador || '');
    const [nuevoOperativo, setNuevoOperativo] = useState(ticket.personal_operativo || '');

    const [evidenciasTecnico, setEvidenciasTecnico] = useState<any[]>([]);
    const [versiones, setVersiones] = useState<any[]>([]);
    const [subiendoFoto, setSubiendoFoto] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [nuevoComentario, setNuevoComentario] = useState('');
    const [historialComentarios, setHistorialComentarios] = useState(ticket.comentarios || '');

    const parts = (ticket.tipo_mantenimiento || "").split('|');
    const empresaTxt = parts[1] || "N/A";
    const clienteTxt = parts[2] || "N/A";
    const sucursalUbicacion = parts[3] || "";
    const sucursalContacto = parts[4] || "";

    const esFinalizado = ['EJECUTADO', 'CERRADO', 'CANCELADO'].includes(nuevoEstatus?.toUpperCase());
    const puedeEditar = (!esFinalizado || modoEdicion) && horaInicio;

    useEffect(() => { loadData(); }, [ticket.id]);

    const loadData = async () => {
        const { data: evs } = await supabase.from('evidencias').select('*').eq('ticket_id', ticket.id).order('creado_en', { ascending: true });
        const { data: vs } = await supabase.from('historial_versiones').select('*').eq('ticket_id', ticket.id).order('fecha_version', { ascending: false });
        if(evs) setEvidenciasTecnico(evs.filter(e => e.autor_email));
        if(vs) setVersiones(vs);
    };

    const getCoords = (): Promise<string> => {
        return new Promise((resolve) => {
            if (!navigator.geolocation) resolve("GPS No Soportado");
            navigator.geolocation.getCurrentPosition(
                (pos) => resolve(`${pos.coords.latitude}, ${pos.coords.longitude}`),
                () => resolve("GPS Desactivado"),
                { enableHighAccuracy: true }
            );
        });
    };

    const finalizarServicio = async () => {
        if (!diagnostico || evidenciasTecnico.length === 0) return alert("⚠️ Se requiere Diagnóstico y Fotos.");
        if (!confirm(modoEdicion ? "¿Guardar corrección?" : "¿Finalizar servicio?")) return;

        setCargandoBtn(true);
        try {
            const coords = await getCoords();
            const fechaFin = new Date().toISOString();
            
            await supabase.from('historial_versiones').insert({
                ticket_id: ticket.id,
                hallazgos, diagnostico, materiales, recomendaciones,
                evidencias_snapshot: evidenciasTecnico,
                creado_por: usuarioActivo,
                razon_cambio: modoEdicion ? `Corrección: ${motivoCorreccion}` : "Cierre inicial"
            });

            await supabase.from('servicios').update({ 
                hora_fin: fechaFin, estatus: 'EJECUTADO',
                hallazgos, diagnostico, materiales, recomendaciones, ubicacion_gps: coords 
            }).eq('id', ticket.id);

            setHoraFin(fechaFin);
            setNuevoEstatus('EJECUTADO');
            setModoEdicion(false);
            await loadData(); 
            setActiveTab('versiones');
            if (onUpdate) onUpdate();
        } catch (err) { alert("Error al cerrar"); } finally { setCargandoBtn(false); }
    };

    const habilitarCorreccion = () => {
        const motivo = prompt("⚠️ MOTIVO DE LA CORRECCIÓN:");
        if (!motivo || motivo.trim().length < 5) return alert("Motivo requerido.");
        setMotivoCorreccion(motivo);
        setModoEdicion(true);
    };

    const renderDetalleEjecutivo = () => {
        const rawText = ticket.detalle_problema || "";
        const clean = (text: string) => text.replace(/📍|👤|📝|📷|Ubicación:|Contacto:|Reporte:|EVIDENCIA VISUAL:/g, '').trim();
        const blocks = [
            { icon: "📍", title: "Ubicación:", content: sucursalUbicacion || rawText.match(/📍 Ubicación: (.*)/)?.[1] },
            { icon: "👤", title: "Contacto:", content: sucursalContacto || rawText.match(/👤 Contacto: (.*)/)?.[1] },
            { icon: "📝", title: "Reporte:", content: rawText.match(/📝 Reporte: (.*)/)?.[1] || clean(rawText.split('📷')[0]) },
            { icon: "📷", title: "EVIDENCIA VISUAL:", content: rawText.match(/https?:\/\/[^\s]+/)?.[0], isLink: true }
        ];

        return (
            <div className="flex flex-col gap-5 md:gap-6 mt-4 text-black">
                {blocks.filter(b => b.content).map((b, i) => (
                    <div key={i}>
                        <div className="flex items-center gap-3 mb-1.5 md:mb-2">
                            <div className="w-8 h-8 md:w-10 md:h-10 rounded-xl md:rounded-2xl bg-slate-50 flex items-center justify-center shadow-sm text-base md:text-lg">{b.icon}</div>
                            <span className="text-[10px] md:text-[11px] font-black text-slate-800 uppercase tracking-tighter">{b.title}</span>
                        </div>
                        <div className="pl-11 md:pl-14">
                            {b.isLink ? (
                                <a href={b.content} target="_blank" rel="noopener noreferrer" className="bg-blue-600 text-white px-4 md:px-5 py-2 rounded-xl text-[9px] md:text-[10px] font-black hover:bg-blue-700 shadow-lg inline-block uppercase italic">🔗 VER EVIDENCIA</a>
                            ) : (
                                <p className="text-[10px] md:text-[11px] text-slate-500 italic normal-case leading-relaxed">{b.content}</p>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        );
    };

    const handleFoto = async (e: any) => {
        if (!e.target.files?.[0]) return;
        setSubiendoFoto(true);
        try {
            const compressed = await compressImage(e.target.files[0]);
            const name = `evid-${ticket.id}-${Date.now()}.jpg`;
            await supabase.storage.from('evidencias').upload(name, compressed);
            const { data: { publicUrl } } = supabase.storage.from('evidencias').getPublicUrl(name);
            const { data: nuevaEv } = await supabase.from('evidencias').insert({ ticket_id: ticket.id, url_foto: publicUrl, descripcion: "", autor_email: usuarioActivo }).select().single();
            if(nuevaEv) setEvidenciasTecnico(prev => [...prev, nuevaEv]);
            if (onUpdate) onUpdate();
        } catch (e) { alert("Error al subir"); } finally { setSubiendoFoto(false); }
    };

    const guardarAsignacion = async () => {
        setCargandoBtn(true);
        const { error } = await supabase.from('servicios').update({ coordinador: nuevoCoordinador, personal_operativo: nuevoOperativo, estatus: nuevoEstatus }).eq('id', ticket.id);
        if(!error) { alert("✅ Guardado"); if (onUpdate) onUpdate(); }
        setCargandoBtn(false);
    };

    const agregarComentario = async () => {
        if(!nuevoComentario.trim()) return;
        const entry = `[${new Date().toLocaleString()}] ${usuarioActivo.split('@')[0]}: ${nuevoComentario}\n---\n`;
        const updated = entry + (historialComentarios || "");
        const { error } = await supabase.from('servicios').update({ comentarios: updated }).eq('id', ticket.id);
        if(!error) { setHistorialComentarios(updated); setNuevoComentario(''); if(onUpdate) onUpdate(); }
    };

    return (
        <div className="fixed inset-0 bg-[#121c32]/85 backdrop-blur-md flex justify-center items-center z-[100] p-2 md:p-4 animate-in fade-in duration-300">
            <div className="bg-slate-50 w-full max-w-6xl h-full md:h-fit max-h-[96vh] md:max-h-[92vh] rounded-[1.5rem] md:rounded-[3rem] overflow-hidden flex flex-col shadow-2xl border border-white/20">
                
                <div className="bg-[#121c32] p-4 md:p-8 flex justify-between items-center text-white shrink-0 shadow-lg">
                    <div className="flex-1 text-center md:pl-10">
                        <div className="flex justify-center items-center gap-3 md:gap-4">
                            <h2 className="text-xl md:text-4xl font-black italic tracking-tighter uppercase">{ticket.codigo_servicio}</h2>
                            <span className={`text-[8px] md:text-[10px] font-black px-2 md:px-4 py-1 rounded-full ${getStatusStyles(nuevoEstatus).badge}`}>{nuevoEstatus}</span>
                        </div>
                        <p className="text-[8px] md:text-[10px] font-bold opacity-60 mt-1 md:mt-2 tracking-widest uppercase">Gestión de Servicio</p>
                    </div>
                    <button onClick={onClose} className="hover:bg-white/10 rounded-full p-2 md:p-3 text-xl md:text-2xl transition-all">✕</button>
                </div>

                <div className="flex border-b bg-white text-[8px] md:text-[10px] font-black px-4 md:px-8 overflow-x-auto no-scrollbar whitespace-nowrap">
                    <button onClick={()=>setActiveTab('info')} className={`flex-1 py-4 md:py-5 border-b-4 px-4 ${activeTab==='info'?'border-blue-600 text-blue-600':'border-transparent text-slate-400'}`}>GENERAL & ASIGNACIÓN</button>
                    <button onClick={()=>setActiveTab('reporte')} className={`flex-1 py-4 md:py-5 border-b-4 px-4 ${activeTab==='reporte'?'border-blue-600 text-blue-600':'border-transparent text-slate-400'}`}>REPORTE TÉCNICO</button>
                    <button onClick={()=>setActiveTab('versiones')} className={`flex-1 py-4 md:py-5 border-b-4 px-4 ${activeTab==='versiones'?'border-blue-600 text-blue-600':'border-transparent text-slate-400'}`}>HISTORIAL ({versiones.length})</button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 md:p-8 bg-slate-100/50">
                    {activeTab === 'info' ? (
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-8 items-start animate-in fade-in">
                            <div className="lg:col-span-7 space-y-4 md:space-y-6">
                                <div className="bg-white p-5 md:p-8 rounded-[1.5rem] md:rounded-[2.5rem] border shadow-sm">
                                    <div className="flex justify-between border-b pb-4 mb-4 md:mb-6">
                                        <div><label className="text-[7px] md:text-[8px] font-black text-slate-400 uppercase tracking-tighter">Empresa</label><p className="text-[11px] md:text-sm font-black text-[#121c32] line-clamp-1 uppercase">{empresaTxt}</p></div>
                                        <div className="text-right"><label className="text-[7px] md:text-[8px] font-black text-slate-400 uppercase tracking-tighter">Cliente</label><p className="text-[11px] md:text-sm font-black text-blue-600 line-clamp-1 uppercase">{clienteTxt}</p></div>
                                    </div>
                                    <div className="bg-white p-4 md:p-6 rounded-2xl md:rounded-3xl border-2 border-slate-50 shadow-inner min-h-[200px]">
                                        <div className="relative flex items-center justify-center mb-6">
                                            <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-blue-100"></span></div>
                                            <span className="relative bg-white px-4 md:px-6 text-[9px] md:text-[10px] font-black text-blue-500 tracking-widest uppercase italic">Ficha Técnica</span>
                                        </div>
                                        {renderDetalleEjecutivo()}
                                    </div>
                                </div>
                                <div className="bg-white p-5 md:p-8 rounded-[1.5rem] md:rounded-[2.5rem] border shadow-sm grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                                    <div className="space-y-3 md:space-y-4">
                                        <h3 className="text-[8px] md:text-[9px] font-black text-blue-600 uppercase">Asignación</h3>
                                        {rolUsuario === 'admin' && (
                                            <>
                                                <select value={nuevoEstatus} onChange={(e)=>setNuevoEstatus(e.target.value)} className="w-full p-2.5 md:p-3 bg-indigo-50 border-2 border-indigo-100 rounded-xl text-[10px] md:text-xs font-bold uppercase outline-none text-black">
                                                    <option value="SIN ASIGNAR">⚪ SIN ASIGNAR</option><option value="ASIGNADO">🔵 ASIGNADO</option><option value="EN PROCESO">🟠 EN PROCESO</option><option value="PENDIENTE">🔴 PENDIENTE</option><option value="EJECUTADO">🟢 EJECUTADO</option><option value="CERRADO">🌳 CERRADO</option><option value="CANCELADO">⚫ CANCELADO</option>
                                                </select>
                                                <select value={nuevoCoordinador} onChange={(e)=>setNuevoCoordinador(e.target.value)} className="w-full p-2.5 md:p-3 bg-slate-50 border rounded-xl text-[10px] md:text-xs font-bold uppercase outline-none text-black">
                                                    <option value="">-- SELEC. COORDINADOR --</option>
                                                    {perfiles.filter((p:any)=>p.rol==='coordinador').map((p:any)=><option key={p.email} value={p.email}>{p.nombre_completo || p.email}</option>)}
                                                </select>
                                            </>
                                        )}
                                        <select value={nuevoOperativo} onChange={(e)=>setNuevoOperativo(e.target.value)} className="w-full p-2.5 md:p-3 bg-slate-50 border rounded-xl text-[10px] md:text-xs font-bold uppercase outline-none text-black">
                                            <option value="">-- SELEC. OPERATIVO --</option>
                                            {perfiles.filter((p:any)=>p.rol==='operativo').map((p:any)=><option key={p.email} value={p.email}>{p.nombre_completo || p.email}</option>)}
                                        </select>
                                    </div>
                                    <div className="flex items-end">
                                        <button onClick={guardarAsignacion} className="w-full py-3 md:py-4 bg-[#121c32] text-white rounded-xl md:rounded-2xl font-black text-[9px] md:text-[10px] hover:bg-blue-600 transition-all shadow-md active:scale-95 uppercase italic">Guardar Cambios</button>
                                    </div>
                                </div>
                            </div>
                            <div className="lg:col-span-5 h-full">
                                <div className="bg-white p-5 md:p-8 rounded-[1.5rem] md:rounded-[2.5rem] border flex flex-col h-[400px] md:h-[520px] shadow-sm">
                                    <h3 className="text-[9px] md:text-[10px] font-black text-slate-400 mb-4 uppercase tracking-widest italic">💬 Comentarios</h3>
                                    <div className="flex-1 bg-slate-50 p-4 md:p-6 rounded-xl md:rounded-3xl overflow-y-auto text-[10px] md:text-[11px] mb-4 shadow-inner normal-case italic leading-relaxed tracking-tight text-black">{historialComentarios || "Sin comentarios."}</div>
                                    <div className="flex gap-2">
                                        <input type="text" value={nuevoComentario} onChange={(e)=>setNuevoComentario(e.target.value)} className="flex-1 p-3 md:p-4 border rounded-xl md:rounded-2xl text-[10px] md:text-xs normal-case outline-none text-black" placeholder="Mensaje..." />
                                        <button onClick={agregarComentario} className="bg-blue-600 text-white px-4 md:px-6 rounded-xl md:rounded-2xl font-black text-[10px] md:text-xs hover:bg-blue-700 shadow-lg transition-all uppercase italic">ENVIAR</button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : activeTab === 'reporte' ? (
                        <div className="max-w-5xl mx-auto space-y-4 md:space-y-6 pb-10 animate-in fade-in">
                            {esFinalizado && !modoEdicion && (
                                <div className="flex flex-col md:flex-row gap-3">
                                    <button onClick={()=>generarPDF(ticket, evidenciasTecnico)} className="flex-1 py-4 md:py-5 bg-emerald-600 text-white rounded-xl md:rounded-[2rem] font-black text-[10px] md:text-xs shadow-xl uppercase italic">📥 Descargar Reporte PDF</button>
                                    <button onClick={habilitarCorreccion} className="bg-white border-2 border-amber-500 text-amber-600 px-6 md:px-8 py-3 md:py-0 rounded-xl md:rounded-[2rem] font-black text-[9px] md:text-[10px] uppercase italic transition-all hover:bg-amber-50">🔓 Editar Reporte</button>
                                </div>
                            )}
                            {modoEdicion && (
                                <div className="bg-amber-50 border-2 border-amber-200 p-4 rounded-2xl mb-4 text-black">
                                    <p className="text-[9px] md:text-[10px] font-black text-amber-700 uppercase tracking-widest">⚠️ MODO EDICIÓN ACTIVO</p>
                                    <p className="text-[10px] md:text-xs text-amber-600 normal-case italic">Motivo: {motivoCorreccion}</p>
                                </div>
                            )}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4 text-black">
                                <div className="bg-white p-3 md:p-4 rounded-xl md:rounded-2xl border text-center shadow-sm"><p className="text-[6px] md:text-[7px] font-black text-slate-400 uppercase">Inicio</p><p className="text-[9px] md:text-[10px] font-black text-blue-600">{horaInicio ? formatDate(horaInicio) : '--:--'}</p></div>
                                <div className="bg-white p-3 md:p-4 rounded-xl md:rounded-2xl border text-center shadow-sm"><p className="text-[6px] md:text-[7px] font-black text-slate-400 uppercase">Fin</p><p className="text-[9px] md:text-[10px] font-black text-blue-600">{horaFin ? formatDate(horaFin) : '--:--'}</p></div>
                                <div className="bg-[#121c32] p-3 md:p-4 rounded-xl md:rounded-2xl text-center col-span-2 shadow-lg text-white"><p className="text-[6px] md:text-[7px] font-black text-blue-300 uppercase tracking-widest leading-none mb-1 italic">Folio Servicio</p><p className="text-[10px] md:text-[11px] font-black italic uppercase">{ticket.codigo_servicio}</p></div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 text-black">
                                <div className="bg-white p-4 md:p-6 rounded-[1.5rem] md:rounded-[2.5rem] border shadow-sm space-y-4">
                                    <div><label className="text-[8px] md:text-[9px] font-black text-slate-400 uppercase mb-1 ml-2 block italic">Hallazgos</label><textarea value={hallazgos} onChange={(e)=>setHallazgos(e.target.value)} disabled={!puedeEditar} className="w-full p-4 bg-slate-50 border-none rounded-2xl md:rounded-3xl text-xs normal-case min-h-[100px] md:min-h-[120px] outline-none shadow-inner" /></div>
                                    <div><label className="text-[8px] md:text-[9px] font-black text-slate-400 uppercase mb-1 ml-2 block italic">Diagnóstico Técnico</label><textarea value={diagnostico} onChange={(e)=>setDiagnostico(e.target.value)} disabled={!puedeEditar} className="w-full p-4 bg-slate-50 border-none rounded-2xl md:rounded-3xl text-xs normal-case min-h-[100px] md:min-h-[120px] outline-none shadow-inner" /></div>
                                </div>
                                <div className="bg-white p-4 md:p-6 rounded-[1.5rem] md:rounded-[2.5rem] border shadow-sm space-y-4 text-black">
                                    <div><label className="text-[8px] md:text-[9px] font-black text-slate-400 uppercase mb-1 ml-2 block italic">Materiales</label><textarea value={materiales} onChange={(e)=>setMateriales(e.target.value)} disabled={!puedeEditar} className="w-full p-4 bg-slate-50 border-none rounded-2xl md:rounded-3xl text-xs normal-case min-h-[100px] md:min-h-[120px] outline-none shadow-inner" /></div>
                                    <div><label className="text-[8px] md:text-[9px] font-black text-slate-400 uppercase mb-1 ml-2 block italic">Recomendaciones</label><textarea value={recomendaciones} onChange={(e)=>setRecomendaciones(e.target.value)} disabled={!puedeEditar} className="w-full p-4 bg-slate-50 border-none rounded-2xl md:rounded-3xl text-xs normal-case min-h-[100px] md:min-h-[120px] outline-none shadow-inner" /></div>
                                </div>
                            </div>
                            <div className="bg-white p-5 md:p-8 rounded-[1.5rem] md:rounded-[3rem] border shadow-sm text-black">
                                <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4 border-b pb-4">
                                    <h3 className="text-[10px] md:text-[11px] font-black text-[#121c32] uppercase tracking-widest text-center md:text-left italic">Evidencias Fotográficas</h3>
                                    {puedeEditar && (<button onClick={()=>fileInputRef.current?.click()} className="w-full md:w-auto text-[10px] font-black text-blue-600 bg-blue-50 px-6 py-3 md:py-2 rounded-full hover:bg-blue-100 transition-all uppercase italic">{subiendoFoto ? 'CARGANDO...' : '+ Agregar Foto'}</button>)}
                                    <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFoto} />
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                                    {evidenciasTecnico.map(e => (
                                        <div key={e.id} className="p-3 md:p-4 border-2 border-slate-50 rounded-[1.2rem] md:rounded-[2.5rem] flex flex-col sm:flex-row gap-4 md:gap-5 bg-slate-50/50 items-center sm:items-start transition-all hover:bg-slate-100/50 shadow-sm">
                                            <img src={e.url_foto} className="w-20 h-20 md:w-24 md:h-24 object-cover rounded-2xl md:rounded-3xl shadow-md cursor-pointer hover:scale-105 transition-all" onClick={()=>window.open(e.url_foto)} />
                                            <div className="flex-1 w-full">
                                                <label className="text-[7px] font-black text-slate-400 block mb-1 uppercase text-center sm:text-left tracking-tighter leading-none">Nota de imagen</label>
                                                <textarea value={e.descripcion || ''} onChange={async (ev)=> { const val = ev.target.value; await supabase.from('evidencias').update({ descripcion: val }).eq('id', e.id); setEvidenciasTecnico(evidenciasTecnico.map(x => x.id === e.id ? { ...x, descripcion: val } : x)); }} readOnly={!puedeEditar} className="w-full p-2 text-[10px] bg-white rounded-xl h-16 md:h-16 normal-case outline-none focus:ring-1 transition-all shadow-sm text-black" />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            {!horaInicio && (<button onClick={async () => { if (!confirm("¿Iniciar servicio?")) return; setCargandoBtn(true); const coords = await getCoords(); const start = new Date().toISOString(); await supabase.from('servicios').update({ hora_inicio: start, estatus: 'EN PROCESO', ubicacion_gps: coords }).eq('id', ticket.id); setHoraInicio(start); setNuevoEstatus('EN PROCESO'); setCargandoBtn(false); if(onUpdate) onUpdate(); }} disabled={cargandoBtn} className="w-full py-5 md:py-6 bg-blue-600 text-white rounded-2xl md:rounded-[2.5rem] font-black text-xs md:text-sm shadow-xl active:scale-95 transition-all uppercase tracking-widest italic">▶ Iniciar Ejecución Servicio</button>)}
                            {puedeEditar && (<button onClick={finalizarServicio} disabled={cargandoBtn} className="w-full py-5 md:py-6 bg-emerald-600 text-white rounded-2xl md:rounded-[2.5rem] font-black text-xs md:text-sm shadow-xl active:scale-95 transition-all uppercase tracking-widest italic">{modoEdicion ? '✅ Guardar Cambios y Nueva Versión' : '✅ Finalizar y Registrar en Historial'}</button>)}
                        </div>
                    ) : (
                        <div className="max-w-4xl mx-auto space-y-4 animate-in fade-in">
                            {versiones.map((v) => (
                                <div key={v.id} className="bg-white p-5 md:p-6 rounded-2xl md:rounded-[2rem] border shadow-sm flex flex-col sm:flex-row justify-between items-center gap-4 px-6 md:px-10 hover:shadow-md transition-all text-black">
                                    <div className="flex-1 text-center sm:text-left">
                                        <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Snapshot: {formatDate(v.fecha_version)}</p>
                                        <p className="text-[11px] text-slate-800 font-black normal-case mt-1 italic">{v.razon_cambio}</p>
                                        <p className="text-[9px] text-slate-400 mt-1 uppercase tracking-tighter italic">Autor: {v.creado_por}</p>
                                    </div>
                                    <button onClick={()=>generarPDF({...ticket, hallazgos: v.hallazgos, diagnostico: v.diagnostico, materiales: v.materiales, recomendaciones: v.recomendaciones}, v.evidencias_snapshot || [], true)} className="w-full sm:w-auto bg-[#121c32] text-white px-6 py-2.5 rounded-xl text-[9px] font-black shadow-md uppercase hover:bg-blue-600 transition-all italic">Ver PDF</button>
                                </div>
                            ))}
                            {versiones.length === 0 && <div className="text-center py-20 text-slate-300 font-black italic uppercase text-lg opacity-40 tracking-widest uppercase">Sin versiones registradas</div>}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};