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

    // EVIDENCIAS Y VERSIONES
    const [evidenciasTecnico, setEvidenciasTecnico] = useState<any[]>([]);
    const [versiones, setVersiones] = useState<any[]>([]);
    const [subiendoFoto, setSubiendoFoto] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // COMENTARIOS
    const [nuevoComentario, setNuevoComentario] = useState('');
    const [historialComentarios, setHistorialComentarios] = useState(ticket.comentarios || '');

    // PARSEO DE DATOS ESTRUCTURADOS
    const parts = (ticket.tipo_mantenimiento || "").split('|');
    const empresaTxt = parts[1] || "N/A";
    const clienteTxt = parts[2] || "N/A";
    const sucursalUbicacion = parts[3] || "";
    const sucursalContacto = parts[4] || "";

    const esFinalizado = ['EJECUTADO', 'CERRADO', 'CANCELADO'].includes(nuevoEstatus?.toUpperCase());
    const puedeEditar = (!esFinalizado || modoEdicion) && horaInicio;

    useEffect(() => {
        loadData();
    }, [ticket.id]);

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
        if (!diagnostico || evidenciasTecnico.length === 0) {
            return alert("⚠️ Error: Se requiere un Diagnóstico y al menos 1 Foto de evidencia.");
        }
        
        const msg = modoEdicion ? "¿Guardar corrección y generar nueva versión?" : "¿Finalizar servicio y registrar en historial?";
        if (!confirm(msg)) return;

        setCargandoBtn(true);
        try {
            const coords = await getCoords();
            const fechaFin = new Date().toISOString();
            
            const { error: hErr } = await supabase.from('historial_versiones').insert({
                ticket_id: ticket.id,
                hallazgos, diagnostico, materiales, recomendaciones,
                evidencias_snapshot: evidenciasTecnico,
                creado_por: usuarioActivo,
                razon_cambio: modoEdicion ? `Corrección: ${motivoCorreccion}` : "Cierre inicial"
            });
            if (hErr) throw hErr;

            const { error: sErr } = await supabase.from('servicios').update({ 
                hora_fin: fechaFin, estatus: 'EJECUTADO',
                hallazgos, diagnostico, materiales, recomendaciones, ubicacion_gps: coords 
            }).eq('id', ticket.id);
            if (sErr) throw sErr;

            setHoraFin(fechaFin);
            setNuevoEstatus('EJECUTADO');
            setModoEdicion(false);
            setMotivoCorreccion('');
            
            await loadData(); 
            setActiveTab('versiones'); 
            
            if (onUpdate) onUpdate();
            alert("✅ Registro guardado exitosamente en el historial.");
            
        } catch (err: any) {
            alert(`❌ Error: ${err.message || "No se pudo cerrar"}`);
        } finally { setCargandoBtn(false); }
    };

    const habilitarCorreccion = () => {
        const motivo = prompt("⚠️ MOTIVO DE LA CORRECCIÓN (Obligatorio):");
        if (!motivo || motivo.trim().length < 5) return alert("Motivo requerido para editar.");
        setMotivoCorreccion(motivo);
        setModoEdicion(true);
    };

    // --- RENDERIZADO DE FICHA TÉCNICA (ESTILO IMAGEN 2) ---
    const renderDetalleEjecutivo = () => {
        const rawText = ticket.detalle_problema || "";
        
        // Función para limpiar texto de etiquetas duplicadas
        const cleanContent = (text: string) => text.replace(/📍|👤|📝|📷|Ubicación:|Contacto:|Reporte:|EVIDENCIA VISUAL:/g, '').trim();

        const blocks = [
            { icon: "📍", title: "Ubicación:", content: sucursalUbicacion || rawText.match(/📍 Ubicación: (.*)/)?.[1] },
            { icon: "👤", title: "Contacto:", content: sucursalContacto || rawText.match(/👤 Contacto: (.*)/)?.[1] },
            { icon: "📝", title: "Reporte:", content: rawText.match(/📝 Reporte: (.*)/)?.[1] || cleanContent(rawText.split('📷')[0]) },
            { icon: "📷", title: "EVIDENCIA VISUAL:", content: rawText.match(/📷 EVIDENCIA VISUAL: (.*)/)?.[1] || rawText.match(/https?:\/\/[^\s]+/)?.[0], isLink: true }
        ];

        return (
            <div className="flex flex-col gap-6 mt-4">
                {blocks.filter(b => b.content && b.content.trim() !== "").map((block, idx) => (
                    <div key={idx} className="group">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="w-10 h-10 rounded-2xl bg-slate-50 flex items-center justify-center shadow-sm text-lg group-hover:scale-110 transition-transform">
                                {block.icon}
                            </div>
                            <span className="text-[11px] font-black text-slate-800 uppercase tracking-tighter">{block.title}</span>
                        </div>
                        <div className="pl-14">
                            {block.isLink ? (
                                <a href={block.content} target="_blank" rel="noopener noreferrer"
                                   className="inline-flex items-center gap-2 bg-blue-600 text-white px-5 py-2 rounded-xl text-[10px] font-black hover:bg-blue-700 shadow-lg transition-all active:scale-95">
                                   🔗 VER EVIDENCIA DIGITAL
                                </a>
                            ) : (
                                <p className="text-[11px] text-slate-500 italic normal-case leading-relaxed">
                                    {block.content}
                                </p>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        );
    };

    const handleFoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files?.[0]) return;
        setSubiendoFoto(true);
        try {
            const file = e.target.files[0];
            const compressed = await compressImage(file);
            const finalFile = new File([compressed], file.name, { type: 'image/jpeg' });
            const name = `evid-${ticket.id}-${Date.now()}.jpg`;
            await supabase.storage.from('evidencias').upload(name, finalFile);
            const { data: { publicUrl } } = supabase.storage.from('evidencias').getPublicUrl(name);
            const { data: nuevaEv } = await supabase.from('evidencias').insert({ ticket_id: ticket.id, url_foto: publicUrl, descripcion: "", autor_email: usuarioActivo }).select().single();
            if(nuevaEv) setEvidenciasTecnico(prev => [...prev, nuevaEv]);
            if (onUpdate) onUpdate();
        } catch (e) { alert("Error al subir"); }
        setSubiendoFoto(false);
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
        <div className="fixed inset-0 bg-[#121c32]/85 backdrop-blur-md flex justify-center items-center z-[100] font-sans uppercase p-4 animate-in fade-in duration-300">
            <div className="bg-slate-50 w-full max-w-6xl h-fit max-h-[92vh] min-h-[650px] rounded-[3rem] overflow-hidden flex flex-col shadow-2xl border border-white/20">
                
                {/* Header */}
                <div className="bg-[#121c32] p-8 flex justify-between items-center text-white shrink-0 shadow-lg">
                    <div className="flex-1 text-center pl-10">
                        <div className="flex justify-center items-center gap-4">
                            <h2 className="text-4xl font-black italic tracking-tighter">{ticket.codigo_servicio}</h2>
                            <span className={`text-[10px] font-black px-4 py-1.5 rounded-full ${getStatusStyles(nuevoEstatus).badge}`}>{nuevoEstatus}</span>
                        </div>
                        <p className="text-[10px] font-bold opacity-60 mt-2 tracking-widest uppercase">Gestión de Servicio</p>
                    </div>
                    <button onClick={onClose} className="hover:bg-white/10 rounded-full p-3 text-2xl transition-all hover:rotate-90">✕</button>
                </div>

                {/* Tabs */}
                <div className="flex border-b bg-white text-[10px] font-black px-8 shadow-sm">
                    <button onClick={()=>setActiveTab('info')} className={`flex-1 py-5 border-b-4 transition-all ${activeTab==='info'?'border-blue-600 text-blue-600':'border-transparent text-slate-400'}`}>GENERAL & ASIGNACIÓN</button>
                    <button onClick={()=>setActiveTab('reporte')} className={`flex-1 py-5 border-b-4 transition-all ${activeTab==='reporte'?'border-blue-600 text-blue-600':'border-transparent text-slate-400'}`}>REPORTE TÉCNICO</button>
                    <button onClick={()=>setActiveTab('versiones')} className={`flex-1 py-5 border-b-4 transition-all ${activeTab==='versiones'?'border-blue-600 text-blue-600':'border-transparent text-slate-400'}`}>HISTORIAL ({versiones.length})</button>
                </div>

                <div className="flex-1 overflow-y-auto p-8 bg-slate-100/50">
                    {activeTab === 'info' ? (
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                            <div className="lg:col-span-7 space-y-6">
                                <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm">
                                    <div className="flex justify-between border-b border-slate-100 pb-4 mb-6">
                                        <div><label className="text-[8px] font-black text-slate-400 block mb-1 uppercase tracking-tighter">Empresa</label><p className="text-sm font-black text-[#121c32]">{empresaTxt}</p></div>
                                        <div className="text-right"><label className="text-[8px] font-black text-slate-400 block mb-1 uppercase tracking-tighter">Cliente</label><p className="text-sm font-black text-blue-600">{clienteTxt}</p></div>
                                    </div>
                                    <div className="bg-white p-6 rounded-3xl border-2 border-slate-50 shadow-inner min-h-[300px]">
                                        <div className="relative flex items-center justify-center mb-8">
                                            <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-blue-100"></span></div>
                                            <span className="relative bg-white px-6 text-[10px] font-black text-blue-500 tracking-[0.3em] uppercase">Ficha Técnica</span>
                                        </div>
                                        {renderDetalleEjecutivo()}
                                    </div>
                                </div>
                                <div className="bg-white p-8 rounded-[2.5rem] border shadow-sm grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-4">
                                        <h3 className="text-[9px] font-black text-blue-600 uppercase">Asignación</h3>
                                        {rolUsuario === 'admin' && (
                                            <>
                                                <select value={nuevoEstatus} onChange={(e)=>setNuevoEstatus(e.target.value)} className="w-full p-3 bg-indigo-50 border-2 border-indigo-100 rounded-2xl font-black text-xs outline-none">
                                                    <option value="SIN ASIGNAR">⚪ SIN ASIGNAR</option><option value="ASIGNADO">🔵 ASIGNADO</option><option value="EN PROCESO">🟠 EN PROCESO</option><option value="PENDIENTE">🔴 PENDIENTE</option><option value="EJECUTADO">🟢 EJECUTADO</option><option value="CERRADO">🌳 CERRADO</option><option value="CANCELADO">⚫ CANCELADO</option>
                                                </select>
                                                <select value={nuevoCoordinador} onChange={(e)=>setNuevoCoordinador(e.target.value)} className="w-full p-3 bg-slate-50 border rounded-2xl font-bold text-xs outline-none">
                                                    <option value="">-- COORDINADOR --</option>{perfiles.filter((p:any)=>p.rol==='coordinador').map((p:any)=><option key={p.email} value={p.email}>{p.email}</option>)}
                                                </select>
                                            </>
                                        )}
                                        <select value={nuevoOperativo} onChange={(e)=>setNuevoOperativo(e.target.value)} className="w-full p-3 bg-slate-50 border rounded-2xl font-bold text-xs outline-none">
                                            <option value="">-- OPERATIVO --</option>{perfiles.filter((p:any)=>p.rol==='operativo').map((p:any)=><option key={p.email} value={p.email}>{p.email}</option>)}
                                        </select>
                                    </div>
                                    <div className="flex items-end">
                                        <button onClick={guardarAsignacion} className="w-full py-4 bg-[#121c32] text-white rounded-2xl font-black text-[10px] hover:bg-blue-600 transition-all shadow-md uppercase active:scale-95">Guardar Cambios</button>
                                    </div>
                                </div>
                            </div>
                            <div className="lg:col-span-5 h-full">
                                <div className="bg-white p-8 rounded-[2.5rem] border flex flex-col h-[520px] shadow-sm">
                                    <h3 className="text-[10px] font-black text-slate-400 mb-4 uppercase tracking-widest italic">💬 Comentarios</h3>
                                    <div className="flex-1 bg-slate-50 p-6 rounded-3xl overflow-y-auto text-[11px] mb-4 shadow-inner normal-case leading-relaxed">{historialComentarios || "Sin comentarios."}</div>
                                    <div className="flex gap-2">
                                        <input type="text" value={nuevoComentario} onChange={(e)=>setNuevoComentario(e.target.value)} className="flex-1 p-4 border rounded-2xl text-xs normal-case outline-none" placeholder="Mensaje..." />
                                        <button onClick={agregarComentario} className="bg-blue-600 text-white px-6 rounded-2xl font-black text-xs hover:bg-blue-700 shadow-lg transition-all">ENVIAR</button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : activeTab === 'reporte' ? (
                        <div className="max-w-5xl mx-auto space-y-6 pb-10">
                            {esFinalizado && !modoEdicion && (
                                <div className="flex gap-4">
                                    <button onClick={()=>generarPDF(ticket, evidenciasTecnico)} className="flex-1 py-5 bg-emerald-600 text-white rounded-[2rem] font-black text-xs shadow-xl uppercase tracking-widest hover:bg-emerald-700 transition-all">📥 Descargar Reporte PDF</button>
                                    <button onClick={habilitarCorreccion} className="bg-white border-2 border-amber-500 text-amber-600 px-8 rounded-[2rem] font-black text-[10px] uppercase transition-all hover:bg-amber-50">🔓 Editar Reporte</button>
                                </div>
                            )}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div className="bg-white p-4 rounded-2xl border text-center shadow-sm"><p className="text-[7px] font-black text-slate-400 mb-1 uppercase">Inicio</p><p className="text-[10px] font-black text-blue-600">{horaInicio ? formatDate(horaInicio) : '--:--'}</p></div>
                                <div className="bg-white p-4 rounded-2xl border text-center shadow-sm"><p className="text-[7px] font-black text-slate-400 mb-1 uppercase">Fin</p><p className="text-[10px] font-black text-blue-600">{horaFin ? formatDate(horaFin) : '--:--'}</p></div>
                                <div className="bg-[#121c32] p-4 rounded-2xl text-center col-span-2 shadow-lg"><p className="text-[7px] font-black text-blue-300 mb-1 uppercase tracking-widest">Folio</p><p className="text-[11px] font-black text-white italic">{ticket.codigo_servicio}</p></div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="bg-white p-6 rounded-[2.5rem] border shadow-sm space-y-4">
                                    <div><label className="text-[9px] font-black text-slate-400 uppercase mb-2 block ml-2">Hallazgos</label><textarea value={hallazgos} onChange={(e)=>setHallazgos(e.target.value)} disabled={!puedeEditar} className="w-full p-4 bg-slate-50 border-none rounded-3xl text-xs normal-case min-h-[120px] outline-none" /></div>
                                    <div><label className="text-[9px] font-black text-slate-400 uppercase mb-2 block ml-2">Diagnóstico Técnico</label><textarea value={diagnostico} onChange={(e)=>setDiagnostico(e.target.value)} disabled={!puedeEditar} className="w-full p-4 bg-slate-50 border-none rounded-3xl text-xs normal-case min-h-[120px] outline-none" /></div>
                                </div>
                                <div className="bg-white p-6 rounded-[2.5rem] border shadow-sm space-y-4">
                                    <div><label className="text-[9px] font-black text-slate-400 uppercase mb-2 block ml-2">Materiales</label><textarea value={materiales} onChange={(e)=>setMateriales(e.target.value)} disabled={!puedeEditar} className="w-full p-4 bg-slate-50 border-none rounded-3xl text-xs normal-case min-h-[120px] outline-none" /></div>
                                    <div><label className="text-[9px] font-black text-slate-400 uppercase mb-2 block ml-2">Recomendaciones</label><textarea value={recomendaciones} onChange={(e)=>setRecomendaciones(e.target.value)} disabled={!puedeEditar} className="w-full p-4 bg-slate-50 border-none rounded-3xl text-xs normal-case min-h-[120px] outline-none" /></div>
                                </div>
                            </div>
                            <div className="bg-white p-8 rounded-[3rem] border shadow-sm">
                                <div className="flex justify-between items-center mb-6 px-4">
                                    <h3 className="text-[11px] font-black text-[#121c32] uppercase tracking-widest">Evidencias Fotográficas</h3>
                                    {puedeEditar && (<button onClick={()=>fileInputRef.current?.click()} className="text-[10px] font-black text-blue-600 bg-blue-50 px-6 py-2 rounded-full hover:bg-blue-100 transition-all">{subiendoFoto ? 'CARGANDO...' : '+ Foto'}</button>)}
                                    <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFoto} />
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">{evidenciasTecnico.map(e => (<div key={e.id} className="p-4 border-2 border-slate-50 rounded-[2.5rem] flex gap-5 bg-slate-50/50 items-center"><img src={e.url_foto} className="w-24 h-24 object-cover rounded-3xl shadow-md cursor-pointer hover:scale-110 transition-all" onClick={()=>window.open(e.url_foto)} /><div className="flex-1"><label className="text-[7px] font-black text-slate-400 block mb-1 uppercase">Descripción</label><textarea value={e.descripcion || ''} onChange={async (ev)=> { const val = ev.target.value; await supabase.from('evidencias').update({ descripcion: val }).eq('id', e.id); setEvidenciasTecnico(evidenciasTecnico.map(x => x.id === e.id ? { ...x, descripcion: val } : x)); }} readOnly={!puedeEditar} className="w-full p-2 text-[10px] bg-white rounded-xl h-16 normal-case outline-none transition-all" /></div></div>))}</div>
                            </div>
                            {!horaInicio && (<button onClick={async () => { if (!confirm("¿Iniciar servicio?")) return; setCargandoBtn(true); const coords = await getCoords(); const start = new Date().toISOString(); await supabase.from('servicios').update({ hora_inicio: start, estatus: 'EN PROCESO', ubicacion_gps: coords }).eq('id', ticket.id); setHoraInicio(start); setNuevoEstatus('EN PROCESO'); setCargandoBtn(false); if(onUpdate) onUpdate(); }} disabled={cargandoBtn} className="w-full py-6 bg-blue-600 text-white rounded-[2.5rem] font-black text-sm shadow-xl active:scale-95 transition-all uppercase tracking-widest">▶ Iniciar Servicio</button>)}
                            {puedeEditar && (<button onClick={finalizarServicio} disabled={cargandoBtn} className="w-full py-6 bg-emerald-600 text-white rounded-[2.5rem] font-black text-sm shadow-xl active:scale-95 transition-all uppercase tracking-widest">{modoEdicion ? '✅ Guardar Cambios y Registrar Versión' : '✅ Finalizar y Registrar en Historial'}</button>)}
                        </div>
                    ) : (
                        <div className="max-w-4xl mx-auto space-y-4 animate-in fade-in">
                            {versiones.map((v) => (
                                <div key={v.id} className="bg-white p-6 rounded-[2rem] border shadow-sm flex justify-between items-center px-10 hover:shadow-md transition-all">
                                    <div className="flex-1">
                                        <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Snapshot: {formatDate(v.fecha_version)}</p>
                                        <p className="text-[11px] text-slate-800 font-black normal-case mt-1">{v.razon_cambio}</p>
                                        <p className="text-[9px] text-slate-400 mt-1 uppercase tracking-tighter">Autor: {v.creado_por}</p>
                                    </div>
                                    <button onClick={()=>generarPDF({...ticket, hallazgos: v.hallazgos, diagnostico: v.diagnostico, materiales: v.materiales, recomendaciones: v.recomendaciones}, v.evidencias_snapshot || [], true)} className="bg-[#121c32] text-white px-6 py-2.5 rounded-xl text-[9px] font-black shadow-md uppercase hover:bg-blue-600 transition-all">Ver PDF</button>
                                </div>
                            ))}
                            {versiones.length === 0 && <div className="text-center py-20 text-slate-300 font-black italic uppercase text-lg opacity-40 tracking-widest">Sin versiones registradas</div>}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};