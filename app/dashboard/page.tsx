'use client'
import { useEffect, useState, useMemo, useRef } from 'react'
import { supabase } from '../../lib/supabaseClient' 
import { useRouter } from 'next/navigation' 

// ====================================================================
// 1. DEFINICIÓN DE TIPOS
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
    // Campos Reporte Técnico
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

// ====================================================================
// 2. ESTILOS VISUALES
// ====================================================================
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
// 3. COMPONENTE MODAL (CORAZÓN DEL REPORTE)
// ====================================================================
const ModalDetalle = ({ ticket, onClose, perfiles, usuarioActivo, rolUsuario }: { ticket: Ticket, onClose: () => void, perfiles: Perfil[], usuarioActivo: string, rolUsuario: string }) => {
    if (!ticket) return null;

    // --- ESTADOS ---
    const [cargando, setCargando] = useState(false);
    const [activeTab, setActiveTab] = useState<'info' | 'reporte' | 'versiones'>('info');
    const [modoEdicion, setModoEdicion] = useState(false); // Permite editar reportes cerrados

    // Datos del Reporte (Campos PDF)
    const [diagnostico, setDiagnostico] = useState(ticket.diagnostico || '');
    const [materiales, setMateriales] = useState(ticket.materiales || '');
    const [recomendaciones, setRecomendaciones] = useState(ticket.recomendaciones || '');
    const [evidencias, setEvidencias] = useState<Evidencia[]>([]);
    
    // Datos Admin
    const [nuevoEstatus, setNuevoEstatus] = useState(ticket.estatus);
    const [nuevoCoordinador, setNuevoCoordinador] = useState(ticket.coordinador || '');
    const [nuevoOperativo, setNuevoOperativo] = useState(ticket.personal_operativo || '');
    const [nuevoComentario, setNuevoComentario] = useState(''); 
    
    // Historial y Fotos
    const [versiones, setVersiones] = useState<any[]>([]);
    const [subiendoFoto, setSubiendoFoto] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // --- CARGA DE DATOS ---
    useEffect(() => {
        const cargarDatos = async () => {
            // Cargar Fotos
            const { data: eData } = await supabase.from('evidencias')
                .select('*').eq('ticket_id', ticket.id).order('creado_en', { ascending: true });
            setEvidencias(eData || []);

            // Cargar Historial de Versiones
            const { data: vData } = await supabase.from('historial_versiones')
                .select('*').eq('ticket_id', ticket.id).order('fecha_version', { ascending: false });
            setVersiones(vData || []);
        };
        cargarDatos();
    }, [ticket.id]);

    // --- LÓGICA DE NEGOCIO ---

    const iniciarServicio = async () => {
        if (!confirm("¿Confirmar INICIO de trabajos? Se registrará la hora exacta.")) return;
        setCargando(true);
        try {
            const { error } = await supabase.from('servicios')
                .update({ hora_inicio: new Date().toISOString(), estatus: 'EN PROCESO' })
                .eq('id', ticket.id);
            if (error) throw error;
            alert("⏰ Reloj iniciado.");
            window.location.reload();
        } catch (e: any) { alert(e.message); setCargando(false); }
    };

    const guardarAvance = async () => {
        setCargando(true);
        try {
            await supabase.from('servicios')
                .update({ diagnostico, materiales, recomendaciones })
                .eq('id', ticket.id);
            alert("💾 Avance guardado.");
        } catch(e: any){ alert(e.message); }
        finally { setCargando(false); }
    }

    const finalizarServicio = async () => {
        if (!diagnostico || evidencias.length === 0) return alert("⚠️ Error: Debes escribir un diagnóstico y subir al menos 1 foto.");
        if (!confirm("¿FINALIZAR SERVICIO? Se cerrará el reporte.")) return;
        
        setCargando(true);
        try {
            const { error } = await supabase.from('servicios')
                .update({ 
                    hora_fin: new Date().toISOString(), 
                    estatus: 'EJECUTADO',
                    diagnostico, materiales, recomendaciones
                })
                .eq('id', ticket.id);
            if (error) throw error;
            alert("✅ Servicio finalizado correctamente.");
            window.location.reload();
        } catch (e: any) { alert(e.message); setCargando(false); }
    };

    // --- LÓGICA DE CORRECCIÓN (SNAPSHOTS) ---
    const habilitarCorreccion = async () => {
        const razon = prompt("Escribe la razón de la corrección:");
        if (!razon) return;

        setCargando(true);
        try {
            // 1. Guardar copia de seguridad (Snapshot)
            const { error } = await supabase.from('historial_versiones').insert({
                ticket_id: ticket.id,
                diagnostico_guardado: diagnostico,
                materiales_guardado: materiales,
                recomendaciones_guardado: recomendaciones,
                evidencias_snapshot: evidencias,
                creado_por: usuarioActivo,
                razon_cambio: razon
            });
            if (error) throw error;

            // 2. Activar edición
            setModoEdicion(true); 
            alert("🔓 Reporte desbloqueado. Se guardó una copia de la versión anterior.");
        } catch (e: any) { alert(e.message); } finally { setCargando(false); }
    };

    const guardarCorreccion = async () => {
        setCargando(true);
        try {
            await supabase.from('servicios')
                .update({ diagnostico, materiales, recomendaciones })
                .eq('id', ticket.id);
            alert("✅ Corrección aplicada. El reporte actual se ha actualizado.");
            window.location.reload();
        } catch (e: any) { alert(e.message); } finally { setCargando(false); }
    };

    // --- LÓGICA DE FOTOS ---
    const handleSubirFoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0) return;
        const file = e.target.files[0];
        setSubiendoFoto(true);
        try {
            const fileName = `${ticket.id}-${Date.now()}.${file.name.split('.').pop()}`;
            // Subir a bucket 'evidencias'
            const { error: uErr } = await supabase.storage.from('evidencias').upload(fileName, file);
            if (uErr) throw uErr;
            
            // Obtener URL
            const { data: { publicUrl } } = supabase.storage.from('evidencias').getPublicUrl(fileName);
            const desc = prompt("Descripción de la foto (Ej: Placa de datos):") || "Evidencia";
            
            // Guardar en BD
            const { data: newEv, error: dErr } = await supabase.from('evidencias').insert({
                ticket_id: ticket.id, url_foto: publicUrl, descripcion: desc, autor_email: usuarioActivo
            }).select().single();
            if (dErr) throw dErr;
            
            setEvidencias([...evidencias, newEv]);
        } catch (e: any) { alert("Error foto: " + e.message); } 
        finally { setSubiendoFoto(false); if(fileInputRef.current) fileInputRef.current.value=""; }
    };

    // --- RENDERIZADO DEL MODAL ---
    const [servicio, empresa, cliente] = (ticket.tipo_mantenimiento || "").split('|');
    const esFinalizado = !!ticket.hora_fin;
    const puedeEditar = !esFinalizado || modoEdicion;

    return (
        <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-sm flex justify-center items-center z-[100] p-2 sm:p-4 font-sans uppercase">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[95vh] overflow-hidden flex flex-col border border-slate-200">
                
                {/* HEADER */}
                <div className="bg-[#121c32] px-5 py-4 flex justify-between items-center text-white shrink-0">
                    <div>
                        <h2 className="text-lg font-black tracking-tight italic">{ticket.codigo_servicio}</h2>
                        <p className="text-[10px] text-slate-400 font-bold tracking-widest">{cliente}</p>
                    </div>
                    <button onClick={onClose} className="bg-white/10 w-8 h-8 rounded-full flex items-center justify-center text-lg font-bold">✕</button>
                </div>

                {/* TABS */}
                <div className="flex border-b border-slate-200 bg-slate-50 shrink-0">
                    <button onClick={()=>setActiveTab('info')} className={`flex-1 py-3 text-[10px] font-black tracking-widest ${activeTab==='info' ? 'bg-white text-[#0055b8] border-b-2 border-[#0055b8]' : 'text-slate-400'}`}>INFO</button>
                    <button onClick={()=>setActiveTab('reporte')} className={`flex-1 py-3 text-[10px] font-black tracking-widest ${activeTab==='reporte' ? 'bg-white text-emerald-600 border-b-2 border-emerald-500' : 'text-slate-400'}`}>REPORTE</button>
                    {esFinalizado && <button onClick={()=>setActiveTab('versiones')} className={`flex-1 py-3 text-[10px] font-black tracking-widest ${activeTab==='versiones' ? 'bg-white text-purple-600 border-b-2 border-purple-500' : 'text-slate-400'}`}>HISTORIAL ({versiones.length})</button>}
                </div>

                <div className="p-5 overflow-y-auto flex-1 bg-white">
                    {/* TAB INFO */}
                    {activeTab === 'info' && (
                        <div className="space-y-6">
                            <div className="grid grid-cols-2 gap-4 text-[11px] font-bold border-b pb-4">
                                <div><span className="text-slate-400 text-[9px] block">SERVICIO</span><p className="text-[#0055b8]">{servicio}</p></div>
                                <div><span className="text-slate-400 text-[9px] block">EMPRESA</span><p>{empresa}</p></div>
                                <div className="col-span-2 bg-slate-50 p-3 rounded-lg"><span className="text-slate-400 text-[9px] block">DETALLE</span><p>{ticket.detalle_problema}</p></div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[9px] font-black text-slate-400">ESTATUS ADMIN</label>
                                <select value={nuevoEstatus} onChange={(e)=>setNuevoEstatus(e.target.value)} disabled={rolUsuario==='operativo'} className="w-full p-2 bg-slate-100 rounded-lg text-xs font-bold">
                                    {["SIN ASIGNAR", "ASIGNADO", "EN PROCESO", "EJECUTADO", "CERRRADO", "CANCELADO"].map(o=><option key={o} value={o}>{o}</option>)}
                                </select>
                                <button disabled={true} className="w-full bg-slate-100 text-slate-400 text-[10px] font-bold py-2 rounded-lg">GUARDAR CAMBIOS ADMIN (Desactivado en Demo)</button>
                            </div>
                        </div>
                    )}

                    {/* TAB REPORTE (OPERATIVO) */}
                    {activeTab === 'reporte' && (
                        <div className="space-y-5">
                            {/* ALERTA CORRECCIÓN */}
                            {esFinalizado && !modoEdicion && (
                                <div className="bg-emerald-50 p-3 rounded-lg flex justify-between items-center border border-emerald-100">
                                    <span className="text-[10px] font-bold text-emerald-700">✅ REPORTE CERRADO</span>
                                    <button onClick={habilitarCorreccion} className="text-[9px] bg-white border border-emerald-200 px-3 py-1 rounded shadow-sm text-emerald-700 font-bold hover:bg-emerald-100">🔓 CORREGIR</button>
                                </div>
                            )}

                            {/* RELOJ */}
                            <div className="flex justify-between items-center bg-slate-50 p-3 rounded-lg border border-slate-200">
                                <div className="text-[10px] font-bold text-slate-600">
                                    <p>INICIO: {ticket.hora_inicio ? new Date(ticket.hora_inicio).toLocaleTimeString() : '--:--'}</p>
                                    <p>FIN: {ticket.hora_fin ? new Date(ticket.hora_fin).toLocaleTimeString() : '--:--'}</p>
                                </div>
                                {!ticket.hora_inicio && <button onClick={iniciarServicio} className="bg-blue-600 text-white px-3 py-1 rounded text-[10px] font-black animate-pulse">▶ INICIAR</button>}
                            </div>

                            {/* INPUTS (SOLO VISIBLES SI INICIÓ) */}
                            {ticket.hora_inicio && (
                                <>
                                    <div className="space-y-1">
                                        <label className="text-[9px] font-black text-slate-400">DIAGNÓSTICO (ACCIONES)</label>
                                        <textarea value={diagnostico} onChange={(e)=>setDiagnostico(e.target.value)} disabled={!puedeEditar} className="w-full p-3 rounded-lg border border-slate-300 text-[11px] bg-white focus:ring-1 focus:ring-blue-500 outline-none disabled:bg-slate-100" rows={4} placeholder="Descripción del trabajo..." />
                                    </div>

                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="space-y-1">
                                            <label className="text-[9px] font-black text-slate-400">MATERIALES</label>
                                            <textarea value={materiales} onChange={(e)=>setMateriales(e.target.value)} disabled={!puedeEditar} className="w-full p-3 rounded-lg border text-[11px]" rows={3} />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[9px] font-black text-slate-400">RECOMENDACIONES</label>
                                            <textarea value={recomendaciones} onChange={(e)=>setRecomendaciones(e.target.value)} disabled={!puedeEditar} className="w-full p-3 rounded-lg border text-[11px]" rows={3} />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <div className="flex justify-between">
                                            <label className="text-[9px] font-black text-slate-400">EVIDENCIAS ({evidencias.length})</label>
                                            {puedeEditar && <button onClick={()=>fileInputRef.current?.click()} className="text-[9px] font-bold text-blue-600">+ AGREGAR FOTO</button>}
                                            <input type="file" accept="image/*" ref={fileInputRef} className="hidden" onChange={handleSubirFoto} />
                                        </div>
                                        <div className="grid grid-cols-3 gap-2">
                                            {evidencias.map(e => (
                                                <div key={e.id} className="aspect-square bg-slate-100 rounded-lg overflow-hidden relative border" onClick={()=>window.open(e.url_foto)}>
                                                    <img src={e.url_foto} className="w-full h-full object-cover" />
                                                    <div className="absolute bottom-0 w-full bg-black/60 text-[8px] text-white p-1 text-center truncate">{e.descripcion}</div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* BOTONES ACCIÓN */}
                                    <div className="pt-2 flex gap-2">
                                        {puedeEditar && !esFinalizado && <button onClick={guardarAvance} className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl text-[10px] font-black">GUARDAR AVANCE</button>}
                                        {modoEdicion && <button onClick={guardarCorreccion} className="flex-1 py-3 bg-amber-500 text-black rounded-xl text-[10px] font-black">GUARDAR CORRECCIÓN</button>}
                                        {!esFinalizado && <button onClick={finalizarServicio} className="flex-1 py-3 bg-emerald-600 text-white rounded-xl text-[10px] font-black">FINALIZAR Y CERRAR</button>}
                                    </div>
                                </>
                            )}
                        </div>
                    )}

                    {/* TAB HISTORIAL */}
                    {activeTab === 'versiones' && (
                        <div className="space-y-3">
                            {versiones.map(v => (
                                <div key={v.id} className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                                    <div className="flex justify-between mb-1">
                                        <span className="text-[9px] font-bold text-purple-600">VERSIÓN {new Date(v.fecha_version).toLocaleDateString()}</span>
                                    </div>
                                    <p className="text-[9px] text-slate-500"><span className="font-bold">RAZÓN:</span> {v.razon_cambio}</p>
                                    <p className="text-[9px] text-slate-500"><span className="font-bold">POR:</span> {v.creado_por}</p>
                                </div>
                            ))}
                            {versiones.length===0 && <p className="text-center text-[10px] text-slate-300">SIN CAMBIOS PREVIOS</p>}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// ====================================================================
// 4. PÁGINA PRINCIPAL (DASHBOARD)
// ====================================================================
export default function DashboardPage() {
    const ahora = new Date();
    const [servicios, setServicios] = useState<Ticket[]>([]);
    const [perfiles, setPerfiles] = useState<Perfil[]>([]);
    const [cargando, setCargando] = useState(true);
    const [rolUsuario, setRolUsuario] = useState('');
    const [usuarioActivo, setUsuarioActivo] = useState('');
    const [ticketSeleccionado, setTicketSeleccionado] = useState<Ticket | null>(null);
    const [filtroAnio, setFiltroAnio] = useState<string>(ahora.getFullYear().toString());
    const [filtroMes, setFiltroMes] = useState<string>(ahora.getMonth().toString());
    const [filtroEstatus, setFiltroEstatus] = useState<string | null>(null); 
    const [filtroCoordinador, setFiltroCoordinador] = useState<string | null>(null); 
    const router = useRouter();

    useEffect(() => {
        const user = localStorage.getItem('USUARIO_ACTIVO');
        if (!user) router.replace('/login');
        else obtenerDatos(user);
    }, []);

    const obtenerDatos = async (emailLogin: string) => {
        setCargando(true);
        try {
            const { data: perfilData } = await supabase.from('perfiles').select('*').eq('email', emailLogin).single();
            const rol = perfilData?.rol || 'operativo';
            setRolUsuario(rol);

            const { data: pData } = await supabase.from('perfiles').select('email, rol, nombre_completo');
            setPerfiles(pData || []);

            const idReal = (localStorage.getItem('TECNICO_SESION') || emailLogin).toUpperCase();
            setUsuarioActivo(idReal);

            let query = supabase.from('servicios').select('*');
            if (rol === 'coordinador') query = query.eq('coordinador', emailLogin);
            else if (rol === 'operativo') query = query.eq('personal_operativo', idReal);

            const { data: sData } = await query.order('fecha_solicitud', { ascending: false });
            setServicios(sData || []);
        } catch (e) { console.error(e); } finally { setCargando(false); }
    };

    const periodos = useMemo(() => {
        const anios = new Set<string>();
        const meses: Record<string, Set<number>> = {};
        servicios.forEach(s => {
            if (!s.fecha_solicitud) return;
            const d = new Date(s.fecha_solicitud);
            const a = d.getFullYear().toString();
            anios.add(a);
            if (!meses[a]) meses[a] = new Set();
            meses[a].add(d.getMonth());
        });
        return { anios: Array.from(anios).sort().reverse(), meses };
    }, [servicios]);

    const { grouped, stats, statsCoordinadores, totalGlobal, totalVisible } = useMemo(() => {
        const filtered = servicios.filter(s => {
            const d = new Date(s.fecha_solicitud);
            return (filtroMes==='all' || d.getMonth().toString()===filtroMes) && d.getFullYear().toString()===filtroAnio;
        });

        const coords: Record<string, number> = {};
        filtered.forEach(s => { const c = (s.coordinador||"SIN ASIGNAR").toUpperCase(); coords[c]=(coords[c]||0)+1; });

        let visible = filtered;
        if(filtroCoordinador) visible = visible.filter(s=>(s.coordinador||"SIN ASIGNAR").toUpperCase()===filtroCoordinador);

        const groups: Record<string, Ticket[]> = {};
        const counts: Record<string, number> = { "SIN ASIGNAR":0,"ASIGNADO":0,"EN PROCESO":0,"PENDIENTE":0,"EJECUTADO":0,"REVISION CONTROL INTERNO":0,"QA":0,"CIERRE ADMINISTRATIVO":0,"CERRRADO":0,"CANCELADO":0 };

        visible.forEach(s => {
            let st = (s.estatus||"SIN ASIGNAR").toUpperCase().trim();
            if(!counts.hasOwnProperty(st)) st="SIN ASIGNAR";
            counts[st]++;
            if(filtroEstatus && st!==filtroEstatus) return;
            if(!groups[st]) groups[st]=[];
            groups[st].push(s);
        });

        return { grouped: groups, stats: counts, statsCoordinadores: coords, totalGlobal: filtered.length, totalVisible: visible.length };
    }, [servicios, filtroAnio, filtroMes, filtroEstatus, filtroCoordinador]);

    if (cargando) return <div className="h-screen w-screen bg-[#0f172a] flex items-center justify-center text-white font-black animate-pulse">CARGANDO...</div>;

    return (
        <div className="h-screen w-full flex flex-col bg-[#f8fafc] text-black font-sans antialiased uppercase overflow-hidden">
            <header className="flex-none bg-white border-b px-6 py-3 flex justify-between items-center shadow-sm z-50">
                <div className="flex items-center gap-3"><div className="w-8 h-8 bg-[#121c32] rounded flex items-center justify-center text-white font-black italic">W</div><h1 className="text-lg font-black italic">Wuotto</h1></div>
                <div className="text-right"><p className="text-[9px] font-black text-[#0055b8]">{rolUsuario}</p><p className="text-[10px] text-slate-700">{usuarioActivo}</p></div>
            </header>

            <div className="flex-none bg-[#f8fafc] px-6 pt-4 pb-2 z-40 relative">
                <div className="bg-white p-3 rounded-2xl border flex gap-4 items-center justify-between shadow-sm mb-4">
                    <div className="flex gap-4">
                        <select value={filtroAnio} onChange={(e)=>{setFiltroAnio(e.target.value); setFiltroMes('all');}} className="bg-slate-100 p-2 rounded-lg text-[10px] font-black">{periodos.anios.map(a=><option key={a} value={a}>{a}</option>)}</select>
                        <select value={filtroMes} onChange={(e)=>setFiltroMes(e.target.value)} className="bg-slate-100 p-2 rounded-lg text-[10px] font-black"><option value="all">TODO EL AÑO</option>{Array.from(periodos.meses[filtroAnio]||[]).map(m=><option key={m} value={m.toString()}>{MESES[m]}</option>)}</select>
                        {(filtroEstatus||filtroCoordinador) && <button onClick={()=>{setFiltroEstatus(null); setFiltroCoordinador(null)}} className="bg-rose-50 text-rose-600 px-3 py-2 rounded-lg text-[9px] font-black">LIMPIAR FILTROS</button>}
                    </div>
                </div>

                {rolUsuario==='admin' && (
                    <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar mb-2">
                        <button onClick={()=>setFiltroCoordinador(null)} className={`px-3 py-1 rounded-full border text-[9px] font-bold ${!filtroCoordinador?'bg-slate-800 text-white':'bg-white text-slate-500'}`}>TODOS</button>
                        {Object.entries(statsCoordinadores).map(([c,n])=>(
                            <button key={c} onClick={()=>setFiltroCoordinador(c)} className={`flex items-center gap-2 px-3 py-1 rounded-full border text-[9px] font-bold ${filtroCoordinador===c?'bg-blue-600 text-white':'bg-white text-slate-500'}`}>
                                <span>{c.split('@')[0]}</span><span className="bg-slate-200 text-slate-600 px-1 rounded-full text-[8px]">{n}</span>
                            </button>
                        ))}
                    </div>
                )}

                <div className="flex gap-4 overflow-x-auto pb-4 pt-2 no-scrollbar snap-x">
                    <div className="flex-none flex flex-col items-center cursor-pointer w-20" onClick={()=>setFiltroEstatus(null)}>
                        <div className={`w-16 h-20 ${getStatusStyles('TOTAL').ribbon} rounded-b-2xl flex items-center justify-center text-white text-xl font-black shadow-lg`}>{filtroCoordinador?totalVisible:totalGlobal}</div>
                        <span className="mt-2 text-[8px] font-black text-slate-400">TOTAL</span>
                    </div>
                    {Object.entries(stats).map(([k,v])=>(
                        <div key={k} className="flex-none flex flex-col items-center cursor-pointer w-20" onClick={()=>setFiltroEstatus(k)}>
                            <div className={`w-16 h-20 ${getStatusStyles(k).ribbon} rounded-b-2xl flex items-center justify-center text-white text-xl font-black shadow-lg ${filtroEstatus===k?'ring-4 ring-slate-200':''}`}>{v as number}</div>
                            <span className={`mt-2 text-[8px] font-black text-center leading-none h-6 flex items-center ${filtroEstatus===k?'text-blue-600':'text-slate-400'}`}>{k}</span>
                        </div>
                    ))}
                </div>
            </div>

            <main className="flex-1 overflow-y-auto px-6 pb-20 pt-4">
                <div className="space-y-8 pb-10">
                    {Object.entries(grouped).map(([st, items]) => (
                        <div key={st}>
                            <div className="flex items-center gap-2 mb-3 sticky top-0 bg-[#f8fafc] py-2 z-10"><span className={`w-2 h-2 rounded-full ${getStatusStyles(st).dot}`}></span><h2 className="text-xs font-black text-slate-700">{st} ({items.length})</h2></div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                {items.map(t => (
                                    <div key={t.id} onClick={()=>setTicketSeleccionado(t)} className="bg-white p-4 rounded-xl border shadow-sm hover:shadow-lg transition-all cursor-pointer relative overflow-hidden group">
                                        <div className={`absolute top-0 right-0 px-2 py-1 rounded-bl-lg text-[7px] font-black ${getStatusStyles(t.estatus).badge}`}>{t.estatus}</div>
                                        <p className="text-[9px] text-slate-400 font-mono mb-1">{t.codigo_servicio}</p>
                                        <h3 className="text-[10px] font-black mb-1 line-clamp-2">{t.tipo_mantenimiento?.split('|')[2] || "GENERAL"}</h3>
                                        <p className="text-[9px] text-slate-500 mb-3 line-clamp-2">{t.tipo_mantenimiento?.split('|')[0]}</p>
                                        <div className="flex justify-between items-center text-[8px] text-slate-400 border-t pt-2">
                                            <span>📅 {t.fecha_solicitud?.split('T')[0]}</span>
                                            <span className="text-blue-600 bg-blue-50 px-2 py-1 rounded">VER DETALLE</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </main>

            {ticketSeleccionado && <ModalDetalle ticket={ticketSeleccionado} onClose={()=>setTicketSeleccionado(null)} perfiles={perfiles} usuarioActivo={usuarioActivo} rolUsuario={rolUsuario} />}
        </div>
    );
}