'use client'
import { useEffect, useState, useMemo } from 'react'
import { supabase } from '../../lib/supabaseClient' 
import { useRouter } from 'next/navigation' 
import { ModalDetalle } from '../components/ModalDetalle'
import { getStatusStyles, MESES } from '../../lib/utils'

export default function DashboardPage() {
    const ahora = new Date();
    const [servicios, setServicios] = useState<any[]>([]);
    const [perfiles, setPerfiles] = useState<any[]>([]);
    const [cargando, setCargando] = useState(true);
    const [usuarioActivo, setUsuarioActivo] = useState(''); 
    const [nombreUsuario, setNombreUsuario] = useState('');
    const [rolUsuario, setRolUsuario] = useState('');
    const [ticketSeleccionado, setTicketSeleccionado] = useState<any | null>(null);
    
    // Filtros mantenidos íntegramente
    const [filtroMes, setFiltroMes] = useState<string>(ahora.getMonth().toString());
    const [filtroAnio, setFiltroAnio] = useState<string>(ahora.getFullYear().toString());
    const [filtroEstatus, setFiltroEstatus] = useState<string[]>([]); 
    const [filtroCoordinador, setFiltroCoordinador] = useState<string | null>(null); 
    const [filtroCliente, setFiltroCliente] = useState<string>('');

    const router = useRouter();

    useEffect(() => {
        const user = localStorage.getItem('USUARIO_ACTIVO');
        if (!user) {
            router.replace('/login');
        } else { 
            const emailLower = user.toLowerCase();
            setUsuarioActivo(emailLower); 
            initDashboard(emailLower); 
        }

        return () => {
            supabase.channel('cambios-servicios').unsubscribe();
        }
    }, []);

    const initDashboard = async (email: string) => {
        setCargando(true);
        
        // 1. Obtener Perfil (Manejo de email compartido)
        const { data: pData } = await supabase.from('perfiles').select('*').eq('email', email).maybeSingle();
        const userRole = pData?.rol || 'operativo';
        setRolUsuario(userRole);
        setNombreUsuario(pData?.nombre_completo || email.split('@')[0]);

        // 2. Consulta de Servicios - SEGURIDAD POR ROL
        let query = supabase.from('servicios').select('*');
        
        if (userRole === 'coordinador') {
            query = query.eq('coordinador', email);
        } else if (userRole === 'operativo') {
            query = query.eq('personal_operativo', email);
        }
        // Admin ve todo (incluyendo nulos/sin asignar)

        const { data: s } = await query.order('fecha_solicitud', { ascending: false });
        const { data: allP } = await supabase.from('perfiles').select('*');
        
        setServicios(s || []); 
        setPerfiles(allP || []); 
        setCargando(false);

        setupRealtimeSubscription(userRole, email);
    };

    const setupRealtimeSubscription = (role: string, email: string) => {
        supabase
            .channel('cambios-servicios')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'servicios' }, (payload) => {
                const data = payload.new || payload.old;
                const esMio = role === 'admin' || 
                             (role === 'coordinador' && data.coordinador?.toLowerCase() === email) ||
                             (role === 'operativo' && data.personal_operativo?.toLowerCase() === email);

                if (esMio) handleRealtimeEvent(payload);
            }).subscribe();
    };

    const handleRealtimeEvent = (payload: any) => {
        if (payload.eventType === 'INSERT') setServicios((prev) => [payload.new, ...prev]);
        else if (payload.eventType === 'UPDATE') {
            setServicios((prev) => prev.map((item) => item.id === payload.new.id ? payload.new : item));
            setTicketSeleccionado((prev: any) => (prev && prev.id === payload.new.id ? payload.new : prev));
        }
        else if (payload.eventType === 'DELETE') setServicios((prev) => prev.filter((item) => item.id !== payload.old.id));
    };

    const toggleEstatus = (estatus: string) => {
        if (estatus === 'TOTAL') { setFiltroEstatus([]); return; }
        setFiltroEstatus(prev => prev.includes(estatus) ? prev.filter(e => e !== estatus) : [...prev, estatus]);
    };

    const { filtrados, stats, statsCoord, totalM, isFiltered } = useMemo(() => {
        let base = servicios.filter(s => {
            const d = new Date(s.fecha_solicitud);
            return (filtroMes === 'all' || d.getMonth().toString() === filtroMes) && d.getFullYear().toString() === filtroAnio;
        });
        
        const st: any = { "TOTAL": base.length, "SIN ASIGNAR":0,"ASIGNADO":0,"EN PROCESO":0,"PENDIENTE":0,"EJECUTADO":0,"CERRADO":0,"CANCELADO":0 };
        base.forEach(s => { 
            const key = (s.estatus || 'SIN ASIGNAR').toUpperCase().trim(); 
            if(st.hasOwnProperty(key)) st[key]++; 
        });
        
        const sc: any = {};
        base.forEach(s => { if(s.coordinador) { const c = s.coordinador.toUpperCase(); sc[c] = (sc[c] || 0) + 1; } });
        
        let final = base;
        if (filtroEstatus.length > 0) final = final.filter(s => filtroEstatus.includes((s.estatus || 'SIN ASIGNAR').toUpperCase()));
        if (filtroCoordinador) final = final.filter(s => s.coordinador?.toUpperCase() === filtroCoordinador);
        if (filtroCliente) {
            const search = filtroCliente.toLowerCase();
            final = final.filter(s => s.tipo_mantenimiento?.toLowerCase().includes(search) || s.codigo_servicio?.toLowerCase().includes(search));
        }
        
        return { filtrados: final, stats: st, statsCoord: sc, totalM: base.length, isFiltered: (filtroEstatus.length > 0 || filtroCoordinador !== null || filtroCliente !== '') };
    }, [servicios, filtroMes, filtroAnio, filtroEstatus, filtroCoordinador, filtroCliente]);

    return (
        <div className="h-screen w-full flex flex-col bg-[#f8fafc] text-black font-sans uppercase overflow-hidden">
            {/* Header Adaptado */}
            <header className="bg-[#121c32] text-white flex-none z-50 shadow-xl px-4 md:px-8 py-3 md:py-4 flex justify-between items-center">
                <div className="flex items-center gap-3 md:gap-4">
                    <div className="w-8 h-8 md:w-10 md:h-10 bg-white rounded-lg md:rounded-xl flex items-center justify-center text-[#121c32] font-black italic shadow-lg">W</div>
                    <div>
                        <h1 className="text-lg md:text-xl font-black italic leading-none">WUOTTO</h1>
                        <p className="text-[7px] md:text-[9px] font-bold text-blue-400 uppercase">{rolUsuario}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2 md:gap-6">
                    <div className="text-right hidden md:block">
                        <p className="text-[10px] font-black opacity-40 mb-0.5 uppercase">Bienvenido</p>
                        <p className="text-xs font-black text-white tracking-widest uppercase truncate max-w-[150px]">{nombreUsuario}</p>
                    </div>
                    <button onClick={()=>{localStorage.clear(); window.location.reload();}} className="bg-rose-500 hover:bg-rose-600 text-white px-3 md:px-4 py-1.5 md:py-2 rounded-lg text-[9px] md:text-[10px] font-black shadow-lg transition-all active:scale-95">SALIR 🚪</button>
                </div>
            </header>

            {/* Filtros Superiores Adaptados */}
            <div className="flex-none bg-white border-b p-3 md:p-4 px-4 md:px-8 flex flex-col md:flex-row gap-3 md:gap-4 items-stretch md:items-center justify-between shadow-sm">
                <div className="flex gap-2 md:gap-4 items-center overflow-x-auto no-scrollbar pb-1 md:pb-0">
                    <select value={filtroAnio} onChange={(e)=>setFiltroAnio(e.target.value)} className="p-2 md:p-3 border-2 border-slate-100 rounded-xl text-[10px] md:text-[11px] font-black bg-slate-50 uppercase cursor-pointer"><option value="2025">2025</option><option value="2024">2024</option></select>
                    <select value={filtroMes} onChange={(e)=>setFiltroMes(e.target.value)} className="p-2 md:p-3 border-2 border-slate-100 rounded-xl text-[10px] md:text-[11px] font-black bg-slate-50 min-w-[110px] md:min-w-[140px] uppercase cursor-pointer"><option value="all">TODO EL AÑO</option>{MESES.map((m, i) => <option key={m} value={i}>{m}</option>)}</select>
                    <div className="flex flex-col justify-center px-4 md:px-6 py-1 bg-blue-50 rounded-xl border-2 border-blue-100 min-w-[100px] md:min-w-[140px] shadow-sm">
                        <span className="text-[7px] md:text-[8px] font-black text-blue-400 uppercase">{rolUsuario === 'admin' ? 'PANEL CONTROL' : 'MIS TAREAS'}</span>
                        <span className="text-lg md:text-xl font-black text-blue-700 leading-none">{totalM}</span>
                    </div>
                </div>
                <div className="flex-1 md:max-w-sm">
                    <input type="text" value={filtroCliente} onChange={(e)=>setFiltroCliente(e.target.value)} placeholder="🔍 BUSCAR..." className="w-full p-2.5 md:p-3 border-2 border-slate-100 rounded-xl text-[10px] md:text-[11px] font-black outline-none uppercase" />
                </div>
            </div>

            {/* Filtros Coordinadores (Solo Admin) con Scroll Horizontal */}
            {rolUsuario === 'admin' && Object.keys(statsCoord).length > 0 && (
                <div className="flex-none bg-white px-4 md:px-8 py-2 md:py-3 overflow-x-auto no-scrollbar flex gap-2 border-b">
                    <button onClick={()=>setFiltroCoordinador(null)} className={`flex-none px-4 md:px-5 py-1.5 md:py-2 rounded-full text-[9px] md:text-[10px] font-black border-2 transition-all ${!filtroCoordinador ? 'bg-[#121c32] text-white border-[#121c32]' : 'bg-white text-slate-500 border-slate-200 shadow-sm'}`}>TODOS</button>
                    {Object.entries(statsCoord).map(([coord, count]: any) => (
                        <button key={coord} onClick={()=>setFiltroCoordinador(coord)} className={`flex-none flex items-center gap-2 px-3 md:px-4 py-1.5 md:py-2 rounded-full border-2 transition-all ${filtroCoordinador === coord ? 'bg-blue-600 text-white border-blue-600 shadow-md' : 'bg-white text-slate-600 border-slate-200'}`}>
                            <div className={`w-4 h-4 md:w-5 md:h-5 rounded-full flex items-center justify-center text-[8px] md:text-[9px] font-black ${filtroCoordinador===coord ? 'bg-white text-blue-600' : 'bg-slate-100'}`}>{count}</div>
                            <span className="text-[8px] md:text-[9px] font-black uppercase truncate max-w-[80px] md:max-w-none">{coord.split('@')[0]}</span>
                        </button>
                    ))}
                </div>
            )}

            {/* Ribbons de Estatus con Scroll Horizontal */}
            <div className="flex-none bg-[#f8fafc] px-4 md:px-8 py-4 md:py-6 overflow-x-auto no-scrollbar flex gap-4 md:gap-6 border-b border-slate-200 shadow-inner">
                {Object.entries(stats).map(([key, val]: any) => {
                    const isSelected = filtroEstatus.includes(key);
                    const styles = getStatusStyles(key);
                    return (
                        <div key={key} onClick={()=>toggleEstatus(key)} className="flex-none flex flex-col items-center cursor-pointer group w-16 md:w-20">
                            <div className={`w-12 h-16 md:w-16 md:h-20 ${styles.ribbon} rounded-b-[1.5rem] md:rounded-b-[2.2rem] flex items-center justify-center text-white text-xl md:text-2xl font-black shadow-xl transition-all duration-300 ${isSelected ? '-translate-y-2 ring-4 ring-blue-400 scale-110' : 'group-hover:-translate-y-1'}`}>{val}</div>
                            <span className={`mt-3 md:mt-4 text-[7px] md:text-[9px] font-black tracking-widest text-center transition-colors uppercase ${isSelected ? 'text-blue-700' : 'text-slate-400'}`}>{key.replace(/\s/g, '\n')}</span>
                        </div>
                    )
                })}
            </div>

            {/* Grid de Cards Adaptado */}
            <main className="flex-1 overflow-y-auto px-4 md:px-8 pb-20 pt-6 md:pt-10 bg-slate-50/50 scroll-smooth">
                {cargando ? (
                    <div className="h-full flex items-center justify-center text-slate-400 font-black tracking-widest uppercase animate-pulse">Sincronizando...</div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-8 max-w-[1600px] mx-auto">
                        {filtrados.map(t => {
                             const p = (t.tipo_mantenimiento || "").split('|');
                             return (
                                <div key={t.id} className="bg-white rounded-[2rem] md:rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-2xl hover:-translate-y-1 md:hover:-translate-y-2 transition-all duration-300 overflow-hidden flex flex-col min-h-[260px] md:min-h-[300px]">
                                    <div className="p-3 md:p-4 text-center bg-slate-50/30">
                                        <h3 className="text-lg md:text-xl font-black italic text-[#121c32] mb-1">{t.codigo_servicio}</h3>
                                        <span className={`inline-block px-2.5 md:px-3 py-1 rounded-full text-[7px] md:text-[8px] font-black uppercase ${getStatusStyles(t.estatus).badge}`}>{t.estatus}</span>
                                    </div>
                                    <div className="px-5 md:px-6 py-3 md:py-4 flex-1 space-y-2 md:space-y-3">
                                        <div><p className="text-[6px] md:text-[7px] font-black text-slate-400 uppercase leading-none mb-1">Empresa / Cliente</p><p className="text-[9px] md:text-[10px] font-black text-slate-800 line-clamp-1 italic uppercase">{p[1]} / {p[2]}</p></div>
                                        <div><p className="text-[6px] md:text-[7px] font-black text-slate-400 uppercase leading-none mb-1">Servicio</p><p className="text-[9px] md:text-[10px] font-bold text-slate-700 line-clamp-2 uppercase leading-tight">{p[0]}</p></div>
                                        <div><p className="text-[6px] md:text-[7px] font-black text-slate-400 uppercase leading-none mb-1">Ubicación</p><p className="text-[8px] md:text-[9px] font-medium text-slate-500 line-clamp-1 italic uppercase">{p[3] || "N/A"}</p></div>
                                    </div>
                                    <div className="p-3 md:p-4 flex justify-between items-center bg-slate-50/30 px-6 md:px-8 border-t border-slate-50">
                                        <span className="text-[8px] md:text-[9px] font-black text-slate-300 italic uppercase">{new Date(t.fecha_solicitud).toLocaleDateString()}</span>
                                        <button onClick={()=>setTicketSeleccionado(t)} className="bg-[#121c32] text-white px-4 md:px-5 py-1.5 md:py-2 rounded-full text-[7px] md:text-[8px] font-black tracking-widest hover:bg-blue-600 transition-all active:scale-95 shadow-lg uppercase">Detalle →</button>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </main>
            {ticketSeleccionado && <ModalDetalle ticket={ticketSeleccionado} onClose={()=>setTicketSeleccionado(null)} onUpdate={() => initDashboard(usuarioActivo)} perfiles={perfiles} usuarioActivo={usuarioActivo} rolUsuario={rolUsuario} />}
        </div>
    );
}