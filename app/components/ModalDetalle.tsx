'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../../lib/supabaseClient' 
import { compressImage } from '../../lib/imageUtils'
import { generarPDF } from '../../lib/pdfGenerator'
import { getStatusStyles, formatDate } from '../../lib/utils'

export const ModalDetalle = ({ ticket, onClose, onUpdate, perfiles, usuarioActivo, rolUsuario }: any) => {
    const [activeTab, setActiveTab] = useState('info');
    const [cargandoBtn, setCargandoBtn] = useState(false);
    const [modoEdicion, setModoEdicion] = useState(false);
    const [motivoCorreccion, setMotivoCorreccion] = useState('');
    
    // --- ESTADOS TÉCNICOS ---
    const [hallazgos, setHallazgos] = useState(ticket.hallazgos || '');
    const [diagnostico, setDiagnostico] = useState(ticket.diagnostico || '');
    const [materiales, setMateriales] = useState(ticket.materiales || '');
    const [recomendaciones, setRecomendaciones] = useState(ticket.recomendaciones || '');
    const [nuevoEstatus, setNuevoEstatus] = useState(ticket.estatus);
    const [horaInicio, setHoraInicio] = useState(ticket.hora_inicio);
    
    // --- ASIGNACIÓN Y EVIDENCIAS ---
    const [nuevoCoordinador, setNuevoCoordinador] = useState(ticket.coordinador || '');
    const [nuevoOperativo, setNuevoOperativo] = useState(ticket.personal_operativo || '');
    const [evidencias, setEvidencias] = useState<any[]>([]);
    const [versiones, setVersiones] = useState<any[]>([]);
    const [subiendoFoto, setSubiendoFoto] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const esCritico = (ticket.tipo_mantenimiento || "").toUpperCase().includes("EMERGENCIA");

    const loadData = useCallback(async () => {
        const { data: evs } = await supabase.from('evidencias').select('*').eq('ticket_id', ticket.id).order('creado_en', { ascending: true });
        const { data: vs } = await supabase.from('historial_versiones').select('*').eq('ticket_id', ticket.id).order('fecha_version', { ascending: false });
        if(evs) setEvidencias(evs);
        if(vs) setVersiones(vs);
    }, [ticket.id]);

    useEffect(() => { loadData(); }, [loadData]);

    const capturarGPS = (): Promise<string> => {
        return new Promise((resolve) => {
            if (!navigator.geolocation) resolve("GPS No Soportado");
            navigator.geolocation.getCurrentPosition(
                (pos) => resolve(`${pos.coords.latitude.toFixed(6)}, ${pos.coords.longitude.toFixed(6)}`),
                () => resolve("GPS Desactivado"),
                { enableHighAccuracy: true, timeout: 5000 }
            );
        });
    };

    const iniciarAtencion = async () => {
        setCargandoBtn(true);
        const coords = await capturarGPS();
        const ahora = new Date().toISOString();
        const { error } = await supabase.from('servicios').update({
            hora_inicio: ahora, estatus: 'EN PROCESO', ubicacion_gps: coords 
        }).eq('id', ticket.id);
        if(!error) { setHoraInicio(ahora); setNuevoEstatus('EN PROCESO'); onUpdate(); }
        setCargandoBtn(false);
    };

    const finalizarServicio = async () => {
        if (!diagnostico || evidencias.length === 0) return alert("⚠️ Diagnóstico y Evidencias requeridas.");
        setCargandoBtn(true);
        const coordsFin = await capturarGPS();
        const ahora = new Date().toISOString();
        await supabase.from('historial_versiones').insert({
            ticket_id: ticket.id, diagnostico_guardado: diagnostico, materiales_guardado: materiales,
            recomendaciones_guardado: recomendaciones, evidencias_snapshot: evidencias,
            creado_por: usuarioActivo, razon_cambio: modoEdicion ? motivoCorreccion : "Emisión Inicial"
        });
        await supabase.from('servicios').update({
            hora_fin: ahora, estatus: 'EJECUTADO', hallazgos, diagnostico, materiales, recomendaciones, ubicacion_gps: coordsFin
        }).eq('id', ticket.id);
        alert("✅ Servicio finalizado con éxito.");
        onUpdate(); onClose(); setCargandoBtn(false);
    };

    const renderFichaTab1 = () => (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
                <h3 className="text-[9px] font-black text-blue-600 uppercase italic mb-6 tracking-widest">Detalles del Servicio</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <DataBox label="Empresa" value={ticket["Empresa"]} icon="🏢" />
                    <DataBox label="Nombre Solicitante" value={ticket["Nombre Completo"]} icon="👤" />
                    <DataBox label="Contacto" value={ticket["Número de Contacto"]} icon="📞" />
                    <DataBox label="Tipo" value={ticket["tipo_mantenimiento"]} icon="🛠️" />
                    <div className="md:col-span-2">
                        <DataBox label="Reporte Original" value={ticket.detalle_problema || ticket.detalle} icon="📝" isFullWidth />
                    </div>
                </div>
            </div>

            <div className="bg-[#121c32] p-8 rounded-[2.5rem] shadow-xl text-white">
                <h3 className="text-[9px] font-black text-blue-400 uppercase italic mb-6 tracking-widest">Asignación & Estatus Administrativo</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="flex flex-col gap-2">
                        <label className="text-[7px] font-black uppercase opacity-60 ml-2">Nuevo Estado:</label>
                        <select value={nuevoEstatus} onChange={(e)=>setNuevoEstatus(e.target.value)} className="w-full p-3 bg-white/10 border border-white/20 rounded-xl text-xs font-bold uppercase text-white outline-none">
                            <option className="text-black" value="SIN ASIGNAR">⚪ SIN ASIGNAR</option>
                            <option className="text-black" value="ASIGNADO">🔵 ASIGNADO</option>
                            <option className="text-black" value="EN PROCESO">🟡 EN PROCESO</option>
                            <option className="text-black" value="PENDIENTE">🔴 PENDIENTE</option>
                            <option className="text-black" value="EJECUTADO">🟢 EJECUTADO</option>
                            <option className="text-black" value="REVISION DE CONTROL INTERNO">🔘 REVISION CONTROL INTERNO</option>
                            <option className="text-black" value="CIERRE ADMINISTRATIVO">🟢 CIERRE ADMINISTRATIVO</option>
                            <option className="text-black" value="CERRADO">🏢 CERRADO</option>
                            <option className="text-black" value="CANCELADO">⚫ CANCELADO</option>
                        </select>
                    </div>
                    {rolUsuario === 'admin' && (
                        <div className="flex flex-col gap-2">
                            <label className="text-[7px] font-black uppercase opacity-60 ml-2">Asignar Coordinador:</label>
                            <select value={nuevoCoordinador} onChange={(e)=>setNuevoCoordinador(e.target.value)} className="w-full p-3 bg-white/10 border border-white/20 rounded-xl text-xs font-bold uppercase text-white outline-none">
                                <option className="text-black" value="">-- SELECCIONAR --</option>
                                {perfiles.filter((p:any)=>p.rol==='coordinador').map((p:any)=><option key={p.email} className="text-black" value={p.email}>{p.nombre_completo || p.email}</option>)}
                            </select>
                        </div>
                    )}
                    {(rolUsuario === 'admin' || rolUsuario === 'coordinador') && (
                        <div className="flex flex-col gap-2">
                            <label className="text-[7px] font-black uppercase opacity-60 ml-2">Asignar Operativo:</label>
                            <select value={nuevoOperativo} onChange={(e)=>setNuevoOperativo(e.target.value)} className="w-full p-3 bg-white/10 border border-white/20 rounded-xl text-xs font-bold uppercase text-white outline-none">
                                <option className="text-black" value="">-- SELECCIONAR --</option>
                                {perfiles.filter((p:any)=>p.rol==='operativo').map((p:any)=><option key={p.email} className="text-black" value={p.email}>{p.nombre_completo || p.email}</option>)}
                            </select>
                        </div>
                    )}
                </div>
                <button onClick={async () => { setCargandoBtn(true); const updates: any = { estatus: nuevoEstatus }; if(rolUsuario==='admin') updates.coordinador=nuevoCoordinador; if(rolUsuario==='admin'||rolUsuario==='coordinador') updates.personal_operativo=nuevoOperativo; await supabase.from('servicios').update(updates).eq('id', ticket.id); onUpdate(); setCargandoBtn(false); alert("✅ Sincronizado"); }} className="w-full mt-6 py-4 bg-blue-600 text-white rounded-2xl font-black text-[10px] hover:bg-blue-500 uppercase italic tracking-[0.2em] transition-all shadow-lg active:scale-95 border-b-4 border-blue-800 disabled:opacity-50">SINCRONIZAR CAMBIOS</button>
            </div>
        </div>
    );

    return (
        <div className="fixed inset-0 bg-[#121c32]/85 backdrop-blur-md flex justify-center items-center z-[100] p-4 animate-in fade-in">
            <div className={`bg-slate-50 w-full max-w-6xl h-full md:h-fit max-h-[95vh] rounded-[3rem] overflow-hidden flex flex-col shadow-2xl border ${esCritico ? 'border-red-500/50 shadow-red-200 ring-8 ring-red-500/10' : 'border-white/20'}`}>
                {esCritico && <div className="bg-gradient-to-r from-red-600 via-red-500 to-red-600 text-white text-[10px] font-black py-3 text-center tracking-[0.4em] animate-pulse uppercase">⚠️ SERVICIO CRÍTICO DE EMERGENCIA ⚠️</div>}
                <div className="bg-[#121c32] p-8 flex justify-between items-center text-white shrink-0">
                    <div className="flex-1 text-center md:pl-10">
                        <h2 className="text-3xl md:text-5xl font-black italic tracking-tighter uppercase">{ticket.codigo_servicio}</h2>
                        <span className={`inline-block mt-3 px-5 py-1.5 rounded-full text-[10px] font-black ${getStatusStyles(nuevoEstatus).badge}`}>{nuevoEstatus}</span>
                    </div>
                    <button onClick={onClose} className="hover:bg-white/10 rounded-full p-4 text-3xl transition-all">✕</button>
                </div>

                <div className="flex border-b bg-white text-[10px] font-black px-8 overflow-x-auto no-scrollbar shrink-0">
                    <button onClick={()=>setActiveTab('info')} className={`flex-1 py-6 border-b-4 ${activeTab==='info'?'border-blue-600 text-blue-600':'border-transparent text-slate-400'}`}>FICHA DEL SERVICIO</button>
                    <button onClick={()=>setActiveTab('reporte')} className={`flex-1 py-6 border-b-4 ${activeTab==='reporte'?'border-blue-600 text-blue-600':'border-transparent text-slate-400'}`}>INFORME TÉCNICO</button>
                    <button onClick={()=>setActiveTab('versiones')} className={`flex-1 py-6 border-b-4 ${activeTab==='versiones'?'border-blue-600 text-blue-600':'border-transparent text-slate-400'}`}>VERSIONES PDF ({versiones.length})</button>
                </div>

                <div className="flex-1 overflow-y-auto p-8 md:p-12 bg-slate-100/50">
                    {activeTab === 'info' ? renderFichaTab1() : activeTab === 'reporte' ? (
                        <div className="space-y-10 animate-in fade-in">
                            <div className={`bg-[#121c32] p-12 rounded-[3.5rem] text-center flex flex-col items-center justify-center shadow-xl ${!horaInicio ? 'animate-pulse ring-4 ring-blue-500/20' : ''}`}>
                                {!horaInicio ? (
                                    <>
                                        <p className="text-white text-xs font-bold mb-8 opacity-60 uppercase tracking-widest">Registrar inicio de atención para llenar el reporte</p>
                                        <button onClick={iniciarAtencion} className="bg-blue-600 hover:bg-blue-500 text-white px-14 py-6 rounded-2xl font-black text-xs uppercase italic transition-all active:scale-95 shadow-2xl">▶ MARCAR INICIO (GPS)</button>
                                    </>
                                ) : (
                                    <div className="text-white">
                                        <p className="text-[11px] font-black text-blue-400 uppercase tracking-widest mb-3">En Atención desde:</p>
                                        <p className="text-3xl font-black italic">{formatDate(horaInicio)}</p>
                                    </div>
                                )}
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <TextArea label="Hallazgos Encontrados" value={hallazgos} onChange={setHallazgos} placeholder="..." />
                                <TextArea label="Diagnóstico Técnico" value={diagnostico} onChange={setDiagnostico} placeholder="..." />
                                <TextArea label="Materiales / Herramientas" value={materiales} onChange={setMateriales} placeholder="..." />
                                <TextArea label="Recomendaciones" value={recomendaciones} onChange={setRecomendaciones} placeholder="..." />
                            </div>
                            <div className="bg-white p-10 rounded-[3rem] border shadow-sm">
                                <div className="flex justify-between items-center mb-8">
                                    <h3 className="text-[11px] font-black uppercase italic text-[#121c32]">Evidencia Fotográfica</h3>
                                    <button onClick={()=>fileInputRef.current?.click()} className="bg-[#121c32] text-white px-8 py-4 rounded-xl font-black text-[10px] uppercase hover:bg-blue-600 shadow-md active:scale-95">+ CARGAR FOTO</button>
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
                                    }} hidden accept="image/*" />
                                </div>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                                    {evidencias.map((ev) => (
                                        <div key={ev.id} className="bg-slate-50 rounded-2xl overflow-hidden border shadow-sm">
                                            <img src={ev.url_foto} className="w-full h-40 object-cover" alt="evidencia" />
                                            <input type="text" placeholder="Nota..." value={ev.descripcion} onChange={async (e) => {
                                                const val = e.target.value;
                                                setEvidencias(prev => prev.map(i => i.id === ev.id ? {...i, descripcion: val} : i));
                                                await supabase.from('evidencias').update({ descripcion: val }).eq('id', ev.id);
                                            }} className="w-full p-4 text-[10px] bg-white border-t outline-none font-bold italic" />
                                        </div>
                                    ))}
                                </div>
                            </div>
                            {horaInicio && (
                                <button onClick={finalizarServicio} disabled={cargandoBtn} className="w-full py-7 bg-emerald-600 text-white rounded-[2.5rem] font-black text-sm uppercase italic shadow-2xl hover:bg-emerald-500 border-b-8 border-emerald-800 active:scale-95 disabled:opacity-50">🏁 FINALIZAR Y GUARDAR SNAPSHOT PDF</button>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-5 animate-in fade-in">
                            {versiones.map((v) => (
                                <div key={v.id} className="bg-white p-8 rounded-3xl border-2 border-slate-50 flex justify-between items-center hover:border-blue-100 shadow-sm">
                                    <div>
                                        <p className="text-[11px] font-black text-blue-600 uppercase">Snapshot Guardado</p>
                                        <p className="text-sm font-black text-[#121c32] italic mt-1">{formatDate(v.fecha_version)}</p>
                                        <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase italic">{v.razon_cambio}</p>
                                    </div>
                                    <button onClick={() => generarPDF(ticket, v, true)} className="bg-[#121c32] text-white px-8 py-3 rounded-xl text-[10px] font-black uppercase hover:bg-blue-600 shadow-md active:scale-90 border-b-4 border-slate-900">VER PDF</button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

const DataBox = ({ label, value, icon, isFullWidth }: any) => (
    <div className={`bg-slate-50/50 p-5 rounded-2xl border border-slate-100 hover:bg-white transition-all ${isFullWidth ? 'h-auto' : ''}`}>
        <label className="text-[8px] font-black text-slate-400 uppercase block mb-1.5 tracking-tighter">{icon} {label}</label>
        <p className={`text-[11px] font-black text-[#121c32] uppercase italic ${isFullWidth ? 'whitespace-pre-wrap' : 'truncate'}`}>{value || '---'}</p>
    </div>
);

const TextArea = ({ label, value, onChange, placeholder }: any) => (
    <div className="bg-white p-8 rounded-[2rem] border shadow-sm">
        <label className="text-[9px] font-black text-blue-400 uppercase block mb-5 tracking-widest">{label}</label>
        <textarea value={value} onChange={(e)=>onChange(e.target.value)} placeholder={placeholder} className="w-full h-40 text-xs font-semibold text-slate-800 outline-none resize-none bg-slate-50/30 p-4 rounded-2xl border border-slate-100" />
    </div>
);