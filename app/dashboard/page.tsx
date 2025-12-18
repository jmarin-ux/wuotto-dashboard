'use client'
import { useEffect, useState, useMemo, useCallback } from 'react'
import { supabase } from '../../lib/supabaseClient' 
import { useRouter } from 'next/navigation' 
import { ModalDetalle } from '../components/ModalDetalle'
import { getStatusStyles, MESES } from '../../lib/utils'

export default function DashboardPage() {
    // --- 1. ESTADOS DE OPERACIÓN (INTEGROS) ---
    const ahora = new Date();
    const [servicios, setServicios] = useState<any[]>([]);
    const [perfiles, setPerfiles] = useState<any[]>([]);
    const [cargando, setCargando] = useState(true);
    const [usuarioActivo, setUsuarioActivo] = useState(''); 
    const [nombreUsuario, setNombreUsuario] = useState('');
    const [rolUsuario, setRolUsuario] = useState('');
    const [ticketSeleccionado, setTicketSeleccionado] = useState<any | null>(null);
    
    // --- 2. FILTROS Y NAVEGACIÓN (INTEGROS) ---
    const [filtroMes, setFiltroMes] = useState<string>(ahora.getMonth().toString());
    const [filtroAnio, setFiltroAnio] = useState<string>(ahora.getFullYear().toString());
    const [filtroEstatus, setFiltroEstatus] = useState<string[]>([]); 
    const [filtroCoordinador, setFiltroCoordinador] = useState<string | null>(null);
    const [filtroCliente, setFiltroCliente] = useState<string>('');
    const [pestañaActiva, setPestañaActiva] = useState<'ordenes' | 'dashboard'>('ordenes');

    const router = useRouter();

    // --- 3. LÓGICA DE CARGA Y REALTIME (MANTENIDA ROBUSTA) ---
    const initDashboard = useCallback(async (email: string) => {
        setCargando(true);
        // Carga de perfiles y validación de rol
        const { data: pData } = await supabase.from('perfiles').select('*').eq('email', email).maybeSingle();
        const userRole = pData?.rol || 'operativo';
        const userFullName = pData?.nombre_completo || email;
        setRolUsuario(userRole);
        setNombreUsuario(userFullName);

        let query = supabase.from('servicios').select('*');
        // Seguridad por rol: solo ves lo que te corresponde
        if (userRole === 'coordinador') query = query.eq('coordinador', email);
        else if (userRole === 'operativo') query = query.or(`personal_operativo.eq."${email}",personal_operativo.eq."${userFullName}"`);

        const { data: s } = await query.order('fecha_solicitud', { ascending: false });
        const { data: allP } = await supabase.from('perfiles').select('*');
        setServicios(s || []); 
        setPerfiles(allP || []); 
        setCargando(false);

        // Canal de tiempo real para actualizaciones inmediatas
        const channel = supabase.channel('cambios-servicios').on('postgres_changes', { event: '*', schema: 'public', table: 'servicios' }, (payload) => {
            const data = (payload.new || payload.old) as any;
            const esMio = userRole === 'admin' || (userRole === 'coordinador' && data.coordinador === email) || (userRole === 'operativo' && (data.personal_operativo === email || data.personal_operativo === userFullName));
            if (esMio) {
                if (payload.eventType === 'INSERT') setServicios((prev) => prev.some(s => s.id === data.id) ? prev : [data, ...prev]);
                else if (payload.eventType === 'UPDATE') {
                    setServicios((prev) => prev.map((item) => item.id === data.id ? data : item));
                    setTicketSeleccionado((prev: any) => (prev && prev.id === data.id ? data : prev));
                }
                else if (payload.eventType === 'DELETE') setServicios((prev) => prev.filter((item) => item.id !== data.id));
            }
        }).subscribe();
        return () => { supabase.removeChannel(channel); }
    }, []);

    useEffect(() => {
        const user = localStorage.getItem('USUARIO_ACTIVO');
        if (!user) router.replace('/login');
        else initDashboard(user.toLowerCase()).then(() => setUsuarioActivo(user.toLowerCase()));
    }, [initDashboard, router]);

    // --- 4. MEMO DE FILTRADO Y ESTADÍSTICAS (MANTENIDO) ---
    const { filtrados, stats, statsCoord, totalM } = useMemo(() => {
        let base = servicios.filter(s => {
            const d = new Date(s.fecha_solicitud);
            return (filtroMes === 'all' || d.getMonth().toString() === filtroMes) && d.getFullYear().toString() === filtroAnio;
        });

        const st: any = { "TOTAL": base.length, "SIN ASIGNAR":0,"ASIGNADO":0,"EN PROCESO":0,"PENDIENTE":0,"EJECUTADO":0,"CERRADO":0,"CANCELADO":0 };
        base.forEach(s => { const key = (s.estatus || 'SIN ASIGNAR').toUpperCase().trim(); if(st.hasOwnProperty(key)) st[key]++; });
        
        const sc: any = {};
        base.forEach(s => { if(s.coordinador) { const coord = s.coordinador.toLowerCase(); sc[coord] = (sc[coord] || 0) + 1; } });

        let final = base;
        if (filtroEstatus.length > 0) final = final.filter(s => filtroEstatus.includes((s.estatus || 'SIN ASIGNAR').toUpperCase()));
        if (filtroCoordinador) final = final.filter(s => s.coordinador?.toLowerCase() === filtroCoordinador.toLowerCase());
        if (filtroCliente) {
            const search = filtroCliente.toLowerCase();
            // Optimización: Búsqueda extendida a las nuevas columnas
            final = final.filter(s => 
                s.codigo_servicio?.toLowerCase().includes(search) || 
                s.tipo_mantenimiento?.toLowerCase().includes(search) || 
                s["Empresa"]?.toLowerCase().includes(search) ||
                s["Nombre Completo"]?.toLowerCase().includes(search)
            );
        }
        return { filtrados: final, stats: st, statsCoord: sc, totalM: base.length };
    }, [servicios, filtroMes, filtroAnio, filtroEstatus, filtroCoordinador, filtroCliente]);

    const hayFiltrosActivos = filtroEstatus.length > 0 || filtroCoordinador !== null || filtroCliente !== '';
    const limpiarFiltros = () => { setFiltroEstatus([]); setFiltroCoordinador(null); setFiltroCliente(''); };

    return (
        <div className="h-screen w-full flex flex-col bg-[#f8fafc] text-black font-sans uppercase overflow-hidden relative">
            
            {/* BOTÓN FLOTANTE */}
            {pestañaActiva === 'ordenes' && hayFiltrosActivos && (
                <button onClick={limpiarFiltros} className="fixed bottom-6 right-6 z-[60] bg-rose-600 text-white px-6 py-3 rounded-full font-black text-[10px] shadow-2xl hover:bg-rose-700 transition-all animate-bounce border-2 border-white">
                    ✕ Borrar Filtros
                </button>
            )}

            {/* HEADER SUPERIOR (DISEÑO PREMIUM MANTENIDO) */}
            <header className="bg-[#121c32] text-white flex-none z-50 shadow-xl px-4 md:px-8 py-3 md:py-4 flex justify-between items-center">
                <div className="flex items-center gap-3 md:gap-4">
                    <div className="w-8 h-8 md:w-10 md:h-10 bg-white rounded-lg flex items-center justify-center text-[#121c32] font-black italic shadow-lg">W</div>
                    <div><h1 className="text-lg md:text-xl font-black italic leading-none">WUOTTO</h1><p className="text-[7px] md:text-[9px] font-bold text-blue-400">{rolUsuario}</p></div>
                </div>
                <div className="flex items-center gap-2 md:gap-6">
                    <div className="text-right hidden md:block"><p className="text-[10px] font-black opacity-40 mb-0.5">Bienvenido</p><p className="text-xs font-black text-white tracking-widest truncate max-w-[180px]">{nombreUsuario}</p></div>
                    <button onClick={()=>{localStorage.clear(); window.location.reload();}} className="bg-rose-500 hover:bg-rose-600 text-white px-3 md:px-4 py-1.5 md:py-2 rounded-lg text-[8px] md:text-[10px] font-black shadow-lg">SALIR 🚪</button>
                </div>
            </header>

            {/* BARRA DE NAVEGACIÓN */}
            <div className="flex-none bg-white border-b border-slate-200 px-4 md:px-8 flex items-center">
                <button onClick={() => setPestañaActiva('ordenes')} className={`flex items-center gap-3 py-4 px-4 md:px-6 border-b-4 transition-all ${pestañaActiva === 'ordenes' ? 'border-[#121c32] text-[#121c32]' : 'border-transparent text-slate-400'}`}>
                    <span className="text-lg md:text-xl">📋</span>
                    <span className="text-[10px] md:text-xs font-black uppercase tracking-widest italic">Órdenes de Trabajo</span>
                </button>
                <button onClick={() => setPestañaActiva('dashboard')} className={`flex items-center gap-3 py-4 px-4 md:px-6 border-b-4 transition-all ${pestañaActiva === 'dashboard' ? 'border-[#121c32] text-[#121c32]' : 'border-transparent text-slate-400'}`}>
                    <span className="text-lg md:text-xl">📊</span>
                    <span className="text-[10px] md:text-xs font-black uppercase tracking-widest italic">Dashboard Analítico</span>
                </button>
            </div>

            <div className="flex-1 flex flex-col overflow-hidden relative">
                
                {pestañaActiva === 'ordenes' && (
                    <>
                        {/* FILTROS (MANTENIDO) */}
                        <div className="flex-none bg-white border-b p-3 md:p-4 px-4 md:px-8 flex flex-col md:flex-row gap-3 md:gap-4 items-stretch md:items-center justify-between shadow-sm z-10">
                            <div className="flex gap-2 md:gap-4 items-center">
                                <select value={filtroAnio} onChange={(e)=>setFiltroAnio(e.target.value)} className="p-2 md:p-3 border-2 border-slate-100 rounded-xl text-[10px] font-black bg-slate-50 outline-none"><option value="2025">2025</option><option value="2024">2024</option></select>
                                <select value={filtroMes} onChange={(e)=>setFiltroMes(e.target.value)} className="p-2 md:p-3 border-2 border-slate-100 rounded-xl text-[10px] font-black bg-slate-50 min-w-[120px] outline-none"><option value="all">TODO EL AÑO</option>{MESES.map((m, i) => <option key={m} value={i}>{m}</option>)}</select>
                                <div className="flex flex-col justify-center px-4 py-1 bg-blue-50 rounded-xl border-2 border-blue-100 min-w-[120px] shadow-sm text-center">
                                    <span className="text-[7px] font-black text-blue-400 uppercase">Total Visibles</span>
                                    <span className="text-lg font-black text-blue-700 leading-none">{totalM}</span>
                                </div>
                            </div>
                            <div className="flex-1 md:max-w-sm"><input type="text" value={filtroCliente} onChange={(e)=>setFiltroCliente(e.target.value)} placeholder="🔍 BUSCAR FOLIO, EMPRESA O TIPO..." className="w-full p-2.5 md:p-3 border-2 border-slate-100 rounded-xl text-[10px] font-black outline-none focus:border-blue-300 transition-all" /></div>
                        </div>

                        {/* LISTONES Y COORDINADORES (MANTENIDO) */}
                        <div className="flex-none bg-[#f8fafc] px-4 md:px-8 py-4 md:py-6 overflow-x-auto no-scrollbar flex items-center gap-6 border-b border-slate-200 shadow-inner z-0">
                            <div className="flex gap-4 md:gap-6 shrink-0">
                                {Object.entries(stats).map(([key, val]: any) => {
                                    const styles = getStatusStyles(key);
                                    const activo = filtroEstatus.includes(key);
                                    return (
                                        <div key={key} onClick={()=>{ if (key === 'TOTAL') setFiltroEstatus([]); else setFiltroEstatus(prev => prev.includes(key) ? prev.filter(e => e !== key) : [...prev, key]); }} className="flex-none flex flex-col items-center cursor-pointer group w-16 md:w-20">
                                            <div className={`w-12 h-16 md:w-16 md:h-20 ${styles.ribbon} rounded-b-[1.5rem] flex items-center justify-center text-white text-xl md:text-2xl font-black shadow-xl transition-all duration-300 ${activo ? '-translate-y-2 ring-4 ring-blue-400 scale-110' : ''}`}>{val}</div>
                                            <span className={`mt-3 text-[7px] md:text-[9px] font-black tracking-widest text-center ${activo ? 'text-blue-700' : 'text-slate-400'}`}>{key.replace(/\s/g, '\n')}</span>
                                        </div>
                                    )
                                })}
                            </div>

                            {rolUsuario === 'admin' && Object.keys(statsCoord).length > 0 && (
                                <>
                                    <div className="h-20 w-px bg-slate-300 shrink-0 mx-2 opacity-50 hidden md:block" />
                                    <div className="flex items-center gap-3 shrink-0">
                                        {Object.entries(statsCoord).map(([email, count]: any) => {
                                            const p = perfiles.find(x => x.email.toLowerCase() === email.toLowerCase());
                                            const nombre = p?.nombre_completo || email.split('@')[0];
                                            const activo = filtroCoordinador === email;
                                            return (
                                                <button key={email} onClick={() => setFiltroCoordinador(activo ? null : email)} className={`flex-none flex items-center gap-2 px-4 py-3 rounded-2xl border-2 transition-all shadow-sm h-fit group ${activo ? 'bg-[#121c32] border-[#121c32] text-white scale-105' : 'bg-white border-slate-100 text-slate-500 hover:border-blue-300'}`}>
                                                    <span className="text-[9px] font-black uppercase italic truncate max-w-[140px] leading-none">{nombre}</span>
                                                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-md ${activo ? 'bg-blue-500 text-white' : 'bg-slate-100 text-slate-800'}`}>{count}</span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </>
                            )}
                        </div>

                        {/* GRID DE TARJETAS (OPTIMIZADO CON COLUMNAS REALES) */}
                        <main className="flex-1 overflow-y-auto px-4 md:px-8 pb-20 pt-6 md:pt-10 bg-slate-50/50 scroll-smooth">
                            {cargando ? <div className="text-center py-20 font-black italic text-slate-400 animate-pulse uppercase">Cargando Servicios...</div> : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-8 max-w-[1600px] mx-auto pb-10">
                                    {filtrados.map(t => {
                                        const esEmergencia = (t.tipo_mantenimiento || "").toUpperCase().includes("EMERGENCIA");
                                        // Acceso a datos de columnas reales
                                        const empresaReal = t["Empresa"] || "N/A";
                                        const solicitanteReal = t["Nombre Completo"] || "N/A";

                                        return (
                                            <div key={t.id} className={`bg-white rounded-[2rem] md:rounded-[2.5rem] border shadow-sm hover:shadow-2xl transition-all duration-300 flex flex-col min-h-[280px] group ${esEmergencia ? 'border-red-500 ring-2 ring-red-50 shadow-red-100' : 'border-slate-100 hover:border-blue-200'}`}>
                                                {esEmergencia && <div className="bg-red-600 text-white text-[6px] font-black py-1 text-center rounded-t-[2rem] tracking-widest animate-pulse">⚠️ EMERGENCIA CRÍTICA</div>}
                                                <div className="p-3 md:p-4 text-center bg-slate-50/30">
                                                    <h3 className={`text-lg md:text-xl font-black italic mb-1 transition-colors ${esEmergencia ? 'text-red-700' : 'text-[#121c32] group-hover:text-blue-700'}`}>{t.codigo_servicio}</h3>
                                                    <span className={`inline-block px-2.5 md:px-3 py-1 rounded-full text-[7px] md:text-[8px] font-black uppercase ${getStatusStyles(t.estatus).badge}`}>{t.estatus}</span>
                                                </div>
                                                <div className="px-5 md:px-6 py-4 flex-1 space-y-3">
                                                    <div><p className="text-[6px] font-black text-slate-400 uppercase tracking-tighter">Empresa / Sucursal</p><p className="text-[9px] md:text-[10px] font-black text-slate-800 line-clamp-1 italic">{empresaReal}</p></div>
                                                    <div><p className="text-[6px] font-black text-slate-400 uppercase tracking-tighter">Solicitante Directo</p><p className="text-[9px] md:text-[10px] font-bold text-blue-600 truncate">👤 {solicitanteReal}</p></div>
                                                    <div><p className="text-[6px] font-black text-slate-400 uppercase tracking-tighter">Servicio</p><p className={`text-[9px] md:text-[10px] font-bold line-clamp-2 uppercase leading-tight ${esEmergencia ? 'text-red-600' : 'text-slate-700'}`}>{t.tipo_mantenimiento?.split('|')[0]}</p></div>
                                                </div>
                                                <div className="p-3 md:p-4 flex justify-between items-center bg-slate-50/30 px-6 border-t rounded-b-[2rem]">
                                                    <div><p className="text-[6px] font-black text-slate-400 uppercase tracking-tighter">Fecha</p><p className="text-[8px] md:text-[9px] font-black text-slate-500 italic">{new Date(t.fecha_solicitud).toLocaleDateString()}</p></div>
                                                    <button onClick={()=>setTicketSeleccionado(t)} className={`${esEmergencia ? 'bg-red-600 hover:bg-red-700' : 'bg-[#121c32] hover:bg-blue-600'} text-white px-5 md:px-6 py-2 rounded-full text-[7px] md:text-[8px] font-black shadow-lg hover:shadow-xl transition-all active:scale-95 uppercase italic tracking-widest`}>Detalle →</button>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                        </main>
                    </>
                )}

                {pestañaActiva === 'dashboard' && <AnalyticsView servicios={servicios} perfiles={perfiles} />}
            </div>
            
            {ticketSeleccionado && <ModalDetalle ticket={ticketSeleccionado} onClose={()=>setTicketSeleccionado(null)} onUpdate={() => initDashboard(usuarioActivo)} perfiles={perfiles} usuarioActivo={usuarioActivo} rolUsuario={rolUsuario} />}
        </div>
    );
}

// --- DASHBOARD ANALÍTICO (KPIs Y CARGA DE TRABAJO) ---
const AnalyticsView = ({ servicios, perfiles }: any) => {
    const total = servicios.length;
    const ejecutados = servicios.filter((s:any) => s.estatus === 'EJECUTADO').length;
    const pendientes = servicios.filter((s:any) => ['PENDIENTE', 'ASIGNADO', 'EN PROCESO'].includes(s.estatus)).length;
    const eficiencia = total > 0 ? Math.round((ejecutados / total) * 100) : 0;

    const porOperativo = useMemo(() => {
        const counts: any = {};
        servicios.forEach((s:any) => { const op = s.personal_operativo || 'Sin Asignar'; counts[op] = (counts[op] || 0) + 1; });
        return Object.entries(counts).sort(([,a]:any, [,b]:any) => b - a);
    }, [servicios]);

    return (
        <main className="flex-1 overflow-y-auto p-4 md:p-8 bg-slate-100/50 scroll-smooth">
            <div className="max-w-[1600px] mx-auto space-y-8 pb-10">
                <div><h2 className="text-2xl md:text-3xl font-black italic uppercase text-[#121c32] tracking-tighter">Resumen Operativo</h2><p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Métricas clave en tiempo real</p></div>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
                    <MetricCard title="Total" value={total} icon="📋" color="bg-blue-50 text-blue-700 border-blue-200" />
                    <MetricCard title="Ejecutados" value={ejecutados} icon="✅" color="bg-emerald-50 text-emerald-700 border-emerald-200" />
                    <MetricCard title="Pendientes" value={pendientes} icon="⏳" color="bg-amber-50 text-amber-700 border-amber-200" />
                    <MetricCard title="Eficiencia" value={`${eficiencia}%`} icon="📈" color="bg-indigo-50 text-indigo-700 border-indigo-200" />
                </div>
                <div className="bg-white p-6 md:p-8 rounded-[2rem] border shadow-sm max-w-2xl">
                    <h3 className="text-lg font-black italic uppercase text-[#121c32] mb-6 flex items-center gap-3">👷 Carga por Operativo</h3>
                    <div className="space-y-4">
                        {porOperativo.map(([email, count]: any, index) => {
                             const p = perfiles.find((x:any) => x.email === email) || {};
                             const nombre = p.nombre_completo || email.split('@')[0];
                             const porcentaje = Math.round((count / total) * 100) || 0;
                             return (
                                <div key={email} className="group">
                                    <div className="flex justify-between items-center mb-2"><div><p className="text-[10px] font-black uppercase text-slate-700">{nombre}</p><p className="text-[8px] font-bold text-slate-400 italic">{email}</p></div><span className="text-lg font-black text-slate-800">{count}</span></div>
                                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden"><div className="h-full bg-blue-500 rounded-full transition-all duration-700" style={{ width: `${porcentaje}%` }}></div></div>
                                </div>
                             )
                        })}
                    </div>
                </div>
            </div>
        </main>
    );
};

const MetricCard = ({ title, value, icon, color }:any) => (
    <div className={`p-6 rounded-[1.5rem] border-2 shadow-sm flex items-center gap-5 transition-all hover:scale-105 ${color}`}>
        <div className="text-3xl bg-white/50 w-14 h-14 rounded-xl flex items-center justify-center shadow-sm">{icon}</div>
        <div><p className="text-[8px] font-black uppercase opacity-70 mb-1">{title}</p><p className="text-3xl font-black italic tracking-tighter leading-none">{value}</p></div>
    </div>
);