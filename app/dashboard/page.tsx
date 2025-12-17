'use client'
import { useEffect, useState, useMemo } from 'react'
// ✅ Importación correcta desde la carpeta lib en la raíz
import { supabase } from '../../lib/supabaseClient' 
import { useRouter } from 'next/navigation' 

// ====================================================================
// 0. TIPOS Y CONSTANTES
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
}

interface Perfil {
    email: string;
    rol: 'admin' | 'coordinador' | 'operativo';
    nombre_completo: string | null;
}

interface HistorialComentario {
    id: number;
    comentario: string;
    autor: string;
    fecha_creacion: string;
}

const MESES = ["ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO", "JULIO", "AGOSTO", "SEPTIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE"];

// ====================================================================
// 1. ESTILOS DE ESTATUS
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
// 2. MODAL RESPONSIVO
// ====================================================================
const ModalDetalle = ({ ticket, onClose, perfiles, usuarioActivo, rolUsuario }: { ticket: Ticket, onClose: () => void, perfiles: Perfil[], usuarioActivo: string, rolUsuario: string }) => {
    if (!ticket) return null;

    const [nuevoEstatus, setNuevoEstatus] = useState(ticket.estatus);
    const [nuevoOperativo, setNuevoOperativo] = useState(ticket.personal_operativo || '');
    const [nuevoCoordinador, setNuevoCoordinador] = useState(ticket.coordinador || '');
    const [nuevoComentario, setNuevoComentario] = useState(''); 
    const [historial, setHistorial] = useState<HistorialComentario[]>([]);
    const [cargando, setCargando] = useState(false);

    useEffect(() => {
        const cargarHistorial = async () => {
            const { data } = await supabase.from('historial_comentarios')
                .select('*').eq('ticket_id', ticket.id).order('fecha_creacion', { ascending: false });
            setHistorial(data || []);
        };
        cargarHistorial();
    }, [ticket.id]);

    const [servicio, empresa, cliente] = (ticket.tipo_mantenimiento || "").split('|');

    const handleSave = async () => {
        if (cargando) return;
        setCargando(true);
        try {
            const updates: any = {
                estatus: nuevoEstatus,
                comentarios: nuevoComentario || ticket.comentarios
            };
            if (rolUsuario !== 'operativo') updates.personal_operativo = nuevoOperativo;
            if (rolUsuario === 'admin') updates.coordinador = nuevoCoordinador;

            const { error: errorUpdate } = await supabase.from('servicios').update(updates).eq('id', ticket.id);
            if (errorUpdate) throw errorUpdate;

            if (nuevoComentario.trim()) {
                await supabase.from('historial_comentarios').insert({
                    ticket_id: ticket.id, comentario: nuevoComentario, autor: usuarioActivo
                });
            }
            alert("✅ Guardado correctamente");
            window.location.reload(); 
        } catch (e: any) { alert(`Error: ${e.message}`); } 
        finally { setCargando(false); }
    };

    return (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex justify-center items-center z-[100] p-4 text-black font-sans uppercase">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col border border-slate-200 animate-in zoom-in-95 duration-200">
                <div className="bg-[#0055b8] px-5 py-4 flex justify-between items-center text-white shrink-0">
                    <h2 className="text-xl font-black tracking-tight italic">{ticket.codigo_servicio}</h2>
                    <button onClick={onClose} className="bg-white/10 w-8 h-8 rounded-full flex items-center justify-center text-lg font-bold">✕</button>
                </div>
                
                <div className="p-5 overflow-y-auto space-y-5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-3 text-[11px] border-b pb-4 font-bold">
                        <p><span className="text-slate-400 text-[9px] tracking-widest block">CLIENTE</span> {cliente?.trim()}</p>
                        <p><span className="text-slate-400 text-[9px] tracking-widest block">EMPRESA</span> {empresa?.trim()}</p>
                        <div className="sm:col-span-2">
                            <span className="text-slate-400 text-[9px] tracking-widest block">SERVICIO</span>
                            <p className="text-[#0055b8] font-black">{servicio?.trim()}</p>
                        </div>
                    </div>

                    <div className="bg-slate-5 border rounded-xl overflow-hidden shadow-inner">
                        <div className="bg-slate-100/50 px-4 py-2 border-b flex justify-between items-center">
                            <p className="text-[9px] font-black text-slate-500 tracking-widest">HISTORIAL</p>
                            <span className="text-[9px] font-bold text-slate-400">{historial.length} REGISTROS</span>
                        </div>
                        <div className="p-3 space-y-3 max-h-[120px] overflow-y-auto">
                            {historial.map((h, i) => (
                                <div key={i} className="text-[10px] border-l-2 border-blue-400 pl-3 py-0.5 leading-tight">
                                    <span className="font-bold text-slate-700 block mb-0.5">{h.comentario}</span>
                                    <p className="text-[8px] text-slate-400 font-bold">POR: {h.autor?.split('@')[0]} — {new Date(h.fecha_creacion).toLocaleDateString()}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-4 pt-2">
                        <div className="space-y-1">
                            <label className="text-[9px] font-black text-slate-400 tracking-widest">ESTATUS</label>
                            <select value={nuevoEstatus} onChange={(e)=>setNuevoEstatus(e.target.value)} className="w-full p-3 rounded-xl bg-slate-100 text-[10px] font-bold text-black focus:ring-2 focus:ring-[#0055b8] outline-none">
                                {rolUsuario === 'admin' ? ["SIN ASIGNAR", "ASIGNADO", "EN PROCESO", "PENDIENTE", "EJECUTADO", "REVISION CONTROL INTERNO", "QA", "CIERRE ADMINISTRATIVO", "CERRRADO", "CANCELADO"].map(o=><option key={o} value={o}>{o}</option>) : 
                                 rolUsuario === 'coordinador' ? ["ASIGNADO", "EN PROCESO", "REVISION CONTROL INTERNO", "QA", "CANCELADO"].map(o=><option key={o} value={o}>{o}</option>) :
                                 ["PENDIENTE", "EJECUTADO"].map(o=><option key={o} value={o}>{o}</option>)}
                            </select>
                        </div>
                        {rolUsuario === 'admin' && (
                            <div className="space-y-1">
                                <label className="text-[9px] font-black text-slate-400 tracking-widest">RESPONSABLE</label>
                                <select value={nuevoCoordinador} onChange={(e)=>setNuevoCoordinador(e.target.value)} className="w-full p-3 rounded-xl bg-slate-100 text-[10px] font-bold text-black focus:ring-2 focus:ring-[#0055b8] outline-none">
                                    <option value="">-- COORDINADOR --</option>
                                    {perfiles.filter((p)=>p.rol==='coordinador').map((p)=><option key={p.email} value={p.email}>{p.email}</option>)}
                                </select>
                            </div>
                        )}
                        {rolUsuario !== 'operativo' && (
                            <div className="space-y-1">
                                <label className="text-[9px] font-black text-slate-400 tracking-widest">TÉCNICO OPERATIVO</label>
                                <select value={nuevoOperativo} onChange={(e)=>setNuevoOperativo(e.target.value)} className="w-full p-3 rounded-xl bg-slate-100 text-[10px] font-bold text-black focus:ring-2 focus:ring-[#0055b8] outline-none">
                                    <option value="">-- SIN TÉCNICO --</option>
                                    {perfiles.filter((p)=>p.rol==='operativo').map((p)=><option key={p.email} value={p.nombre_completo || p.email}>{p.nombre_completo || p.email}</option>)}
                                </select>
                            </div>
                        )}
                        <div className="space-y-1">
                            <label className="text-[9px] font-black text-slate-400 tracking-widest">COMENTARIO</label>
                            <textarea value={nuevoComentario} onChange={(e)=>setNuevoComentario(e.target.value)} className="w-full p-3 rounded-xl border text-[10px] bg-white text-black font-bold focus:ring-2 focus:ring-[#0055b8] outline-none" placeholder="Escribir avance..." rows={2} />
                        </div>
                    </div>
                </div>

                <div className="p-5 border-t bg-slate-50 shrink-0">
                    <button onClick={handleSave} disabled={cargando} className="w-full bg-[#121c32] text-white font-black py-4 rounded-xl text-[10px] tracking-widest shadow-lg active:scale-95 transition-transform">
                        {cargando ? "GUARDANDO..." : "SINCRONIZAR Y GUARDAR"}
                    </button>
                </div>
            </div>
        </div>
    );
};

// ====================================================================
// 3. DASHBOARD PAGE PRINCIPAL (100% RESPONSIVO)
// ====================================================================
export default function DashboardPage() {
    const ahora = new Date();
    
    // Estados Principales
    const [servicios, setServicios] = useState<Ticket[]>([]);
    const [perfiles, setPerfiles] = useState<Perfil[]>([]);
    const [cargando, setCargando] = useState(true);
    const [rolUsuario, setRolUsuario] = useState('');
    const [usuarioActivo, setUsuarioActivo] = useState('');
    const [ticketSeleccionado, setTicketSeleccionado] = useState<Ticket | null>(null);
    
    // Filtros
    const [filtroAnio, setFiltroAnio] = useState<string>(ahora.getFullYear().toString());
    const [filtroMes, setFiltroMes] = useState<string>(ahora.getMonth().toString());
    const [filtroEstatus, setFiltroEstatus] = useState<string | null>(null); 
    const [filtroCoordinador, setFiltroCoordinador] = useState<string | null>(null); // ✅ Nuevo Filtro

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
        } catch (e) { console.error(e); } 
        finally { setCargando(false); }
    };

    const periodosDisponibles = useMemo(() => {
        const anios = new Set<string>();
        const mesesPorAnio: Record<string, Set<number>> = {};
        servicios.forEach(s => {
            if (!s.fecha_solicitud) return;
            const d = new Date(s.fecha_solicitud);
            const a = d.getFullYear().toString();
            const m = d.getMonth();
            anios.add(a);
            if (!mesesPorAnio[a]) mesesPorAnio[a] = new Set();
            mesesPorAnio[a].add(m);
        });
        return { anios: Array.from(anios).sort((a,b) => b.localeCompare(a)), meses: mesesPorAnio };
    }, [servicios]);

    // ✅ LÓGICA DE FILTRADO AVANZADA (COORD + ESTATUS)
    const { grouped, stats, statsCoordinadores, totalGlobal, totalVisible, nombreFiltroActual } = useMemo(() => {
        // 1. Filtrar por PERIODO primero
        const byPeriod = servicios.filter(i => {
            if (filtroMes === 'all') return true;
            if (!i.fecha_solicitud) return false;
            const d = new Date(i.fecha_solicitud);
            return d.getFullYear().toString() === filtroAnio && d.getMonth().toString() === filtroMes;
        });

        // 2. Calcular estadísticas de COORDINADORES (Basado en el periodo, ANTES de filtrar por coord)
        const coordsCount: Record<string, number> = {};
        byPeriod.forEach(s => {
            const c = (s.coordinador || "SIN ASIGNAR").toUpperCase();
            coordsCount[c] = (coordsCount[c] || 0) + 1;
        });

        // 3. Filtrar por COORDINADOR (si está activo el filtro)
        let visibleTickets = byPeriod;
        if (filtroCoordinador) {
            visibleTickets = visibleTickets.filter(s => (s.coordinador || "SIN ASIGNAR").toUpperCase() === filtroCoordinador);
        }

        // 4. Calcular estadísticas de ESTATUS y Agrupar (Basado en los tickets visibles)
        const counts: Record<string, number> = { 
            "SIN ASIGNAR": 0, "ASIGNADO": 0, "EN PROCESO": 0, "PENDIENTE": 0, 
            "EJECUTADO": 0, "REVISION CONTROL INTERNO": 0, "QA": 0, 
            "CIERRE ADMINISTRATIVO": 0, "CERRRADO": 0, "CANCELADO": 0 
        };
        const groups: Record<string, Ticket[]> = {};

        visibleTickets.forEach(s => {
            let st = (s.estatus || "SIN ASIGNAR").toUpperCase().trim();
            if (!counts.hasOwnProperty(st)) st = "SIN ASIGNAR";

            counts[st]++; // Contamos todos los del coordinador/periodo

            // Si hay filtro de Estatus, solo agregamos al grupo ese estatus
            if (filtroEstatus && st !== filtroEstatus) return;

            if (!groups[st]) groups[st] = [];
            groups[st].push(s);
        });

        const label = filtroMes === 'all' ? 'HISTORIAL' : `${MESES[parseInt(filtroMes)]} ${filtroAnio}`;
        
        return { 
            grouped: groups, 
            stats: counts, 
            statsCoordinadores: coordsCount,
            totalGlobal: byPeriod.length, // Total del periodo sin filtros
            totalVisible: visibleTickets.length, // Total del coordinador
            nombreFiltroActual: label 
        };
    }, [servicios, filtroAnio, filtroMes, filtroEstatus, filtroCoordinador]);

    const exportarCSV = () => {
        const bom = "\uFEFF";
        const headers = "Folio,Cliente,Empresa,Fecha,Estatus,Coordinador,Comentarios\n";
        
        // Exportamos lo que se ve actualmente (respetando filtros de coord y estatus)
        const ticketsAExportar = Object.values(grouped).flat();

        const rows = ticketsAExportar.map(s => {
            const [serv, emp, cli] = (s.tipo_mantenimiento || "").split('|');
            const comentarioLimpio = (s.comentarios || "").replace(/(\r\n|\n|\r)/gm, " ");
            return `${s.codigo_servicio},${cli?.trim() || ""},${emp?.trim() || ""},${s.fecha_solicitud},${s.estatus},${s.coordinador},${comentarioLimpio}`;
        }).join("\n");

        const blob = new Blob([bom + headers + rows], { type: 'text/csv;charset=utf-8;' });
        const a = document.createElement('a');
        a.href = window.URL.createObjectURL(blob);
        a.download = `WUOTTO_REPORTE_${nombreFiltroActual.replace(/\s/g, '_')}.csv`;
        a.click();
    };

    if (cargando) return (
        <div className="h-screen w-screen bg-[#0f172a] flex items-center justify-center text-white font-black animate-pulse uppercase tracking-[0.3em]">
            Cargando...
        </div>
    );

    return (
        <div className="h-screen w-full flex flex-col bg-[#f8fafc] text-black font-sans antialiased uppercase overflow-hidden">
            
            {/* 1. HEADER (FIJO) */}
            <header className="flex-none bg-white border-b border-slate-200 px-4 md:px-6 py-3 flex justify-between items-center shadow-sm z-50">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-[#121c32] rounded-lg flex items-center justify-center text-white font-black italic">W</div>
                    <h1 className="text-lg font-black uppercase tracking-tighter italic leading-none">Wuotto</h1>
                </div>
                <div className="flex items-center gap-4 text-black font-bold">
                    <div className="text-right hidden sm:block">
                        <p className="text-[9px] font-black text-[#0055b8] tracking-widest leading-none bg-blue-50 px-2 py-0.5 rounded-md inline-block">{rolUsuario}</p>
                        <p className="text-[10px] text-slate-700 truncate max-w-[200px] mt-0.5">{usuarioActivo}</p>
                    </div>
                    <button onClick={() => { localStorage.clear(); router.replace('/login'); }} className="bg-white border border-rose-200 text-rose-500 px-3 py-1.5 rounded-lg text-[9px] font-black shadow-sm active:scale-95 transition-all">SALIR</button>
                </div>
            </header>

            {/* 2. BARRA DE CONTROLES (FIJO) */}
            <div className="flex-none bg-[#f8fafc] z-40 shadow-sm relative flex flex-col">
                
                {/* FILTROS SUPERIORES */}
                <div className="px-4 md:px-6 pt-4 pb-2">
                    <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm flex flex-wrap gap-4 items-center justify-between font-bold">
                        <div className="flex flex-wrap gap-2 md:gap-4 items-center w-full md:w-auto">
                            
                            <div className="flex flex-col w-1/3 md:w-auto">
                                <span className="text-[8px] text-slate-400 font-black tracking-widest ml-1 mb-0.5">AÑO</span>
                                <select value={filtroAnio} onChange={(e)=>{setFiltroAnio(e.target.value); setFiltroMes('all');}} className="bg-slate-100 w-full border-none text-[10px] font-black p-2.5 rounded-xl outline-none cursor-pointer hover:bg-slate-200 transition-colors">
                                    {periodosDisponibles.anios.map(a => <option key={a} value={a}>{a}</option>)}
                                </select>
                            </div>

                            <div className="flex flex-col flex-1 md:w-auto">
                                <span className="text-[8px] text-slate-400 font-black tracking-widest ml-1 mb-0.5">PERIODO</span>
                                <select value={filtroMes} onChange={(e)=>setFiltroMes(e.target.value)} className="bg-slate-100 w-full border-none text-[10px] font-black p-2.5 rounded-xl outline-none cursor-pointer hover:bg-slate-200 transition-colors">
                                    <option value="all">TODO EL AÑO</option>
                                    {Array.from(periodosDisponibles.meses[filtroAnio] || []).sort((a,b)=>a-b).map(m => (
                                        <option key={m} value={m.toString()}>{MESES[m]}</option>
                                    ))}
                                </select>
                            </div>
                            
                            <div className="h-8 w-px bg-slate-200 mx-2 hidden md:block"></div>

                            <div className="bg-blue-50/80 px-4 py-2 rounded-xl border border-blue-100 flex flex-col justify-center min-w-[100px] w-full md:w-auto text-center md:text-left">
                                <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none mb-0.5">{nombreFiltroActual}</span>
                                <div className="flex items-baseline justify-center md:justify-start gap-1.5">
                                    <span className="text-[10px] font-bold text-[#0055b8] tracking-tighter">TOTAL:</span>
                                    <span className="text-xl font-black text-[#0055b8] leading-none">{filtroCoordinador ? totalVisible : totalGlobal}</span>
                                </div>
                            </div>

                            {(filtroEstatus || filtroCoordinador) && (
                                <button onClick={()=>{setFiltroEstatus(null); setFiltroCoordinador(null)}} className="w-full md:w-auto bg-rose-50 text-rose-600 border border-rose-100 px-4 py-2 rounded-xl text-[9px] font-black uppercase hover:bg-rose-500 hover:text-white transition-all flex items-center justify-center gap-2">
                                    <span>✕</span> LIMPIAR FILTROS
                                </button>
                            )}
                        </div>
                        <button onClick={exportarCSV} className="hidden md:flex bg-emerald-600 text-white px-6 py-3 rounded-xl text-[9px] font-black uppercase shadow-lg shadow-emerald-200/50 hover:bg-emerald-700 active:scale-95 transition-all items-center gap-2">
                            <span>📥</span> CSV
                        </button>
                    </div>
                </div>

                {/* ✅ NUEVO: LISTA DE COORDINADORES (EQUIPO) */}
                {rolUsuario === 'admin' && (
                    <div className="px-4 md:px-6 pb-2 overflow-x-auto no-scrollbar">
                        <div className="flex gap-3 items-center min-w-max">
                            <span className="text-[8px] font-black text-slate-300 tracking-widest rotate-180 py-2 writing-vertical-lr hidden sm:block">EQUIPO</span>
                            
                            {/* Botón TODOS */}
                            <button 
                                onClick={() => setFiltroCoordinador(null)}
                                className={`flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all ${!filtroCoordinador ? 'bg-slate-800 text-white border-slate-800 shadow-md' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}
                            >
                                <div className="w-2 h-2 rounded-full bg-current"></div>
                                <span className="text-[9px] font-bold tracking-wider">TODOS</span>
                            </button>

                            {/* Botones de Coordinadores */}
                            {Object.entries(statsCoordinadores).map(([coord, count]) => {
                                // Intentamos buscar un nombre corto si es email
                                const shortName = coord.includes('@') ? coord.split('@')[0] : coord;
                                const isSelected = filtroCoordinador === coord;

                                return (
                                    <button 
                                        key={coord}
                                        onClick={() => setFiltroCoordinador(isSelected ? null : coord)}
                                        className={`group flex items-center gap-2 pr-3 pl-1 py-1 rounded-full border transition-all ${isSelected ? 'bg-blue-600 text-white border-blue-600 shadow-md' : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300'}`}
                                    >
                                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[8px] font-black ${isSelected ? 'bg-white text-blue-600' : 'bg-slate-100 text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-500'}`}>
                                            {count}
                                        </div>
                                        <span className="text-[9px] font-bold tracking-wider">{shortName}</span>
                                    </button>
                                )
                            })}
                        </div>
                    </div>
                )}

                {/* LISTONES DE ESTATUS */}
                <div className="flex gap-4 overflow-x-auto pb-4 pt-2 no-scrollbar px-4 md:px-6 snap-x">
                    <div className="flex-none flex flex-col items-center cursor-pointer group w-20 snap-start" onClick={()=>setFiltroEstatus(null)}>
                        <div className={`w-16 h-20 md:w-20 md:h-24 ${getStatusStyles('TOTAL').ribbon} rounded-b-[1.5rem] flex flex-col items-center justify-center shadow-lg relative transform transition-all duration-300 ${!filtroEstatus ? 'translate-y-1 ring-4 ring-slate-200' : ''}`}>
                            <div className={`absolute top-0 left-0 w-3 h-3 ${getStatusStyles('TOTAL').ribbon} brightness-75 -translate-y-full rounded-t-full`}></div>
                            <div className={`absolute top-0 right-0 w-3 h-3 ${getStatusStyles('TOTAL').ribbon} brightness-75 -translate-y-full rounded-t-full`}></div>
                            <span className="text-white text-xl md:text-3xl font-black leading-none">{filtroCoordinador ? totalVisible : totalGlobal}</span>
                        </div>
                        <span className="mt-4 text-[7px] md:text-[9px] font-black text-slate-400 tracking-[0.1em] text-center max-w-[80px] leading-tight">TOTAL</span>
                    </div>

                    {Object.entries(stats).map(([key, val]) => (
                        <div key={key} className="flex-none flex flex-col items-center cursor-pointer group w-20 snap-start" onClick={()=>setFiltroEstatus(key)}>
                            <div className={`w-16 h-20 md:w-20 md:h-24 ${getStatusStyles(key).ribbon} rounded-b-[1.5rem] flex flex-col items-center justify-center shadow-lg transform transition-all duration-300 ${filtroEstatus === key ? 'translate-y-1 ring-4 ring-indigo-200' : 'opacity-90'}`}>
                                <div className={`absolute top-0 left-0 w-3 h-3 ${getStatusStyles(key).ribbon} brightness-75 -translate-y-full rounded-t-full`}></div>
                                <div className={`absolute top-0 right-0 w-3 h-3 ${getStatusStyles(key).ribbon} brightness-75 -translate-y-full rounded-t-full`}></div>
                                <span className="text-white text-xl md:text-3xl font-black leading-none">{val as number}</span>
                            </div>
                            <span className={`mt-4 text-[7px] md:text-[9px] font-black tracking-[0.1em] text-center max-w-[80px] leading-tight flex items-center h-[20px] ${filtroEstatus === key ? 'text-indigo-600' : 'text-slate-400'}`}>{key.replace(/\s/g, ' ')}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* 3. GRID DE SERVICIOS (SCROLLABLE) */}
            <main className="flex-1 overflow-y-auto px-4 md:px-6 pb-20 pt-4 scroll-smooth">
                {Object.keys(grouped).length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-300">
                        <p className="text-4xl font-black mb-2">∅</p>
                        <p className="text-sm font-bold tracking-widest text-center">NO HAY REGISTROS</p>
                    </div>
                ) : (
                    <div className="space-y-10 max-w-[1800px] mx-auto">
                        {Object.entries(grouped).map(([status, items]) => (
                            <div key={status} className="space-y-4">
                                <div className="flex items-center gap-3 border-b border-slate-200 pb-2 sticky top-0 bg-[#f8fafc]/95 backdrop-blur-sm z-10 pt-2">
                                    <span className={`w-2.5 h-2.5 rounded-full ${getStatusStyles(status).dot} shadow-sm`}></span>
                                    <h2 className="text-xs font-black tracking-[0.25em] text-slate-800">{status} <span className="text-slate-400 ml-2 font-bold bg-slate-100 px-2 py-0.5 rounded-md">{items.length}</span></h2>
                                </div>
                                
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 uppercase font-bold text-black">
                                    {items.map((item) => {
                                        const [s_name, e_name, c_name] = (item.tipo_mantenimiento || "").split('|');
                                        return (
                                            <div key={item.id} onClick={() => setTicketSeleccionado(item)} className="bg-white p-5 rounded-[1.25rem] border border-slate-200 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer group flex flex-col h-[190px] relative overflow-hidden">
                                                <div className={`absolute top-0 right-0 px-3 py-1 rounded-bl-xl font-black text-[7px] tracking-widest ${getStatusStyles(item.estatus).badge}`}>
                                                    {item.estatus}
                                                </div>
                                                <div className="flex-1 space-y-2 mt-1">
                                                    <span className="text-[9px] font-mono text-slate-400 tracking-tighter">PRJ: {item.codigo_servicio}</span>
                                                    <h3 className="text-[11px] font-black text-slate-900 line-clamp-2 leading-tight">{c_name?.trim() || e_name?.trim() || "GENERAL"}</h3>
                                                    <p className="text-[9px] font-bold text-slate-500 leading-relaxed line-clamp-3 opacity-80">{s_name?.trim()}</p>
                                                </div>
                                                <div className="border-t border-slate-50 mt-3 pt-3 flex justify-between items-center text-[8px] font-black text-slate-400">
                                                    <span>📅 {item.fecha_solicitud?.split('T')[0]}</span>
                                                    <span className="text-[#0055b8] bg-blue-50 px-2 py-1 rounded-md">VER DETALLE →</span>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </main>

            {ticketSeleccionado && <ModalDetalle ticket={ticketSeleccionado} onClose={() => setTicketSeleccionado(null)} perfiles={perfiles} usuarioActivo={usuarioActivo} rolUsuario={rolUsuario} />}
        </div>
    );
}