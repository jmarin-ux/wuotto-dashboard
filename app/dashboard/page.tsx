'use client'
import { useEffect, useState, useMemo, useRef } from 'react'
import { supabase } from '../../lib/supabaseClient' 
import { useRouter } from 'next/navigation' 
import jsPDF from 'jspdf' 

// ====================================================================
// 1. TIPOS Y CONFIGURACIÓN
// ====================================================================
interface Ticket {
    id: number;
    codigo_servicio: string;
    estatus: string;
    fecha_solicitud: string;
    tipo_mantenimiento: string | null;
    detalle_problema: string | null;
    coordinador: string | null;
    personal_operativo: string | null;
    comentarios: string | null;
    hora_inicio: string | null;
    hora_fin: string | null;
    diagnostico: string | null;
    materiales: string | null;
    recomendaciones: string | null;
}

interface Perfil {
    email: string;
    rol: 'admin' | 'coordinador' | 'operativo';
    nombre_completo: string | null;
}

interface Evidencia {
    id: number;
    url_foto: string;
    descripcion: string;
    creado_en: string;
}

const MESES = ["ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO", "JULIO", "AGOSTO", "SEPTIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE"];

const getStatusStyles = (estatus: string) => {
    const s = (estatus || '').toUpperCase().replace(/\s/g, '');
    if (['CERRADO', 'CIERREADMINISTRATIVO', 'EJECUTADO'].includes(s)) 
        return { badge: 'bg-emerald-100 text-emerald-700 border-emerald-100', dot: 'bg-emerald-500', ribbon: 'bg-emerald-600' };
    if (['ENPROCESO', 'REVISIONCONTROLINTERNO'].includes(s)) 
        return { badge: 'bg-amber-100 text-amber-700 border-amber-100', dot: 'bg-amber-500', ribbon: 'bg-amber-500' };
    if (['ASIGNADO', 'QA'].includes(s)) 
        return { badge: 'bg-indigo-50 text-indigo-700 border-indigo-100', dot: 'bg-indigo-500', ribbon: 'bg-indigo-600' };
    if (['PENDIENTE'].includes(s)) 
        return { badge: 'bg-rose-50 text-rose-700 border-rose-100', dot: 'bg-rose-500', ribbon: 'bg-rose-500' };
    if (s === 'TOTAL') return { badge: '', dot: 'bg-slate-500', ribbon: 'bg-slate-700' };
    return { badge: 'bg-slate-50 text-slate-700 border-slate-100', dot: 'bg-slate-500', ribbon: 'bg-slate-600' };
}

