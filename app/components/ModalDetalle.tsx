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
    
    // --- TIEMPOS Y GPS (GUARDADO EN DB) ---
    const [horaInicio, setHoraInicio] = useState(ticket.hora_inicio);
    // Usamos el campo existente o el nuevo si existe
    const [gpsInicio, setGpsInicio] = useState(ticket.ubicacion_gps_inicio || ticket.ubicacion_gps || ''); 
    const [horaFin, setHoraFin] = useState(ticket.hora_fin);
    const [gpsFin, setGpsFin] = useState(ticket.ubicacion_gps_fin || ''); 
    
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

    // --- LÓGICA DE GPS ---
    const capturarGPS = (): Promise<string> => {
        return new Promise((resolve) => {
            if (!navigator.geolocation) resolve("GPS No Soportado");
            navigator.geolocation.getCurrentPosition(
                (pos) => resolve(`${pos.coords.latitude.toFixed(6)}, ${pos.coords.longitude.toFixed(6)}`),
                () => resolve("GPS Desactivado"), // Si el usuario niega permiso
                { enableHighAccuracy: true, timeout: 5000 }
            );
        });
    };

    const iniciarAtencion = async () => {
        setCargandoBtn(true);
        const coords = await capturarGPS();
        const ahora = new Date().toISOString();
        // Guardamos en ambas columnas por compatibilidad
        const { error } = await supabase.from('servicios').update({
            hora_inicio: ahora, estatus: 'EN PROCESO', ubicacion_gps: coords, ubicacion_gps_inicio: coords 
        }).eq('id', ticket.id);
        
        if(!error) { 
            setHoraInicio(ahora); 
            setGpsInicio(coords);
            setNuevoEstatus('EN PROCESO'); 
            onUpdate(); 
        }
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
            hora_fin: ahora, estatus: 'EJECUTADO', hallazgos, diagnostico, materiales, recomendaciones, ubicacion_gps_fin: coordsFin
        }).eq('id', ticket.id);
        setGpsFin(coordsFin);
        setHoraFin(ahora);
        alert("✅ Servicio finalizado con éxito.");
        onUpdate(); onClose(); setCargandoBtn(false);
    };

    const renderFichaTab1 = () => (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* 1. ASIGNACIÓN & ESTATUS (PARTE SUPERIOR) */}
            <div className="bg-[#121c32] p-8 rounded-[2.5rem] shadow-xl text-white">
                <h3 className="text-[9px] font-black text-blue-400 uppercase italic mb-6 tracking-widest">Asignación & Estatus Administrativo</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="flex flex-col gap-2">
                        <label className="text-[7px] font-black uppercase opacity-60 ml-2">Estatus Actual:</label>
                        <select value={nuevoEstatus} onChange={(e)=>setNuevoEstatus(e.target.value)} className="w-full p-3 bg-white/10 border border-white/20 rounded-xl text-xs font-bold uppercase text-white outline-none">
                            <option className="text-black" value="SIN ASIGNAR">⚪ SIN ASIGNAR</option>
                            <option className="text-black" value="ASIGNADO">🔵 ASIGNADO</option>
                            <option className="text-black" value="EN PROCESO">🟡 EN PROCESO</option>
                            <option className="text-black" value="PENDIENTE">🔴 PENDIENTE</option>
                            <option className="text-black" value="EJECUTADO">🟢 EJECUTADO</option>
                            <option className="text-black" value="REVISION DE CONTROL INTERNO">🔘 REVISION CONTROL</option>
                            <option className="text-black" value="CIERRE ADMINISTRATIVO">🟢 CIERRE ADMIN</option>
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

            {/* 2. DATOS DEL CLIENTE */}
            <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
                <h3 className="text-[9px] font-black text-blue-600 uppercase italic mb-6 tracking-widest">Información Maestra</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <DataBox label="Empresa / Sucursal" value={ticket["Empresa"]} icon="🏢" />
                    <DataBox label="Ubicación" value={ticket.ubicacion} icon="📍" />
                    <DataBox label="Solicitante" value={ticket["Nombre Completo"]} icon="👤" />
                    <DataBox label="Contacto" value={ticket["Número de Contacto"]} icon="📞" />
                    <div className="md:col-span-2">
                        <DataBox label="Tipo de Servicio" value={ticket["tipo_mantenimiento"]} icon="🛠️" isFullWidth />
                    </div>
                    <div className="md:col-span-2">
                        <DataBox label="Reporte Original" value={ticket.detalle_problema || ticket.detalle} icon="📝" isFullWidth />
                    </div>
                    {/* EVIDENCIA VISUAL (Enlace Vivo) */}
                    <div className="md:col-span-2">
                        {ticket.evidencia_visual ? (
                            <a href={ticket.evidencia_visual} target="_blank" rel="noreferrer" className="block w-full group">
                                <div className="bg-blue-50/50 p-5 rounded-2xl border-2 border-blue-100 hover:bg-blue-100 transition-all cursor-pointer flex items-center gap-3">
                                    <span className="text-xl">📸</span>
                                    <div>
                                        <label className="text-[8px] font-black text-blue-400 uppercase block mb-0.5 tracking-tighter cursor-pointer">EVIDENCIA VISUAL ADJUNTA</label>
                                        <p className="text-[10px] font-black text-blue-700 uppercase italic truncate underline group-hover:text-blue-900">
                                            {ticket.evidencia_visual}
                                        </p>
                                    </div>
                                </div>
                            </a>
                        ) : (
                            <DataBox label="Evidencia Visual" value="SIN ARCHIVOS ADJUNTOS" icon="📸" isFullWidth />
                        )}
                    </div>
                </div>
            </div>
        </div>
    );

    const renderReporteTab = () => (
        <div className="space-y-8 animate-in fade-in duration-500">
            
            {/* CUADROS DE TIEMPO Y GPS */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className={`p-6 rounded-[2.5rem] border-2 flex flex-col justify-center items-center text-center transition-all ${horaInicio ? 'bg-blue-50 border-blue-200 shadow-inner' : 'bg-white border-slate-100 shadow-sm'}`}>
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-2">REGISTRO DE INICIO</p>
                    {horaInicio ? (
                        <>
                            <p className="text-2xl font-black text-[#121c32] italic tracking-tighter">{formatDate(horaInicio)}</p>
                            <div className="mt-3 px-4 py-1.5 bg-white rounded-xl border border-blue-100 text-[8px] font-bold text-blue-600 shadow-sm flex items-center gap-2"><span>📍</span> {gpsInicio || 'GPS OK'}</div>
                        </>
                    ) : <p className="text-[10px] font-bold text-slate-300 uppercase italic">-- PENDIENTE --</p>}
                </div>
                {horaInicio && (
                    <div className={`p-6 rounded-[2.5rem] border-2 flex flex-col justify-center items-center text-center transition-all ${horaFin ? 'bg-emerald-50 border-emerald-200 shadow-inner' : 'bg-white border-slate-100 shadow-sm opacity-50'}`}>
                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-2">REGISTRO DE SALIDA</p>
                        {horaFin ? (
                            <>
                                <p className="text-2xl font-black text-[#121c32] italic tracking-tighter">{formatDate(horaFin)}</p>
                                <div className="mt-3 px-4 py-1.5 bg-white rounded-xl border border-emerald-100 text-[8px] font-bold text-emerald-600 shadow-sm flex items-center gap-2"><span>🏁</span> {gpsFin || 'GPS OK'}</div>
                            </>
                        ) : <p className="text-[10px] font-bold text-slate-300 uppercase italic">-- EN PROCESO --</p>}
                    </div>
                )}
            </div>

            {/* BOTÓN DE INICIO BLOQUEANTE */}
            {!horaInicio && (
                <div className="bg-[#121c32] p-10 rounded-[3rem] text-center flex flex-col items-center justify-center shadow-2xl ring-4 ring-blue-500/20 my-8 animate-pulse">
                    <p className="text-white/60 text-[10px] font-bold mb-6 uppercase tracking-widest max-w-md">Debe registrar su ubicación y hora de llegada para habilitar la edición del reporte.</p>
                    <button onClick={iniciarAtencion} className="bg-blue-600 hover:bg-blue-500 text-white px-12 py-5 rounded-2xl font-black text-xs uppercase italic transition-all active:scale-95 shadow-xl border-b-4 border-blue-800">▶ MARCAR INICIO DE ATENCIÓN (GPS)</button>
                </div>
            )}

            {/* FORMULARIO TÉCNICO (BLOQUEADO SI NO HAY INICIO) */}
            {/* Aquí aplicamos la lógica de bloqueo visual y funcional */}
            <div className={`grid grid-cols-1 md:grid-cols-2 gap-6 transition-all duration-500 ${!horaInicio ? 'opacity-50 pointer-events-none grayscale' : ''}`}>
                <TextArea label="Hallazgos Encontrados" value={hallazgos} onChange={setHallazgos} placeholder="Describa la situación inicial..." disabled={!horaInicio} />
                <TextArea label="Diagnóstico Técnico" value={diagnostico} onChange={setDiagnostico} placeholder="Describa el problema y causa raíz..." disabled={!horaInicio} />
                <TextArea label="Materiales / Herramientas" value={materiales} onChange={setMateriales} placeholder="Liste los insumos utilizados..." disabled={!horaInicio} />
                <TextArea label="Recomendaciones" value={recomendaciones} onChange={setRecomendaciones} placeholder="Sugerencias para el cliente..." disabled={!horaInicio} />
            </div>

            {/* EVIDENCIA FOTOGRÁFICA (BLOQUEADA SI NO HAY INICIO) */}
            <div className={`bg-white p-8 rounded-[2.5rem] border shadow-sm transition-all duration-500 ${!horaInicio ? 'opacity-50 pointer-events-none grayscale' : ''}`}>
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-[10px] font-black uppercase italic text-[#121c32]">Evidencia Fotográfica</h3>
                    <button onClick={()=>fileInputRef.current?.click()} disabled={!horaInicio} className="bg-[#121c32] text-white px-6 py-3 rounded-xl font-black text-[9px] uppercase hover:bg-blue-600 shadow-lg active:scale-95 transition-all disabled:opacity-50">+ FOTO</button>
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
                    }} hidden accept="image/*" disabled={!horaInicio} />
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {evidencias.map((ev) => (
                        <div key={ev.id} className="bg-slate-50 rounded-2xl overflow-hidden border shadow-sm group">
                            <img src={ev.url_foto} className="w-full h-32 object-cover" alt="evidencia" />
                            <input type="text" placeholder="Nota..." value={ev.descripcion} disabled={!horaInicio} onChange={async (e) => {
                                const val = e.target.value;
                                setEvidencias(prev => prev.map(i => i.id === ev.id ? {...i, descripcion: val} : i));
                                await supabase.from('evidencias').update({ descripcion: val }).eq('id', ev.id);
                            }} className="w-full p-3 text-[9px] bg-white border-t outline-none font-bold italic" />
                        </div>
                    ))}
                    {evidencias.length === 0 && <p className="col-span-full text-center text-[9px] text-slate-300 font-bold italic py-8">SIN FOTOS CARGADAS</p>}
                </div>
            </div>

            {/* BOTÓN FINALIZAR (SOLO VISIBLE SI YA INICIÓ) */}
            {horaInicio && (
                <button onClick={finalizarServicio} disabled={cargandoBtn} className="w-full py-6 bg-emerald-600 text-white rounded-[2rem] font-black text-xs uppercase italic shadow-2xl hover:bg-emerald-500 border-b-8 border-emerald-800 active:scale-95 disabled:opacity-50 transition-all">
                    {cargandoBtn ? 'GUARDANDO...' : '🏁 FINALIZAR SERVICIO Y GENERAR SNAPSHOT PDF'}
                </button>
            )}
        </div>
    );

    return (
        <div className="fixed inset-0 bg-[#121c32]/90 backdrop-blur-md flex justify-center items-center z-[100] p-4 animate-in fade-in duration-300">
            <div className={`bg-[#f8fafc] w-full max-w-6xl h-full md:h-fit max-h-[96vh] rounded-[3.5rem] overflow-hidden flex flex-col shadow-2xl border ${esCritico ? 'border-red-500 ring-[10px] ring-red-500/20' : 'border-white/20'}`}>
                {esCritico && <div className="bg-gradient-to-r from-red-600 via-red-500 to-red-600 text-white text-[9px] font-black py-2.5 text-center tracking-[0.4em] animate-pulse uppercase shadow-md z-20">⚠️ SERVICIO CRÍTICO DE EMERGENCIA ⚠️</div>}
                <div className="bg-[#121c32] px-8 py-6 md:py-8 flex justify-between items-center text-white shrink-0 relative z-10">
                    <div className="flex-1 text-center md:pl-10">
                        <h2 className="text-3xl md:text-5xl font-black italic tracking-tighter uppercase text-white drop-shadow-md">{ticket.codigo_servicio}</h2>
                        <span className={`inline-block mt-3 px-6 py-1.5 rounded-full text-[9px] font-black shadow-lg ${getStatusStyles(nuevoEstatus).badge}`}>{nuevoEstatus}</span>
                    </div>
                    <button onClick={onClose} className="bg-white/10 hover:bg-white/20 rounded-full w-12 h-12 flex items-center justify-center text-xl transition-all active:scale-90 border border-white/10">✕</button>
                </div>
                <div className="flex border-b border-slate-200 bg-white text-[9px] font-black px-8 overflow-x-auto no-scrollbar shrink-0 shadow-sm z-10">
                    <button onClick={()=>setActiveTab('info')} className={`flex-1 py-5 border-b-4 transition-all ${activeTab==='info'?'border-blue-600 text-blue-600 bg-blue-50/50':'border-transparent text-slate-400 hover:text-slate-600'}`}>FICHA DEL SERVICIO</button>
                    <button onClick={()=>setActiveTab('reporte')} className={`flex-1 py-5 border-b-4 transition-all ${activeTab==='reporte'?'border-blue-600 text-blue-600 bg-blue-50/50':'border-transparent text-slate-400 hover:text-slate-600'}`}>INFORME TÉCNICO</button>
                    <button onClick={()=>setActiveTab('versiones')} className={`flex-1 py-5 border-b-4 transition-all ${activeTab==='versiones'?'border-blue-600 text-blue-600 bg-blue-50/50':'border-transparent text-slate-400 hover:text-slate-600'}`}>HISTORIAL PDF ({versiones.length})</button>
                </div>
                <div className="flex-1 overflow-y-auto p-6 md:p-10 bg-[#f8fafc]">
                    {activeTab === 'info' ? renderFichaTab1() : activeTab === 'reporte' ? renderReporteTab() : (
                        <div className="space-y-4 animate-in fade-in">
                            {versiones.map((v) => (
                                <div key={v.id} className="bg-white p-6 rounded-[2rem] border shadow-sm flex justify-between items-center hover:border-blue-200 transition-all">
                                    <div>
                                        <p className="text-[10px] font-black text-blue-600 uppercase mb-1">Versión Guardada</p>
                                        <p className="text-lg font-black text-[#121c32] italic">{formatDate(v.fecha_version)}</p>
                                        <p className="text-[9px] font-bold text-slate-400 uppercase italic mt-1">{v.razon_cambio}</p>
                                    </div>
                                    <button onClick={() => generarPDF(ticket, v, true)} className="bg-[#121c32] text-white px-6 py-2.5 rounded-xl text-[9px] font-black uppercase hover:bg-blue-600 shadow-md transition-all active:scale-95">Descargar PDF</button>
                                </div>
                            ))}
                            {versiones.length === 0 && <div className="text-center py-10 text-slate-400 font-bold italic text-xs">NO HAY VERSIONES GENERADAS</div>}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

const DataBox = ({ label, value, icon, isFullWidth }: any) => (
    <div className={`bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm hover:border-blue-100 transition-all group ${isFullWidth ? 'h-auto' : ''}`}>
        <label className="text-[8px] font-black text-slate-400 uppercase block mb-2 tracking-tighter group-hover:text-blue-400 transition-colors">{icon} {label}</label>
        <p className={`text-[10px] font-black text-[#121c32] uppercase italic ${isFullWidth ? 'whitespace-pre-wrap leading-relaxed' : 'truncate'}`}>{value || '---'}</p>
    </div>
);

// AQUÍ ESTABA EL PROBLEMA: TextArea ahora recibe y aplica 'disabled'
const TextArea = ({ label, value, onChange, placeholder, disabled }: any) => (
    <div className={`bg-white p-6 rounded-[2rem] border shadow-sm transition-all ${disabled ? 'bg-slate-100 border-slate-200 cursor-not-allowed' : 'hover:shadow-md border-slate-100'}`}>
        <label className={`text-[8px] font-black uppercase block mb-4 tracking-widest ${disabled ? 'text-slate-400' : 'text-blue-500'}`}>{label}</label>
        <textarea 
            value={value} 
            onChange={(e)=>onChange(e.target.value)} 
            placeholder={placeholder} 
            disabled={disabled}
            className={`w-full h-32 text-[10px] font-semibold outline-none resize-none p-4 rounded-2xl border transition-all ${disabled ? 'bg-slate-50 text-slate-400 cursor-not-allowed border-slate-200' : 'text-slate-700 bg-slate-50/50 border-slate-100 focus:bg-white focus:border-blue-200'}`} 
        />
    </div>
);