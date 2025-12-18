'use client'
import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { supabase } from '../../lib/supabaseClient' 
import { compressImage } from '../../lib/imageUtils'
import { generarPDF } from '../../lib/pdfGenerator'
import { getStatusStyles, formatDate } from '../../lib/utils'

export const ModalDetalle = ({ ticket, onClose, onUpdate, perfiles, usuarioActivo, rolUsuario }: any) => {
    const [activeTab, setActiveTab] = useState('info');
    const [cargandoBtn, setCargandoBtn] = useState(false);
    const [modoEdicion, setModoEdicion] = useState(false);
    const [motivoCorreccion, setMotivoCorreccion] = useState('');
    
    const [hallazgos, setHallazgos] = useState(ticket.hallazgos || '');
    const [diagnostico, setDiagnostico] = useState(ticket.diagnostico || '');
    const [materiales, setMateriales] = useState(ticket.materiales || '');
    const [recomendaciones, setRecomendaciones] = useState(ticket.recomendaciones || '');
    
    const [nuevoEstatus, setNuevoEstatus] = useState(ticket.estatus);
    const [horaInicio, setHoraInicio] = useState(ticket.hora_inicio);
    const [horaFin, setHoraFin] = useState(ticket.hora_fin);
    
    const [nuevoCoordinador, setNuevoCoordinador] = useState(ticket.coordinador || '');
    const [nuevoOperativo, setNuevoOperativo] = useState(ticket.personal_operativo || '');

    const [evidenciasTecnico, setEvidenciasTecnico] = useState<any[]>([]);
    const [versiones, setVersiones] = useState<any[]>([]);
    const [subiendoFoto, setSubiendoFoto] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [nuevoComentario, setNuevoComentario] = useState('');
    const [historialComentarios, setHistorialComentarios] = useState(ticket.comentarios || '');

    // OPTIMIZACIÓN: Ya no dependemos del split para datos críticos
    const sData = useMemo(() => {
        const p = (ticket.tipo_mantenimiento || "").split('|');
        return { 
            tipo: p[0]?.trim() || "N/A", 
            sucursal: ticket.ubicacion || "N/A", 
            esCritico: (p[0] || "").toUpperCase().includes("EMERGENCIA")
        };
    }, [ticket.tipo_mantenimiento, ticket.ubicacion]);

    const esFinalizado = ['EJECUTADO', 'CERRADO', 'CANCELADO'].includes(nuevoEstatus?.toUpperCase());
    const puedeEditar = (!esFinalizado || modoEdicion) && horaInicio;

    const loadData = useCallback(async () => {
        const { data: evs } = await supabase.from('evidencias').select('*').eq('ticket_id', ticket.id).order('creado_en', { ascending: true });
        const { data: vs } = await supabase.from('historial_versiones').select('*').eq('ticket_id', ticket.id).order('fecha_version', { ascending: false });
        if(evs) setEvidenciasTecnico(evs.filter(e => e.autor_email));
        if(vs) setVersiones(vs);
    }, [ticket.id]);

    useEffect(() => { loadData(); }, [loadData]);

    const getCoords = (): Promise<string> => {
        return new Promise((resolve) => {
            if (!navigator.geolocation) resolve("GPS No Soportado");
            const timeout = setTimeout(() => resolve("GPS Timeout"), 10000);
            navigator.geolocation.getCurrentPosition(
                (pos) => { clearTimeout(timeout); resolve(`${pos.coords.latitude.toFixed(6)}, ${pos.coords.longitude.toFixed(6)}`); },
                () => { clearTimeout(timeout); resolve("GPS Desactivado"); },
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
                ticket_id: ticket.id, hallazgos, diagnostico, materiales, recomendaciones,
                evidencias_snapshot: evidenciasTecnico, creado_por: usuarioActivo,
                razon_cambio: modoEdicion ? `Corrección: ${motivoCorreccion}` : "Cierre inicial"
            });
            await supabase.from('servicios').update({ 
                hora_fin: fechaFin, estatus: 'EJECUTADO',
                hallazgos, diagnostico, materiales, recomendaciones, ubicacion_gps: coords 
            }).eq('id', ticket.id);
            setHoraFin(fechaFin); setNuevoEstatus('EJECUTADO'); setModoEdicion(false);
            await loadData(); setActiveTab('versiones');
            if (onUpdate) onUpdate();
        } catch (err) { alert("Error al cerrar"); } finally { setCargandoBtn(false); }
    };

    // OPTIMIZACIÓN: Mapeo directo a columnas de Supabase con nombres exactos
    const renderDatosSolicitante = () => {
        const datos = [
            { label: "Solicitante:", val: ticket["Nombre Completo"] },
            { label: "Empresa:", val: ticket["Empresa"] },
            { label: "Puesto:", val: ticket["Puesto"] },
            { label: "Tel. Contacto:", val: ticket["Número de Contacto"] },
            { label: "Coordinador Asig:", val: ticket["Nombre de Coordinador Asignado"] }
        ];

        return (
            <div className="grid grid-cols-2 gap-3 mt-4 border-t pt-4">
                {datos.map((d, i) => (
                    <div key={i} className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 hover:bg-white transition-all">
                        <label className="text-[7px] font-black text-slate-400 uppercase block leading-none mb-1">{d.label}</label>
                        <p className="text-[9px] font-bold text-[#121c32] truncate">{d.val || '---'}</p>
                    </div>
                ))}
            </div>
        );
    };

    return (
        <div className="fixed inset-0 bg-[#121c32]/85 backdrop-blur-md flex justify-center items-center z-[100] p-2 md:p-4 animate-in fade-in duration-300">
            <div className={`bg-slate-50 w-full max-w-6xl h-full md:h-fit max-h-[96vh] md:max-h-[92vh] rounded-[1.5rem] md:rounded-[3rem] overflow-hidden flex flex-col shadow-2xl border ${sData.esCritico ? 'border-red-500/50 shadow-red-200' : 'border-white/20'}`}>
                
                {sData.esCritico && (
                    <div className="bg-red-600 text-white text-[8px] md:text-[10px] font-black py-1.5 text-center tracking-[0.3em] uppercase animate-pulse">
                        ⚠️ ATENCIÓN: SERVICIO DE EMERGENCIA CRÍTICO ⚠️
                    </div>
                )}

                <div className="bg-[#121c32] p-4 md:p-8 flex justify-between items-center text-white shrink-0 shadow-lg">
                    <div className="flex-1 text-center md:pl-10">
                        <div className="flex justify-center items-center gap-3 md:gap-4">
                            <h2 className="text-xl md:text-4xl font-black italic tracking-tighter uppercase">{ticket.codigo_servicio}</h2>
                            <span className={`text-[8px] md:text-[10px] font-black px-2 md:px-4 py-1 rounded-full ${getStatusStyles(nuevoEstatus).badge}`}>{nuevoEstatus}</span>
                        </div>
                        <p className="text-[8px] md:text-[10px] font-bold opacity-60 mt-1 md:mt-2 tracking-widest uppercase italic">Sistema de Gestión Wuotto</p>
                    </div>
                    <button onClick={onClose} className="hover:bg-white/10 rounded-full p-2 md:p-3 text-xl md:text-2xl transition-all">✕</button>
                </div>

                <div className="flex border-b bg-white text-[8px] md:text-[10px] font-black px-4 md:px-8 overflow-x-auto no-scrollbar whitespace-nowrap">
                    <button onClick={()=>setActiveTab('info')} className={`flex-1 py-4 md:py-5 border-b-4 px-4 ${activeTab==='info'?'border-blue-600 text-blue-600':'border-transparent text-slate-400'}`}>DATOS GENERALES</button>
                    <button onClick={()=>setActiveTab('reporte')} className={`flex-1 py-4 md:py-5 border-b-4 px-4 ${activeTab==='reporte'?'border-blue-600 text-blue-600':'border-transparent text-slate-400'}`}>REPORTE TÉCNICO</button>
                    <button onClick={()=>setActiveTab('versiones')} className={`flex-1 py-4 md:py-5 border-b-4 px-4 ${activeTab==='versiones'?'border-blue-600 text-blue-600':'border-transparent text-slate-400'}`}>HISTORIAL ({versiones.length})</button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 md:p-8 bg-slate-100/50">
                    {activeTab === 'info' ? (
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-8 items-start animate-in fade-in">
                            <div className="lg:col-span-7 space-y-4 md:space-y-6">
                                <div className={`bg-white p-5 md:p-8 rounded-[1.5rem] md:rounded-[2.5rem] border shadow-sm ${sData.esCritico ? 'ring-2 ring-red-100 border-red-200' : ''}`}>
                                    <div className="bg-white p-4 md:p-6 rounded-2xl md:rounded-3xl border-2 border-slate-50 shadow-inner min-h-[200px]">
                                        <div className="relative flex items-center justify-center mb-6">
                                            <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-blue-100"></span></div>
                                            <span className={`relative bg-white px-4 md:px-6 text-[9px] md:text-[10px] font-black tracking-widest uppercase italic ${sData.esCritico ? 'text-red-600' : 'text-blue-500'}`}>Expediente del Servicio</span>
                                        </div>
                                        
                                        <div className="space-y-4">
                                            <div className="flex items-start gap-3">
                                                <div className="w-8 h-8 rounded-xl bg-slate-50 flex items-center justify-center shadow-sm text-base">📍</div>
                                                <div>
                                                    <span className="text-[10px] font-black text-slate-800 uppercase tracking-tighter block">Ubicación del Servicio:</span>
                                                    <p className="text-[10px] text-slate-600 font-bold italic leading-tight">{sData.sucursal}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-start gap-3">
                                                <div className="w-8 h-8 rounded-xl bg-slate-50 flex items-center justify-center shadow-sm text-base">📝</div>
                                                <div className="w-full">
                                                    <span className="text-[10px] font-black text-slate-800 uppercase tracking-tighter block">Reporte de Falla:</span>
                                                    <p className="text-[10px] text-slate-600 italic bg-blue-50/50 p-3 rounded-xl border border-blue-100 mt-1 whitespace-pre-wrap">{ticket.detalle_problema || sData.tipo}</p>
                                                </div>
                                            </div>
                                        </div>

                                        {renderDatosSolicitante()}
                                    </div>
                                </div>
                                <div className="bg-white p-5 md:p-8 rounded-[1.5rem] md:rounded-[2.5rem] border shadow-sm grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                                    <div className="space-y-3 md:space-y-4">
                                        <h3 className="text-[8px] md:text-[9px] font-black text-blue-600 uppercase italic">Control Operativo</h3>
                                        <select value={nuevoEstatus} onChange={(e)=>setNuevoEstatus(e.target.value)} className="w-full p-2.5 md:p-3 bg-indigo-50 border-2 border-indigo-100 rounded-xl text-[10px] md:text-xs font-bold uppercase outline-none text-black">
                                            <option value="SIN ASIGNAR">⚪ SIN ASIGNAR</option><option value="ASIGNADO">🔵 ASIGNADO</option><option value="EN PROCESO">🟠 EN PROCESO</option><option value="PENDIENTE">🔴 PENDIENTE</option><option value="EJECUTADO">🟢 EJECUTADO</option><option value="CERRADO">🌳 CERRADO</option><option value="CANCELADO">⚫ CANCELADO</option>
                                        </select>
                                        <select value={nuevoCoordinador} onChange={(e)=>setNuevoCoordinador(e.target.value)} className="w-full p-2.5 md:p-3 bg-slate-50 border rounded-xl text-[10px] md:text-xs font-bold uppercase outline-none text-black">
                                            <option value="">-- SELEC. COORDINADOR --</option>
                                            {perfiles.filter((p:any)=>p.rol==='coordinador').map((p:any)=><option key={p.email} value={p.email}>{p.nombre_completo || p.email}</option>)}
                                        </select>
                                        <select value={nuevoOperativo} onChange={(e)=>setNuevoOperativo(e.target.value)} className="w-full p-2.5 md:p-3 bg-slate-50 border rounded-xl text-[10px] md:text-xs font-bold uppercase outline-none text-black">
                                            <option value="">-- SELEC. OPERATIVO --</option>
                                            {perfiles.filter((p:any)=>p.rol==='operativo').map((p:any)=><option key={p.email} value={p.email}>{p.nombre_completo || p.email}</option>)}
                                        </select>
                                    </div>
                                    <div className="flex items-end">
                                        <button onClick={async () => { setCargandoBtn(true); const { error } = await supabase.from('servicios').update({ coordinador: nuevoCoordinador, personal_operativo: nuevoOperativo, estatus: nuevoEstatus }).eq('id', ticket.id); if(!error) { alert("✅ Cambios Guardados"); if (onUpdate) onUpdate(); } setCargandoBtn(false); }} className="w-full py-3 md:py-4 bg-[#121c32] text-white rounded-xl md:rounded-2xl font-black text-[9px] md:text-[10px] hover:bg-blue-600 transition-all shadow-md uppercase italic tracking-widest">Guardar Cambios</button>
                                    </div>
                                </div>
                            </div>
                            <div className="lg:col-span-5 h-full">
                                <div className="bg-white p-5 md:p-8 rounded-[1.5rem] md:rounded-[2.5rem] border flex flex-col h-[400px] md:h-[520px] shadow-sm">
                                    <h3 className="text-[9px] md:text-[10px] font-black text-slate-400 mb-4 uppercase tracking-widest italic">💬 Historial de Comunicación</h3>
                                    <div className="flex-1 bg-slate-50 p-4 md:p-6 rounded-xl md:rounded-3xl overflow-y-auto text-[10px] md:text-[11px] mb-4 shadow-inner italic leading-relaxed text-black whitespace-pre-wrap">{historialComentarios || "Sin comentarios."}</div>
                                    <div className="flex gap-2">
                                        <input type="text" value={nuevoComentario} onChange={(e)=>setNuevoComentario(e.target.value)} className="flex-1 p-3 md:p-4 border rounded-xl md:rounded-2xl text-[10px] md:text-xs outline-none text-black" placeholder="Escribe un mensaje..." />
                                        <button onClick={async () => { if(!nuevoComentario.trim()) return; const entry = `[${new Date().toLocaleString()}] ${usuarioActivo.split('@')[0]}: ${nuevoComentario}\n---\n`; const updated = entry + (historialComentarios || ""); const { error } = await supabase.from('servicios').update({ comentarios: updated }).eq('id', ticket.id); if(!error) { setHistorialComentarios(updated); setNuevoComentario(''); if(onUpdate) onUpdate(); } }} className="bg-blue-600 text-white px-4 md:px-6 rounded-xl md:rounded-2xl font-black text-[10px] md:text-xs hover:bg-blue-700 shadow-lg transition-all uppercase italic">ENVIAR</button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="text-center py-20 font-black italic text-slate-400 uppercase">Sección en mantenimiento técnico...</div>
                    )}
                </div>
            </div>
        </div>
    );
};