// ====================================================================
// 2. GENERADOR DE PDF
// ====================================================================
const generarPDF = (ticket: Ticket, evidencias: Evidencia[], esSnapshot = false) => {
    try {
        const doc = new jsPDF();
        const [servicio, empresa, cliente] = (ticket.tipo_mantenimiento || "").split('|');
        
        // Encabezado
        doc.setFillColor(18, 28, 50); 
        doc.rect(0, 0, 210, 30, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(18);
        doc.setFont("helvetica", "bold");
        doc.text("REPORTE DE SERVICIO", 10, 15);
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.text(`FOLIO: ${ticket.codigo_servicio}`, 10, 22);
        if(esSnapshot) doc.text("(VERSIÓN HISTÓRICA)", 150, 22);

        // Datos
        doc.setTextColor(0, 0, 0);
        let y = 40;
        
        const agregarDato = (titulo: string, valor: string, x: number) => {
            doc.setFont("helvetica", "bold"); doc.text(titulo, x, y);
            doc.setFont("helvetica", "normal"); doc.text(valor || "N/A", x, y + 5);
        };

        agregarDato("CLIENTE:", cliente, 10);
        agregarDato("SUCURSAL:", empresa, 70);
        agregarDato("FECHA:", new Date(ticket.fecha_solicitud).toLocaleDateString(), 140);
        y += 15;

        doc.setFont("helvetica", "bold"); doc.text("PROBLEMA REPORTADO:", 10, y); y+=5;
        doc.setFont("helvetica", "normal"); 
        const splitProb = doc.splitTextToSize(ticket.detalle_problema || "Sin detalle", 190);
        doc.text(splitProb, 10, y);
        y += (splitProb.length * 5) + 10;

        // Cuerpo Técnico
        doc.setLineWidth(0.5); doc.setDrawColor(200); doc.line(10, y, 200, y); y += 10;
        
        const secciones = [
            { t: "DIAGNÓSTICO TÉCNICO:", v: ticket.diagnostico },
            { t: "MATERIALES UTILIZADOS:", v: ticket.materiales },
            { t: "RECOMENDACIONES:", v: ticket.recomendaciones }
        ];

        secciones.forEach(sec => {
            doc.setFont("helvetica", "bold"); doc.text(sec.t, 10, y); y+=5;
            doc.setFont("helvetica", "normal");
            const splitTxt = doc.splitTextToSize(sec.v || "---", 190);
            doc.text(splitTxt, 10, y);
            y += (splitTxt.length * 5) + 5;
        });

        // Tiempos
        y += 5;
        doc.setFillColor(240, 240, 240); doc.rect(10, y, 190, 15, 'F');
        doc.setFont("helvetica", "bold");
        doc.text(`INICIO: ${ticket.hora_inicio ? new Date(ticket.hora_inicio).toLocaleString() : '--'}`, 15, y+10);
        doc.text(`FIN: ${ticket.hora_fin ? new Date(ticket.hora_fin).toLocaleString() : '--'}`, 110, y+10);
        y += 25;

        // Evidencias (Links)
        if (y > 250) { doc.addPage(); y = 20; }
        doc.setFont("helvetica", "bold"); doc.text("EVIDENCIAS FOTOGRÁFICAS:", 10, y); y += 10;

        evidencias.forEach((ev, i) => {
            if (y > 270) { doc.addPage(); y = 20; }
            doc.setFontSize(9);
            doc.setTextColor(0, 0, 0);
            doc.text(`${i+1}. ${ev.descripcion}`, 10, y);
            doc.setTextColor(0, 0, 255);
            doc.textWithLink("[CLIC PARA VER FOTO]", 10, y + 5, { url: ev.url_foto });
            y += 12;
        });

        doc.save(`REPORTE_${ticket.codigo_servicio}.pdf`);
    } catch (e: any) {
        alert("Error generando PDF: " + e.message);
    }
};

// ====================================================================
// 3. MODAL DETALLE (ESTILO EJECUTIVO + FUNCIONALIDAD)
// ====================================================================
const ModalDetalle = ({ ticket, onClose, perfiles, usuarioActivo, rolUsuario }: { ticket: Ticket, onClose: () => void, perfiles: Perfil[], usuarioActivo: string, rolUsuario: string }) => {
    if (!ticket) return null;

    const [cargando, setCargando] = useState(false);
    const [activeTab, setActiveTab] = useState<'info' | 'reporte' | 'versiones'>('info');
    const [modoEdicion, setModoEdicion] = useState(false);

    // Form States
    const [diagnostico, setDiagnostico] = useState(ticket.diagnostico || '');
    const [materiales, setMateriales] = useState(ticket.materiales || '');
    const [recomendaciones, setRecomendaciones] = useState(ticket.recomendaciones || '');
    const [evidencias, setEvidencias] = useState<Evidencia[]>([]);
    const [versiones, setVersiones] = useState<any[]>([]);
    
    // Admin States
    const [nuevoEstatus, setNuevoEstatus] = useState(ticket.estatus);
    const [nuevoCoordinador, setNuevoCoordinador] = useState(ticket.coordinador || '');
    const [nuevoOperativo, setNuevoOperativo] = useState(ticket.personal_operativo || '');
    
    const [subiendoFoto, setSubiendoFoto] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const load = async () => {
            const { data: e } = await supabase.from('evidencias').select('*').eq('ticket_id', ticket.id).order('creado_en', { ascending: true });
            setEvidencias(e || []);
            const { data: v } = await supabase.from('historial_versiones').select('*').eq('ticket_id', ticket.id).order('fecha_version', { ascending: false });
            setVersiones(v || []);
        };
        load();
    }, [ticket.id]);

    // --- ACCIONES ---
    const iniciarServicio = async () => {
        if (!confirm("¿Iniciar reloj de servicio?")) return;
        setCargando(true);
        await supabase.from('servicios').update({ hora_inicio: new Date().toISOString(), estatus: 'EN PROCESO' }).eq('id', ticket.id);
        window.location.reload();
    };

    const finalizarServicio = async () => {
        if (!diagnostico || evidencias.length === 0) return alert("⚠️ Requerido: Diagnóstico y al menos 1 Foto.");
        if (!confirm("¿Finalizar y Cerrar reporte?")) return;
        setCargando(true);
        await supabase.from('servicios').update({ 
            hora_fin: new Date().toISOString(), estatus: 'EJECUTADO', diagnostico, materiales, recomendaciones 
        }).eq('id', ticket.id);
        window.location.reload();
    };

    const habilitarCorreccion = async () => {
        const razon = prompt("Motivo de la corrección:");
        if (!razon) return;
        setCargando(true);
        await supabase.from('historial_versiones').insert({
            ticket_id: ticket.id, diagnostico_guardado: diagnostico, materiales_guardado: materiales,
            recomendaciones_guardado: recomendaciones, evidencias_snapshot: evidencias, creado_por: usuarioActivo, razon_cambio: razon
        });
        setModoEdicion(true);
        setCargando(false);
        alert("🔓 Edición habilitada.");
    };

    const guardarCambios = async (esCorreccion = false) => {
        setCargando(true);
        const updates: any = { diagnostico, materiales, recomendaciones };
        if (!esCorreccion) { 
            updates.estatus = nuevoEstatus;
            updates.coordinador = nuevoCoordinador;
            updates.personal_operativo = nuevoOperativo;
        }
        await supabase.from('servicios').update(updates).eq('id', ticket.id);
        alert("✅ Guardado exitosamente.");
        window.location.reload();
    };

    const handleFoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files?.[0]) return;
        setSubiendoFoto(true);
        const file = e.target.files[0];
        const name = `${ticket.id}-${Date.now()}.${file.name.split('.').pop()}`;
        // Aseguramos subida
        const { error } = await supabase.storage.from('evidencias').upload(name, file);
        if(error) { alert("Error subiendo: " + error.message); setSubiendoFoto(false); return; }
        
        const { data: { publicUrl } } = supabase.storage.from('evidencias').getPublicUrl(name);
        const desc = prompt("Descripción:") || "Evidencia";
        const { data } = await supabase.from('evidencias').insert({ ticket_id: ticket.id, url_foto: publicUrl, descripcion: desc, autor_email: usuarioActivo }).select().single();
        if(data) setEvidencias([...evidencias, data]);
        setSubiendoFoto(false);
    };

    // UI Helpers
    const [servicio, empresa, cliente] = (ticket.tipo_mantenimiento || "").split('|');
    const esFinalizado = !!ticket.hora_fin;
    const editable = (!esFinalizado || modoEdicion);

    return (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex justify-center items-center z-[100] p-4 font-sans uppercase">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col animate-in fade-in zoom-in duration-200">
                
                {/* 1. HEADER LIMPIO */}
                <div className="bg-[#121c32] px-6 py-5 flex justify-between items-center text-white shrink-0">
                    <div>
                        <div className="flex items-center gap-3">
                            <h2 className="text-2xl font-black italic tracking-tight">{ticket.codigo_servicio}</h2>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded text-black ${getStatusStyles(ticket.estatus).badge}`}>{ticket.estatus}</span>
                        </div>
                        <p className="text-[10px] text-slate-400 font-bold tracking-widest mt-1 opacity-80">PANEL DE CONTROL DE SERVICIO</p>
                    </div>
                    <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-lg">✕</button>
                </div>

                {/* 2. TABS ELEGANTES */}
                <div className="flex border-b border-slate-200 bg-white shrink-0 px-6">
                    {['info', 'reporte', 'versiones'].map((tab) => {
                        if (tab === 'versiones' && !esFinalizado) return null;
                        const active = activeTab === tab;
                        return (
                            <button key={tab} onClick={()=>setActiveTab(tab as any)} 
                                className={`py-4 px-4 text-[10px] font-black tracking-widest border-b-2 transition-all ${active ? 'border-[#0055b8] text-[#0055b8]' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>
                                {tab === 'info' ? 'DETALLES GENERALES' : tab === 'reporte' ? 'REPORTE TÉCNICO' : `HISTORIAL (${versiones.length})`}
                            </button>
                        )
                    })}
                </div>

                {/* 3. CONTENIDO SCROLLABLE */}
                <div className="p-6 overflow-y-auto bg-slate-50 flex-1">
                    
                    {/* >>> TAB INFO (DISEÑO DE FILAS EJECUTIVAS) <<< */}
                    {activeTab === 'info' && (
                        <div className="space-y-6">
                            
                            {/* Tarjeta de Datos */}
                            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                                <div className="bg-slate-50 px-5 py-3 border-b border-slate-100">
                                    <h3 className="text-[10px] font-black text-slate-500 tracking-widest">FICHA DEL SERVICIO</h3>
                                </div>
                                <div className="p-5 grid grid-cols-1 md:grid-cols-3 gap-6">
                                    <div className="md:col-span-3 pb-4 border-b border-slate-100">
                                        <span className="text-[9px] font-bold text-slate-400 block mb-1">TIPO DE SERVICIO</span>
                                        <p className="text-sm font-black text-[#0055b8]">{servicio || "GENERAL"}</p>
                                    </div>
                                    <div><span className="text-[9px] font-bold text-slate-400 block mb-1">CLIENTE</span><p className="text-xs font-bold text-slate-700">{cliente || "N/A"}</p></div>
                                    <div><span className="text-[9px] font-bold text-slate-400 block mb-1">EMPRESA / SUCURSAL</span><p className="text-xs font-bold text-slate-700">{empresa || "N/A"}</p></div>
                                    <div><span className="text-[9px] font-bold text-slate-400 block mb-1">FECHA SOLICITUD</span><p className="text-xs font-bold text-slate-700">{new Date(ticket.fecha_solicitud).toLocaleDateString()}</p></div>
                                    <div className="md:col-span-3 bg-blue-50/50 rounded-lg p-3 border border-blue-100">
                                        <span className="text-[9px] font-bold text-blue-400 block mb-1">DETALLE DEL PROBLEMA REPORTADO</span>
                                        <p className="text-[10px] font-medium text-slate-600 normal-case leading-relaxed">{ticket.detalle_problema || "Sin detalles adicionales."}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Tarjeta Admin */}
                            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                                <div className="bg-slate-50 px-5 py-3 border-b border-slate-100">
                                    <h3 className="text-[10px] font-black text-slate-500 tracking-widest">ASIGNACIÓN Y CONTROL</h3>
                                </div>
                                <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-6 items-end">
                                    <div className="space-y-1">
                                        <label className="text-[9px] font-bold text-slate-400">ESTATUS DEL TICKET</label>
                                        <select value={nuevoEstatus} onChange={(e)=>setNuevoEstatus(e.target.value)} disabled={rolUsuario==='operativo'} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold outline-none focus:border-blue-500">
                                            {["SIN ASIGNAR", "ASIGNADO", "EN PROCESO", "EJECUTADO", "CERRRADO", "CANCELADO"].map(o=><option key={o} value={o}>{o}</option>)}
                                        </select>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[9px] font-bold text-slate-400">COORDINADOR</label>
                                        <select value={nuevoCoordinador} onChange={(e)=>setNuevoCoordinador(e.target.value)} disabled={rolUsuario==='operativo'} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold outline-none focus:border-blue-500">
                                            <option value="">-- SIN ASIGNAR --</option>
                                            {perfiles.filter(p=>p.rol==='coordinador').map(p=><option key={p.email} value={p.email}>{p.email}</option>)}
                                        </select>
                                    </div>
                                    {rolUsuario !== 'operativo' && (
                                        <div className="md:col-span-2 pt-2">
                                            <button onClick={()=>guardarCambios(false)} disabled={cargando} className="w-full py-3 bg-[#121c32] text-white rounded-lg text-[10px] font-black tracking-widest hover:bg-[#0055b8] transition-colors">
                                                GUARDAR CAMBIOS ADMINISTRATIVOS
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* >>> TAB REPORTE <<< */}
                    {activeTab === 'reporte' && (
                        <div className="space-y-6">
                            {/* Alerta de Estado */}
                            {esFinalizado && !modoEdicion && (
                                <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-xl flex justify-between items-center shadow-sm">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 text-lg">✓</div>
                                        <div><p className="text-[10px] font-black text-emerald-800">REPORTE FINALIZADO</p><p className="text-[9px] font-medium text-emerald-600">Este servicio ha concluido.</p></div>
                                    </div>
                                    <div className="flex gap-2">
                                        <button onClick={()=>generarPDF(ticket, evidencias)} className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-[9px] font-black shadow-lg shadow-emerald-200 hover:bg-emerald-700 active:scale-95">📥 DESCARGAR PDF</button>
                                        <button onClick={habilitarCorreccion} className="bg-white text-emerald-700 px-4 py-2 rounded-lg text-[9px] font-black border border-emerald-200 shadow-sm hover:bg-emerald-50">🔓 CORREGIR</button>
                                    </div>
                                </div>
                            )}

                            {/* Reloj */}
                            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex justify-between items-center">
                                <div>
                                    <p className="text-[9px] font-bold text-slate-400 tracking-widest">TIEMPO DE EJECUCIÓN</p>
                                    <div className="flex gap-4 mt-1">
                                        <p className="text-xs font-black text-slate-700">INICIO: <span className="text-[#0055b8]">{ticket.hora_inicio ? new Date(ticket.hora_inicio).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : '--:--'}</span></p>
                                        <p className="text-xs font-black text-slate-700">FIN: <span className="text-[#0055b8]">{ticket.hora_fin ? new Date(ticket.hora_fin).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : '--:--'}</span></p>
                                    </div>
                                </div>
                                {!ticket.hora_inicio && <button onClick={iniciarServicio} className="bg-blue-600 text-white px-5 py-2 rounded-lg text-[10px] font-black shadow-lg shadow-blue-200 hover:bg-blue-700 active:scale-95 transition-all">▶ INICIAR RELOJ</button>}
                                {ticket.hora_inicio && !ticket.hora_fin && <div className="px-3 py-1 bg-amber-100 text-amber-700 rounded text-[9px] font-black animate-pulse">EN CURSO</div>}
                            </div>

                            {/* Formulario Operativo */}
                            {ticket.hora_inicio && (
                                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-5">
                                    <div className="space-y-1">
                                        <label className="text-[9px] font-black text-slate-400 tracking-widest">DIAGNÓSTICO Y ACCIONES REALIZADAS</label>
                                        <textarea value={diagnostico} onChange={(e)=>setDiagnostico(e.target.value)} disabled={!editable} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-[11px] font-medium focus:bg-white focus:border-blue-500 outline-none transition-colors" rows={4} placeholder="Describe detalladamente el trabajo realizado..." />
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-1">
                                            <label className="text-[9px] font-black text-slate-400 tracking-widest">MATERIALES UTILIZADOS</label>
                                            <textarea value={materiales} onChange={(e)=>setMateriales(e.target.value)} disabled={!editable} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-[11px] font-medium focus:bg-white focus:border-blue-500 outline-none transition-colors" rows={3} placeholder="Lista de materiales..." />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[9px] font-black text-slate-400 tracking-widest">RECOMENDACIONES</label>
                                            <textarea value={recomendaciones} onChange={(e)=>setRecomendaciones(e.target.value)} disabled={!editable} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-[11px] font-medium focus:bg-white focus:border-blue-500 outline-none transition-colors" rows={3} placeholder="Sugerencias para el cliente..." />
                                        </div>
                                    </div>
                                    
                                    {/* Evidencias */}
                                    <div className="border-t border-slate-100 pt-4">
                                        <div className="flex justify-between items-center mb-3">
                                            <label className="text-[9px] font-black text-slate-400 tracking-widest">EVIDENCIA FOTOGRÁFICA</label>
                                            {editable && <button onClick={()=>fileInputRef.current?.click()} className="text-[9px] font-bold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-full hover:bg-blue-100 transition-colors border border-blue-100">{subiendoFoto ? 'CARGANDO...' : '+ AGREGAR FOTO'}</button>}
                                            <input type="file" accept="image/*" ref={fileInputRef} className="hidden" onChange={handleFoto} />
                                        </div>
                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                            {evidencias.map(e => (
                                                <div key={e.id} className="aspect-square rounded-lg overflow-hidden relative group cursor-pointer border border-slate-200 shadow-sm hover:shadow-md transition-shadow" onClick={()=>window.open(e.url_foto)}>
                                                    <img src={e.url_foto} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                                                    <div className="absolute bottom-0 w-full bg-gradient-to-t from-black/80 to-transparent p-2 pt-4">
                                                        <p className="text-[8px] text-white text-center font-bold truncate">{e.descripcion}</p>
                                                    </div>
                                                </div>
                                            ))}
                                            {evidencias.length === 0 && <div className="col-span-2 sm:col-span-4 py-8 text-center text-[10px] text-slate-400 italic bg-slate-50 rounded-lg border border-dashed border-slate-200">No hay fotos cargadas aún</div>}
                                        </div>
                                    </div>

                                    {/* Footer Botones */}
                                    <div className="flex gap-3 pt-2">
                                        {editable && !esFinalizado && <button onClick={()=>guardarCambios(true)} className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl text-[10px] font-black hover:bg-slate-200 transition-colors">GUARDAR AVANCE</button>}
                                        {modoEdicion && <button onClick={()=>guardarCambios(true)} className="flex-1 py-3 bg-amber-500 text-black rounded-xl text-[10px] font-black hover:bg-amber-400 shadow-lg shadow-amber-200">GUARDAR CORRECCIÓN</button>}
                                        {!esFinalizado && <button onClick={finalizarServicio} className="flex-1 py-3 bg-emerald-600 text-white rounded-xl text-[10px] font-black hover:bg-emerald-700 shadow-lg shadow-emerald-200 transition-transform active:scale-95">FINALIZAR SERVICIO</button>}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                     {/* TAB HISTORIAL */}
                     {activeTab === 'versiones' && (
                        <div className="space-y-4">
                            {versiones.map((v) => (
                                <div key={v.id} className="bg-slate-50 border border-slate-200 p-4 rounded-xl flex justify-between items-center">
                                    <div>
                                        <p className="text-[10px] font-black text-purple-700">VERSIÓN DEL {new Date(v.fecha_version).toLocaleDateString()}</p>
                                        <p className="text-[9px] text-slate-500 font-medium">Motivo: {v.razon_cambio}</p>
                                    </div>
                                    <button 
                                        onClick={()=>generarPDF({ ...ticket, diagnostico: v.diagnostico_guardado, materiales: v.materiales_guardado, recomendaciones: v.recomendaciones_guardado }, v.evidencias_snapshot || [], true)} 
                                        className="text-[9px] font-bold text-blue-600 border border-blue-200 bg-white px-3 py-1.5 rounded-lg hover:bg-blue-50"
                                    >
                                        📄 DESCARGAR PDF HISTÓRICO
                                    </button>
                                </div>
                            ))}
                            {versiones.length === 0 && <p className="text-center text-[10px] text-slate-300 font-bold py-10">NO HAY CAMBIOS REGISTRADOS</p>}
                        </div>
                     )}
                </div>
            </div>
        </div>
    );
};

// ====================================================================
// 4. DASHBOARD PAGE
// ====================================================================
export default function DashboardPage() {
    const ahora = new Date();
    const [servicios, setServicios] = useState<Ticket[]>([]);
    const [perfiles, setPerfiles] = useState<Perfil[]>([]);
    const [cargando, setCargando] = useState(true);
    const [rolUsuario, setRolUsuario] = useState('');
    const [usuarioActivo, setUsuarioActivo] = useState('');
    const [ticketSeleccionado, setTicketSeleccionado] = useState<Ticket | null>(null);
    const [filtroMes, setFiltroMes] = useState<string>(ahora.getMonth().toString());
    const [filtroAnio, setFiltroAnio] = useState<string>(ahora.getFullYear().toString());
    const [filtroEstatus, setFiltroEstatus] = useState<string | null>(null); 
    const [filtroCoordinador, setFiltroCoordinador] = useState<string | null>(null); 
    const router = useRouter();

    useEffect(() => {
        const user = localStorage.getItem('USUARIO_ACTIVO');
        if (!user) router.replace('/login');
        else loadData(user);
    }, []);

    const loadData = async (email: string) => {
        setCargando(true);
        const { data: p } = await supabase.from('perfiles').select('*').eq('email', email).single();
        setRolUsuario(p?.rol || 'operativo');
        const { data: allP } = await supabase.from('perfiles').select('*');
        setPerfiles(allP || []);
        setUsuarioActivo((localStorage.getItem('TECNICO_SESION') || email).toUpperCase());
        
        let q = supabase.from('servicios').select('*');
        if (p?.rol === 'coordinador') q = q.eq('coordinador', email);
        else if (p?.rol === 'operativo') q = q.eq('personal_operativo', email);
        const { data: s } = await q.order('fecha_solicitud', { ascending: false });
        setServicios(s || []);
        setCargando(false);
    };

    const periodos = useMemo(() => {
        const a = new Set<string>(); const m: any = {};
        servicios.forEach(s => { 
            if(!s.fecha_solicitud) return; 
            const d = new Date(s.fecha_solicitud); 
            a.add(d.getFullYear().toString());
            if(!m[d.getFullYear()]) m[d.getFullYear()]=new Set();
            m[d.getFullYear()].add(d.getMonth());
        });
        return { anios: Array.from(a).sort().reverse(), meses: m };
    }, [servicios]);

    const { grouped, stats, statsCoord, total, serviciosEnCurso } = useMemo(() => {
        const filtered = servicios.filter(s => {
            const d = new Date(s.fecha_solicitud);
            return (filtroMes==='all' || d.getMonth().toString()===filtroMes) && d.getFullYear().toString()===filtroAnio;
        });
        
        // Servicios EN CURSO (Lógica para el carrusel superior)
        const enCurso = servicios.filter(s => s.hora_inicio && !s.hora_fin);

        // Stats Equipo
        const sc: any = {};
        filtered.forEach(s => { const c = (s.coordinador||'SIN ASIGNAR').toUpperCase(); sc[c]=(sc[c]||0)+1; });

        // Filtrado Final
        let visible = filtered;
        if(filtroCoordinador) visible = visible.filter(s => (s.coordinador||'').toUpperCase() === filtroCoordinador);

        // Agrupar
        const g: any = {};
        const st: any = { "SIN ASIGNAR":0,"ASIGNADO":0,"EN PROCESO":0,"PENDIENTE":0,"EJECUTADO":0,"REVISION CONTROL INTERNO":0,"QA":0,"CIERRE ADMINISTRATIVO":0,"CERRRADO":0,"CANCELADO":0 };
        visible.forEach(s => {
            let status = (s.estatus||'SIN ASIGNAR').toUpperCase().trim();
            if(!st.hasOwnProperty(status)) status="SIN ASIGNAR";
            st[status]++;
            if(filtroEstatus && status !== filtroEstatus) return;
            if(!g[status]) g[status]=[];
            g[status].push(s);
        });

        return { grouped: g, stats: st, statsCoord: sc, total: visible.length, serviciosEnCurso: enCurso };
    }, [servicios, filtroAnio, filtroMes, filtroEstatus, filtroCoordinador]);

    if (cargando) return <div className="h-screen w-screen bg-[#0f172a] flex items-center justify-center text-white font-black animate-pulse">CARGANDO WUOTTO...</div>;

    return (
        <div className="h-screen w-full flex flex-col bg-[#f8fafc] text-black font-sans antialiased uppercase overflow-hidden">
            {/* Header */}
            <header className="flex-none bg-white border-b border-slate-200 px-6 py-3 flex justify-between items-center shadow-sm z-50">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-[#121c32] rounded flex items-center justify-center text-white font-black italic">W</div>
                    <h1 className="text-lg font-black italic tracking-tighter">Wuotto</h1>
                </div>
                <div className="text-right">
                    <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-[9px] font-black tracking-widest block mb-0.5">{rolUsuario}</span>
                    <p className="text-[9px] text-slate-500 font-bold">{usuarioActivo}</p>
                </div>
            </header>

            {/* ZONA DE PRIORIDAD: SERVICIOS EN CURSO */}
            {serviciosEnCurso.length > 0 && (
                <div className="flex-none bg-[#121c32] text-white px-6 py-3 shadow-lg z-40 flex items-center gap-4 overflow-x-auto no-scrollbar">
                    <div className="flex items-center gap-2 shrink-0 animate-pulse">
                        <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                        <span className="text-[10px] font-black tracking-widest">EN CURSO ({serviciosEnCurso.length})</span>
                    </div>
                    {serviciosEnCurso.map(s => (
                        <div key={s.id} onClick={()=>setTicketSeleccionado(s)} className="shrink-0 bg-white/10 hover:bg-white/20 px-4 py-2 rounded-lg cursor-pointer border border-white/10 transition-colors flex flex-col justify-center min-w-[200px]">
                            <p className="text-[9px] font-bold text-blue-200 mb-0.5">{s.codigo_servicio}</p>
                            <p className="text-[10px] font-black truncate max-w-[180px]">{s.tipo_mantenimiento?.split('|')[2] || "MANTENIMIENTO"}</p>
                            <p className="text-[8px] opacity-70 mt-1">INICIÓ: {new Date(s.hora_inicio!).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</p>
                        </div>
                    ))}
                </div>
            )}

            {/* Filtros Premium */}
            <div className="flex-none bg-[#f8fafc] px-6 pt-6 pb-2 z-40 relative flex flex-col gap-4">
                <div className="flex justify-between items-center bg-white p-3 rounded-2xl border border-slate-200 shadow-sm">
                    <div className="flex gap-4">
                        <select value={filtroAnio} onChange={(e)=>{setFiltroAnio(e.target.value); setFiltroMes('all')}} className="bg-slate-50 border-none rounded-lg text-xs font-black p-2 cursor-pointer hover:bg-slate-100">
                            {periodos.anios.map(a=><option key={a} value={a}>{a}</option>)}
                        </select>
                        <select value={filtroMes} onChange={(e)=>setFiltroMes(e.target.value)} className="bg-slate-50 border-none rounded-lg text-xs font-black p-2 cursor-pointer hover:bg-slate-100">
                            <option value="all">TODO EL AÑO</option>
                            {Array.from(periodos.meses[filtroAnio]||[]).map((m:any)=><option key={m} value={m}>{MESES[m]}</option>)}
                        </select>
                        {(filtroEstatus || filtroCoordinador) && (
                            <button onClick={()=>{setFiltroEstatus(null); setFiltroCoordinador(null)}} className="bg-rose-50 text-rose-600 px-4 rounded-lg text-[9px] font-black hover:bg-rose-100 transition-colors">LIMPIAR</button>
                        )}
                    </div>
                    {/* Botón visual (la descarga real es dentro del ticket) */}
                    <div className="text-[8px] font-bold text-slate-400">FILTRANDO {total} REGISTROS</div>
                </div>

                {/* Filtro Equipo (Burbujas) */}
                {rolUsuario === 'admin' && (
                    <div className="overflow-x-auto pb-2 no-scrollbar">
                        <div className="flex gap-2">
                            <button onClick={()=>setFiltroCoordinador(null)} className={`px-4 py-1.5 rounded-full border transition-all text-[9px] font-bold ${!filtroCoordinador ? 'bg-slate-800 text-white border-slate-800 shadow-md' : 'bg-white text-slate-500 border-slate-200'}`}>TODOS</button>
                            {Object.entries(statsCoord).map(([c, n]: any) => (
                                <button key={c} onClick={()=>setFiltroCoordinador(c)} className={`flex items-center gap-2 px-3 py-1 rounded-full border transition-all group ${filtroCoordinador===c ? 'bg-blue-600 text-white border-blue-600 shadow-md' : 'bg-white text-slate-500 border-slate-200 hover:border-blue-300'}`}>
                                    <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-black ${filtroCoordinador===c ? 'bg-white text-blue-600' : 'bg-slate-100 text-slate-400 group-hover:text-blue-500'}`}>{n}</div>
                                    <span className="text-[9px] font-bold">{c.split('@')[0]}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Listones Estatus */}
                <div className="flex gap-4 overflow-x-auto pb-4 pt-2 no-scrollbar snap-x px-1">
                    <div className="flex-none flex flex-col items-center cursor-pointer group w-20 snap-start" onClick={()=>setFiltroEstatus(null)}>
                         <div className={`w-16 h-20 ${getStatusStyles('TOTAL').ribbon} rounded-b-2xl flex items-center justify-center text-white text-xl font-black shadow-lg transform transition-all group-hover:-translate-y-1`}>{total}</div>
                         <span className="mt-3 text-[8px] font-black text-slate-400 tracking-widest">TOTAL</span>
                    </div>
                    {Object.entries(stats).map(([k, v]: any) => (
                        <div key={k} className="flex-none flex flex-col items-center cursor-pointer group w-20 snap-start" onClick={()=>setFiltroEstatus(k)}>
                            <div className={`w-16 h-20 ${getStatusStyles(k).ribbon} rounded-b-2xl flex items-center justify-center text-white text-xl font-black shadow-lg transform transition-all group-hover:-translate-y-1 ${filtroEstatus===k ? 'ring-4 ring-slate-200 translate-y-1' : ''}`}>{v}</div>
                            <span className={`mt-3 text-[8px] font-black tracking-widest text-center h-6 flex items-center leading-none ${filtroEstatus===k ? 'text-blue-600' : 'text-slate-400'}`}>{k.replace(/\s/g, ' ')}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Grid */}
            <main className="flex-1 overflow-y-auto px-6 pb-20 pt-2 scroll-smooth">
                <div className="space-y-8">
                    {Object.entries(grouped).map(([st, items]: any) => (
                        <div key={st}>
                            <div className="flex items-center gap-3 mb-4 sticky top-0 bg-[#f8fafc]/95 backdrop-blur-sm py-2 z-10 border-b border-slate-100">
                                <div className={`w-2.5 h-2.5 rounded-full ${getStatusStyles(st).dot}`}></div>
                                <h2 className="text-xs font-black text-slate-700 tracking-widest">{st} <span className="bg-slate-200 text-slate-600 px-2 py-0.5 rounded ml-2">{items.length}</span></h2>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                {items.map((t: Ticket) => (
                                    <div key={t.id} onClick={()=>setTicketSeleccionado(t)} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer group relative overflow-hidden">
                                        <div className={`absolute top-0 right-0 px-3 py-1.5 rounded-bl-xl text-[7px] font-black tracking-widest ${getStatusStyles(t.estatus).badge}`}>{t.estatus}</div>
                                        <div className="space-y-2 mt-2">
                                            <p className="text-[9px] font-mono text-slate-400">PRJ: {t.codigo_servicio}</p>
                                            <h3 className="text-[11px] font-black text-slate-800 line-clamp-2 leading-tight min-h-[2.5em]">{t.tipo_mantenimiento?.split('|')[2] || "MANTENIMIENTO GENERAL"}</h3>
                                            <p className="text-[9px] text-slate-500 font-medium line-clamp-2">{t.tipo_mantenimiento?.split('|')[0]}</p>
                                        </div>
                                        <div className="mt-4 pt-3 border-t border-slate-50 flex justify-between items-center">
                                            <span className="text-[9px] font-bold text-slate-400">📅 {t.fecha_solicitud?.split('T')[0]}</span>
                                            <span className="text-[8px] font-black text-blue-600 bg-blue-50 px-2 py-1 rounded group-hover:bg-blue-600 group-hover:text-white transition-colors">VER DETALLE →</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                    {total === 0 && <div className="text-center py-20 text-slate-300 font-black text-xl">NO HAY TICKETS EN ESTA VISTA</div>}
                </div>
            </main>

            {ticketSeleccionado && <ModalDetalle ticket={ticketSeleccionado} onClose={()=>setTicketSeleccionado(null)} perfiles={perfiles} usuarioActivo={usuarioActivo} rolUsuario={rolUsuario} />}
        </div>
    );
}