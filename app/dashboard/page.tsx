'use client'
import { useEffect, useState, useMemo, useCallback } from 'react'
import { supabase } from '../../lib/supabaseClient' 
import { useRouter } from 'next/navigation' 
import { ModalDetalle } from '../components/ModalDetalle'
import { getStatusStyles, MESES, formatDate } from '../../lib/utils'

export default function DashboardPage() {
    // --- 1. ESTADOS DE OPERACIÓN INTEGRALES (PRESERVADOS) ---
    const ahora = new Date();
    const [servicios, setServicios] = useState<any[]>([]);
    const [perfiles, setPerfiles] = useState<any[]>([]);
    const [cargando, setCargando] = useState(true);
    const [usuarioActivo, setUsuarioActivo] = useState(''); 
    const [nombreUsuario, setNombreUsuario] = useState('');
    const [rolUsuario, setRolUsuario] = useState('');
    const [ticketSeleccionado, setTicketSeleccionado] = useState<any | null>(null);
    
    // --- 2. ESTADOS DE FILTROS INDEPENDIENTES ---
    const [filtroMes, setFiltroMes] = useState<string>(ahora.getMonth().toString());
    const [filtroAnio, setFiltroAnio] = useState<string>(ahora.getFullYear().toString());
    const [filtroEstatus, setFiltroEstatus] = useState<string[]>([]); 
    const [filtroCliente, setFiltroCliente] = useState<string>('');
    const [pestañaActiva, setPestañaActiva] = useState<'ordenes' | 'dashboard'>('ordenes');

    const [filtroCoordOrdenes, setFiltroCoordOrdenes] = useState<string | null>(null);
    const [filtroCoordAnalitica, setFiltroCoordAnalitica] = useState<string | null>(null);

    const router = useRouter();

    // --- 3. LÓGICA TÉCNICA Y REALTIME (ÍNTEGRA) ---
    const initDashboard = useCallback(async (email: string) => {
        setCargando(true);
        const { data: pData } = await supabase.from('perfiles').select('*').eq('email', email).maybeSingle();
        const userRole = pData?.rol || 'operativo';
        const userFullName = pData?.nombre_completo || email;
        setRolUsuario(userRole);
        setNombreUsuario(userFullName);

        let query = supabase.from('servicios').select('*');
        if (userRole === 'coordinador') query = query.eq('coordinador', email);
        else if (userRole === 'operativo') query = query.or(`personal_operativo.eq."${email}",personal_operativo.eq."${userFullName}"`);

        const { data: s } = await query.order('fecha_solicitud', { ascending: false });
        const { data: allP } = await supabase.from('perfiles').select('*');
        
        setServicios(s || []); 
        setPerfiles(allP || []); 
        setCargando(false);

        const channel = supabase.channel('cambios-servicios').on('postgres_changes', { event: '*', schema: 'public', table: 'servicios' }, (payload) => {
            const data = (payload.new || payload.old) as any;
            const esMio = userRole === 'admin' 
                || (userRole === 'coordinador' && data.coordinador === email) 
                || (userRole === 'operativo' && (data.personal_operativo === email || data.personal_operativo === userFullName));
            
            if (esMio) {
                if (payload.eventType === 'INSERT') setServicios((prev) => [data, ...prev]);
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

    // --- 4. MOTOR DE FILTRADO Y AGRUPAMIENTO DINÁMICO ---
    const dataCalculada = useMemo(() => {
        const baseTiempo = [...servicios].sort((a, b) => new Date(b.fecha_solicitud).getTime() - new Date(a.fecha_solicitud).getTime())
            .filter(s => {
                const d = new Date(s.fecha_solicitud);
                return (filtroMes === 'all' || d.getMonth().toString() === filtroMes) && d.getFullYear().toString() === filtroAnio;
            });

        // FILTRADO INDEPENDIENTE ÓRDENES
        let filtradaOrdenes = baseTiempo;
        if (filtroCoordOrdenes) filtradaOrdenes = filtradaOrdenes.filter(s => s.coordinador === filtroCoordOrdenes);
        
        // MONITOREO DE SERVICIOS INICIADOS (EN PROCESO) PARA EL ENCABEZADO
        const activosEnCampo = filtradaOrdenes.filter(s => s.estatus?.toUpperCase() === 'EN PROCESO');

        const stRibbons: any = { "TOTAL": filtradaOrdenes.length, "SIN ASIGNAR": 0, "ASIGNADO": 0, "EN PROCESO": 0, "PENDIENTE": 0, "EJECUTADO": 0, "REVISION DE CONTROL INTERNO": 0, "CIERRE ADMINISTRATIVO": 0, "CERRADO": 0, "CANCELADO": 0 };
        filtradaOrdenes.forEach(s => { 
            const key = (s.estatus || 'SIN ASIGNAR').toUpperCase().trim(); 
            if(stRibbons.hasOwnProperty(key)) stRibbons[key]++; 
        });

        let paraGrid = filtradaOrdenes;
        if (filtroEstatus.length > 0) paraGrid = paraGrid.filter(s => filtroEstatus.includes((s.estatus || 'SIN ASIGNAR').toUpperCase()));
        if (filtroCliente) {
            const search = filtroCliente.toLowerCase();
            paraGrid = paraGrid.filter(s => s.codigo_servicio?.toLowerCase().includes(search) || s["Empresa"]?.toLowerCase().includes(search) || s["Nombre Completo"]?.toLowerCase().includes(search));
        }

        const agrupadosOrdenes = Object.keys(stRibbons).filter(k => k !== "TOTAL").reduce((acc: any, status) => {
            const items = paraGrid.filter(s => (s.estatus || 'SIN ASIGNAR').toUpperCase() === status);
            if (items.length > 0) acc[status] = items;
            return acc;
        }, {});

        // FILTRADO INDEPENDIENTE ANALÍTICA
        let filtradaAnalitica = baseTiempo;
        if (filtroCoordAnalitica) filtradaAnalitica = filtradaAnalitica.filter(s => s.coordinador === filtroCoordAnalitica);

        const coStats: any = {};
        perfiles.filter(p => p.rol === 'coordinador').forEach(p => {
            coStats[p.email] = { nombre: p.nombre_completo || p.email, count: baseTiempo.filter(s => s.coordinador === p.email).length };
        });

        return { agrupadosOrdenes, filtradaAnalitica, activosEnCampo, statsRibbons: stRibbons, statsCoordinadores: coStats, totalOrdenes: filtradaOrdenes.length };
    }, [servicios, filtroMes, filtroAnio, filtroEstatus, filtroCliente, filtroCoordOrdenes, filtroCoordAnalitica, perfiles]);

    const limpiarFiltros = () => {
        setFiltroEstatus([]);
        setFiltroCoordOrdenes(null);
        setFiltroCoordAnalitica(null);
        setFiltroCliente('');
    };

    const exportarCSV = () => {
        const headers = ["CODIGO", "FECHA", "CLIENTE", "SOLICITANTE", "ESTATUS", "COORDINADOR"];
        const rows = servicios.map(s => [s.codigo_servicio, s.fecha_solicitud, s.Empresa, s["Nombre Completo"], s.estatus, s.coordinador].map(v => `"${String(v).replace(/"/g, '""')}"`).join(","));
        const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + headers.join(",") + "\n" + rows.join("\n");
        const link = document.createElement("a");
        link.setAttribute("href", encodeURI(csvContent));
        link.setAttribute("download", `WUOTTO_REPORTE.csv`);
        link.click();
    };

    return (
        <div className="h-screen w-full flex flex-col bg-[#f4f7fa] text-black font-sans uppercase overflow-hidden relative">
            
            {/* HEADER CON PANEL DE MONITOREO ACTIVO */}
            <header className="bg-[#121c32] text-white flex-none z-50 shadow-lg px-4 md:px-6 py-2 md:py-3 flex justify-between items-center border-b border-white/10">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-white rounded-xl flex items-center justify-center text-[#121c32] font-black italic shadow-lg rotate-2 text-sm shrink-0">W</div>
                        <div className="hidden sm:block">
                            <h1 className="text-sm md:text-lg font-black italic leading-none tracking-tighter">WUOTTO</h1>
                            <p className="text-[6px] md:text-[8px] font-bold text-blue-400 tracking-[0.1em]">{rolUsuario} CENTRAL</p>
                        </div>
                    </div>

                    {/* BOTONES DE ACCESO RÁPIDO A SERVICIOS EN PROCESO */}
                    {dataCalculada.activosEnCampo.length > 0 && (
                        <div className="flex items-center gap-2 border-l border-white/20 pl-4 animate-in slide-in-from-left duration-500">
                            <span className="text-[7px] md:text-[9px] font-black text-amber-400 italic bg-amber-400/10 px-2 py-1 rounded-md border border-amber-400/20 animate-pulse">● EN ATENCIÓN:</span>
                            <div className="flex gap-1.5 overflow-x-auto no-scrollbar max-w-[200px] md:max-w-md">
                                {dataCalculada.activosEnCampo.map(s => (
                                    <button 
                                        key={s.id} 
                                        onClick={() => setTicketSeleccionado(s)}
                                        className="flex-none bg-blue-600 hover:bg-blue-500 text-white text-[8px] md:text-[10px] font-black px-3 py-1 rounded-lg shadow-md transition-all active:scale-95 border-b-2 border-blue-800"
                                    >
                                        {s.codigo_servicio}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                <div className="flex items-center gap-2 md:gap-4">
                    {(filtroEstatus.length > 0 || filtroCoordOrdenes || filtroCoordAnalitica || filtroCliente) && (
                        <button onClick={limpiarFiltros} className="bg-white/10 hover:bg-white/20 text-white border border-white/30 px-3 py-1.5 rounded-lg text-[8px] font-black transition-all">
                            ❌ RESET
                        </button>
                    )}
                    <button onClick={exportarCSV} className="hidden md:block bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-lg text-[8px] font-black shadow-lg border-b-2 border-emerald-800 uppercase">CSV</button>
                    <button onClick={()=>{localStorage.clear(); window.location.reload();}} className="bg-rose-500 hover:bg-rose-400 text-white px-3 py-1.5 rounded-lg text-[8px] font-black shadow-lg border-b-2 border-rose-800 italic">SALIR</button>
                </div>
            </header>

            <nav className="flex-none bg-white border-b border-slate-200 px-4 md:px-8 flex overflow-x-auto no-scrollbar shadow-sm">
                <button onClick={() => setPestañaActiva('ordenes')} className={`flex items-center gap-2 py-3 px-4 border-b-4 shrink-0 transition-all text-[9px] md:text-[10px] font-black ${pestañaActiva === 'ordenes' ? 'border-[#121c32] text-[#121c32]' : 'border-transparent text-slate-400'}`}>📋 GESTIÓN</button>
                <button onClick={() => setPestañaActiva('dashboard')} className={`flex items-center gap-2 py-3 px-4 border-b-4 shrink-0 transition-all text-[9px] md:text-[10px] font-black ${pestañaActiva === 'dashboard' ? 'border-[#121c32] text-[#121c32]' : 'border-transparent text-slate-400'}`}>📊 ANALÍTICA</button>
            </nav>

            <div className="flex-1 flex flex-col overflow-hidden relative">
                {pestañaActiva === 'ordenes' && (
                    <>
                        <div className="flex-none bg-white border-b p-2 md:p-3 px-4 flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between shadow-sm z-10">
                            <div className="flex gap-2 items-center flex-wrap">
                                <select value={filtroAnio} onChange={(e)=>setFiltroAnio(e.target.value)} className="p-2 border border-slate-200 rounded-lg text-[9px] font-black bg-slate-50 outline-none"><option value="2025">2025</option><option value="2024">2024</option></select>
                                <select value={filtroMes} onChange={(e)=>setFiltroMes(e.target.value)} className="p-2 border border-slate-200 rounded-lg text-[9px] font-black bg-slate-50 min-w-[120px] outline-none"><option value="all">TODO EL AÑO</option>{MESES.map((m, i) => <option key={m} value={i}>{m}</option>)}</select>
                                <div className="text-[9px] font-black bg-blue-50 text-blue-600 px-3 py-2 rounded-lg border border-blue-100 uppercase italic">Vivos: {dataCalculada.totalOrdenes}</div>
                            </div>
                            <div className="flex-1 md:max-w-md"><input type="text" value={filtroCliente} onChange={(e)=>setFiltroCliente(e.target.value)} placeholder="🔍 BUSCAR..." className="w-full px-4 py-2 border border-slate-200 rounded-xl text-[10px] font-black outline-none focus:ring-2 focus:ring-blue-500 transition-all shadow-inner" /></div>
                        </div>

                        {/* LISTONES UNIFICADOS */}
                        <div className="flex-none bg-slate-50/80 px-4 md:px-8 py-4 flex flex-col lg:flex-row gap-6 border-b border-slate-200 shadow-inner overflow-hidden">
                            <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2 flex-1 items-start">
                                {Object.entries(dataCalculada.statsRibbons).map(([key, val]: any) => {
                                    const styles = getStatusStyles(key);
                                    const activo = filtroEstatus.includes(key);
                                    return (
                                        <div key={key} onClick={()=>{ if (key === 'TOTAL') setFiltroEstatus([]); else setFiltroEstatus(prev => prev.includes(key) ? prev.filter(e => e !== key) : [...prev, key]); }} className="flex-none flex flex-col items-center cursor-pointer group w-[75px]">
                                            <div className={`w-full h-16 md:h-20 ${styles.ribbon} rounded-b-2xl flex items-center justify-center text-white text-lg md:text-xl font-black shadow-lg transition-all duration-300 ${activo ? 'translate-y-1 ring-2 ring-blue-400 scale-105' : 'opacity-90 group-hover:opacity-100'}`}>{val}</div>
                                            <div className="h-8 flex items-center justify-center mt-1">
                                                <span className={`text-[7px] font-black text-center leading-tight uppercase ${activo ? 'text-blue-700' : 'text-slate-400'}`}>{key}</span>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                            {rolUsuario === 'admin' && (
                                <CoordinatorList statsCoordinadores={dataCalculada.statsCoordinadores} filtro={filtroCoordOrdenes} setFiltro={setFiltroCoordOrdenes} />
                            )}
                        </div>

                        {/* VISTA COMPACTA AGRUPADA POR ESTATUS */}
                        <main className="flex-1 overflow-y-auto px-4 md:px-8 pb-20 pt-6 bg-white scroll-smooth animate-in fade-in duration-700">
                            {Object.entries(dataCalculada.agrupadosOrdenes).map(([status, items]: any) => (
                                <section key={status} className="mb-12">
                                    <div className="flex items-center gap-4 mb-4 border-b border-slate-100 pb-2">
                                        <h2 className={`text-[10px] md:text-[11px] font-black px-4 py-1 rounded-full ${getStatusStyles(status).badge}`}>{status} ({items.length})</h2>
                                        <div className="h-[1px] flex-1 bg-slate-50"></div>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3 md:gap-4">
                                        {items.map((t: any) => {
                                            const esEmergencia = (t.tipo_mantenimiento || "").toUpperCase().includes("EMERGENCIA");
                                            return (
                                                <div key={t.id} className={`bg-white rounded-[1.5rem] border shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col min-h-[220px] overflow-hidden group ${esEmergencia ? 'border-red-500 ring-2 ring-red-500/10' : 'border-slate-100 hover:border-blue-300'}`}>
                                                    {esEmergencia && <div className="bg-red-600 text-white text-[7px] font-black py-1.5 text-center tracking-widest animate-pulse uppercase">⚠️ EMERGENCIA</div>}
                                                    <div className={`p-3 text-center ${esEmergencia ? 'bg-red-50/50' : 'bg-slate-50/50'}`}>
                                                        <h3 className="text-sm font-black italic tracking-tighter truncate text-[#121c32] group-hover:text-blue-700">{t.codigo_servicio}</h3>
                                                    </div>
                                                    <div className="px-4 py-3 flex-1 space-y-2.5">
                                                        <div className="border-l-2 border-slate-100 pl-2">
                                                            <p className="text-[6px] font-black text-slate-400 uppercase">Empresa</p>
                                                            <p className="text-[9px] font-black text-slate-700 italic truncate leading-none mt-0.5">{t["Empresa"] || "N/A"}</p>
                                                        </div>
                                                        <div className="border-l-2 border-slate-100 pl-2">
                                                            <p className="text-[6px] font-black text-slate-400 uppercase">Tipo</p>
                                                            <p className={`text-[8px] font-bold line-clamp-1 mt-0.5 ${esEmergencia ? 'text-red-600' : 'text-slate-500'}`}>{t.tipo_mantenimiento?.split('|')[0]}</p>
                                                        </div>
                                                    </div>
                                                    <div className="p-3 flex justify-between items-center bg-slate-50/30 px-4 border-t">
                                                        <span className="text-[8px] font-black text-slate-400">{new Date(t.fecha_solicitud).toLocaleDateString()}</span>
                                                        <button onClick={()=>setTicketSeleccionado(t)} className={`px-4 py-1.5 rounded-lg text-[8px] font-black shadow-md transition-all active:scale-95 border-b-2 uppercase italic ${esEmergencia ? 'bg-red-600 text-white border-red-800' : 'bg-[#121c32] text-white border-slate-900'}`}>DETALLE</button>
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                </section>
                            ))}
                        </main>
                    </>
                )}

                {pestañaActiva === 'dashboard' && (
                    <AnalyticsView 
                        dataAnalitica={dataCalculada.filtradaAnalitica} 
                        statsCoordinadores={dataCalculada.statsCoordinadores} 
                        filtro={filtroCoordAnalitica}
                        setFiltro={setFiltroCoordAnalitica}
                        rolUsuario={rolUsuario} 
                    />
                )}
            </div>

            {ticketSeleccionado && <ModalDetalle ticket={ticketSeleccionado} onClose={()=>setTicketSeleccionado(null)} onUpdate={() => initDashboard(usuarioActivo)} perfiles={perfiles} usuarioActivo={usuarioActivo} rolUsuario={rolUsuario} />}
        </div>
    );
}

// --- SUB-COMPONENTES AUXILIARES ---
const CoordinatorList = ({ statsCoordinadores, filtro, setFiltro }: any) => (
    <div className="lg:border-l-2 lg:border-slate-100 lg:pl-6 w-full lg:w-64 shrink-0">
        <p className="text-[8px] md:text-[9px] font-black text-slate-500 mb-2 tracking-[0.2em] italic uppercase">Coordinadores (Filtro):</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-1 gap-1.5 max-h-32 lg:max-h-48 overflow-y-auto no-scrollbar pr-1">
            <div onClick={() => setFiltro(null)} className={`px-2 py-1.5 rounded-lg text-[7px] font-black cursor-pointer border flex justify-between items-center transition-all ${!filtro ? 'bg-[#121c32] text-white' : 'bg-white text-slate-400'}`}>MOSTRAR TODOS</div>
            {Object.entries(statsCoordinadores).map(([email, info]: any) => (
                <div key={email} onClick={() => setFiltro(email)} className={`px-2 py-1.5 rounded-lg text-[7px] font-black cursor-pointer border flex justify-between items-center gap-1 transition-all ${filtro === email ? 'bg-blue-600 text-white shadow-md' : 'bg-white text-slate-500 hover:border-blue-300'}`}>
                    <span className="truncate">{info.nombre}</span>
                    <span className={`bg-black/10 px-1 rounded-md text-[6px] ${filtro === email ? 'text-white' : 'text-slate-600'}`}>{info.count}</span>
                </div>
            ))}
        </div>
    </div>
);

const AnalyticsView = ({ dataAnalitica, statsCoordinadores, filtro, setFiltro, rolUsuario }: any) => {
    const total = dataAnalitica.length;
    const finalizados = dataAnalitica.filter((s:any) => ['CIERRE ADMINISTRATIVO', 'CANCELADO', 'CERRADO', 'EJECUTADO'].includes(s.estatus.toUpperCase())).length;
    const ratioAlcance = (finalizados > 0) ? (Math.round((total / finalizados) * 100) / 100) : 0;

    return (
        <main className="flex-1 overflow-y-auto p-4 md:p-6 bg-[#f8fafc] animate-in fade-in duration-500">
            <div className="max-w-[1700px] mx-auto space-y-6">
                <div className="flex flex-col md:flex-row justify-between items-end gap-4 border-b border-slate-200 pb-4">
                    <div>
                        <h2 className="text-xl md:text-3xl font-black italic uppercase text-[#121c32] tracking-tighter">KPIS ESTRUCTURALES</h2>
                        <p className="text-[8px] md:text-[10px] font-bold text-slate-400 tracking-[0.2em] uppercase italic">Analítica Independiente</p>
                    </div>
                    <div className="bg-[#121c32] px-6 py-3 rounded-2xl flex items-center gap-4 shadow-xl border-b-4 border-blue-600">
                        <span className="text-[9px] font-black text-blue-400 tracking-widest leading-none uppercase">RATIO DE ALCANCE:</span>
                        <span className="text-2xl font-black text-white italic leading-none">{ratioAlcance}x</span>
                    </div>
                </div>

                {rolUsuario === 'admin' && (
                    <div className="bg-white p-4 rounded-[2.5rem] shadow-xl border border-slate-100">
                        <CoordinatorList statsCoordinadores={statsCoordinadores} filtro={filtro} setFiltro={setFiltro} />
                    </div>
                )}

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-5">
                    <MetricCardSmall title="Carga" value={total} color="bg-blue-600" />
                    <MetricCardSmall title="Logrados" value={finalizados} color="bg-emerald-600" />
                    <MetricCardSmall title="Vivos" value={total - finalizados} color="bg-amber-600" />
                    <MetricCardSmall title="Eficacia" value={`${Math.round((finalizados/(total||1))*100)}%`} color="bg-indigo-600" />
                </div>
            </div>
        </main>
    );
};

const MetricCardSmall = ({ title, value, color }: any) => (
    <div className={`${color} p-4 md:p-6 rounded-[2rem] text-white shadow-xl transition-all hover:scale-105 border-b-4 border-black/20`}>
        <p className="text-[7px] md:text-[9px] font-black uppercase opacity-60 tracking-widest mb-1 leading-none">{title}</p>
        <p className="text-xl md:text-4xl font-black italic tracking-tighter leading-none">{value}</p>
    </div>
);