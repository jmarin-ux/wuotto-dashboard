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
    
    // Filtros
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
            setUsuarioActivo(user.toUpperCase()); 
            loadData(user); 
            
            // --- AQUÍ EMPIEZA LA MAGIA REALTIME ---
            const canal = setupRealtimeSubscription();
            
            // Limpieza al salir de la pantalla
            return () => {
                supabase.removeChannel(canal);
            }
        }
    }, []);

    const loadData = async (email: string) => {
        setCargando(true);
        const { data: pData } = await supabase.from('perfiles').select('*').eq('email', email).single();
        setRolUsuario(pData?.rol || 'operativo');
        setNombreUsuario(pData?.nombre_completo || email.split('@')[0]);
        
        // Carga inicial normal
        const { data: s } = await supabase.from('servicios').select('*').order('fecha_solicitud', { ascending: false });
        const { data: allP } = await supabase.from('perfiles').select('*');
        
        setServicios(s || []); 
        setPerfiles(allP || []); 
        setCargando(false);
    };

    // --- FUNCIÓN DE SUSCRIPCIÓN REALTIME ---
    const setupRealtimeSubscription = () => {
        const channel = supabase
            .channel('cambios-servicios') // Nombre cualquiera para el canal
            .on(
                'postgres_changes', // Tipo de evento: Cambios en base de datos
                { event: '*', schema: 'public', table: 'servicios' }, // Escuchar TODO en tabla servicios
                (payload) => {
                    handleRealtimeEvent(payload);
                }
            )
            .subscribe();

        return channel;
    };

    // MANEJADOR DE CAMBIOS (Qué hacer cuando llega un dato nuevo)
    const handleRealtimeEvent = (payload: any) => {
        console.log("Cambio detectado en tiempo real:", payload);

        // 1. ALGUIEN CREÓ UN NUEVO TICKET
        if (payload.eventType === 'INSERT') {
            setServicios((prev) => [payload.new, ...prev]);
        }
        // 2. ALGUIEN ACTUALIZÓ UN TICKET (Estatus, comentario, etc.)
        else if (payload.eventType === 'UPDATE') {
            setServicios((prev) => prev.map((item) => item.id === payload.new.id ? payload.new : item));
            
            // Si el ticket que cambió es el que tengo abierto en el Modal, actualízalo también
            setTicketSeleccionado((prev: any) => {
                if (prev && prev.id === payload.new.id) {
                    return { ...prev, ...payload.new }; // Fusionamos los datos nuevos
                }
                return prev;
            });
        }
        // 3. ALGUIEN BORRÓ UN TICKET
        else if (payload.eventType === 'DELETE') {
            setServicios((prev) => prev.filter((item) => item.id !== payload.old.id));
            // Si estaba viendo el ticket borrado, cerrar el modal
            setTicketSeleccionado((prev: any) => prev && prev.id === payload.old.id ? null : prev);
        }
    };

    // Función auxiliar para actualización manual (respaldo)
    const handleUpdateManual = async () => {
        // Con Realtime esto es menos necesario, pero sirve de doble seguridad
        const { data: s } = await supabase.from('servicios').select('*').order('fecha_solicitud', { ascending: false });
        setServicios(s || []);
    };

    const toggleEstatus = (estatus: string) => {
        if (estatus === 'TOTAL') { setFiltroEstatus([]); return; }
        setFiltroEstatus(prev => prev.includes(estatus) ? prev.filter(e => e !== estatus) : [...prev, estatus]);
    };

    // Lógica de filtrado (sin cambios)
    const { filtrados, stats, statsCoord, totalM, isFiltered } = useMemo(() => {
        let base = servicios.filter(s => {
            const d = new Date(s.fecha_solicitud);
            return (filtroMes === 'all' || d.getMonth().toString() === filtroMes) && d.getFullYear().toString() === filtroAnio;
        });
        
        const st: any = { "TOTAL": base.length, "SIN ASIGNAR":0,"ASIGNADO":0,"EN PROCESO":0,"PENDIENTE":0,"EJECUTADO":0,"CERRADO":0,"CANCELADO":0 };
        base.forEach(s => { const key = (s.estatus || 'SIN ASIGNAR').toUpperCase().trim(); if(st.hasOwnProperty(key)) st[key]++; });
        const sc: any = { "SIN ASIGNAR": 0 };
        base.forEach(s => { const c = (s.coordinador || 'SIN ASIGNAR').toUpperCase(); sc[c] = (sc[c] || 0) + 1; });
        
        let final = base;
        if (filtroEstatus.length > 0) final = final.filter(s => filtroEstatus.includes((s.estatus || 'SIN ASIGNAR').toUpperCase()));
        if (filtroCoordinador) final = final.filter(s => (s.coordinador || 'SIN ASIGNAR').toUpperCase() === filtroCoordinador);
        if (filtroCliente) final = final.filter(s => s.tipo_mantenimiento?.toLowerCase().includes(filtroCliente.toLowerCase()));
        
        return { filtrados: final, stats: st, statsCoord: sc, totalM: base.length, isFiltered: (filtroEstatus.length > 0 || filtroCoordinador !== null || filtroCliente !== '') };
    }, [servicios, filtroMes, filtroAnio, filtroEstatus, filtroCoordinador, filtroCliente]);

    return (
        <div className="h-screen w-full flex flex-col bg-[#f8fafc] text-black font-sans uppercase overflow-hidden">
            <header className="bg-[#121c32] text-white flex-none z-50 shadow-xl px-8 py-4 flex justify-between items-center">
                <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-[#121c32] font-black italic shadow-lg">W</div>
                    <div><h1 className="text-xl font-black italic leading-none">WUOTTO</h1><p className="text-[9px] font-bold text-blue-400">{rolUsuario}</p></div>
                </div>
                <div className="flex items-center gap-6">
                    <div className="text-right hidden sm:block"><p className="text-[10px] font-black opacity-40 mb-0.5">Bienvenido</p><p className="text-xs font-black text-white tracking-widest">{nombreUsuario}</p></div>
                    <button onClick={()=>{localStorage.clear(); window.location.reload();}} className="bg-rose-500 hover:bg-rose-600 text-white px-4 py-2 rounded-xl text-[10px] font-black shadow-lg transition-all active:scale-95">SALIR 🚪</button>
                </div>
            </header>

            <div className="flex-none bg-white border-b p-4 px-8 flex flex-wrap gap-4 items-center justify-between shadow-sm">
                <div className="flex gap-4 items-center overflow-x-auto no-scrollbar">
                    <select value={filtroAnio} onChange={(e)=>setFiltroAnio(e.target.value)} className="p-3 border-2 border-slate-100 rounded-2xl text-[11px] font-black bg-slate-50 cursor-pointer"><option value="2025">2025</option><option value="2024">2024</option></select>
                    <select value={filtroMes} onChange={(e)=>setFiltroMes(e.target.value)} className="p-3 border-2 border-slate-100 rounded-2xl text-[11px] font-black bg-slate-50 min-w-[140px] cursor-pointer"><option value="all">TODO EL AÑO</option>{MESES.map((m, i) => <option key={m} value={i}>{m}</option>)}</select>
                    <div className="flex flex-col justify-center px-6 py-1 bg-blue-50 rounded-2xl border-2 border-blue-100 min-w-[140px] shadow-sm"><span className="text-[8px] font-black text-blue-400">SERVICIOS MES</span><span className="text-xl font-black text-blue-700 leading-none">{totalM}</span></div>
                </div>
                <div className="flex-1 max-w-sm"><input type="text" value={filtroCliente} onChange={(e)=>setFiltroCliente(e.target.value)} placeholder="🔍 BUSCAR CLIENTE..." className="w-full p-3 border-2 border-slate-100 rounded-2xl text-[11px] font-black outline-none" /></div>
            </div>

            {isFiltered && (
                <div className="flex-none bg-blue-50/50 border-b border-blue-100 px-8 py-2 flex items-center justify-between">
                    <div className="flex items-center gap-3"><p className="text-[9px] font-black text-blue-700 tracking-widest uppercase">Filtros Activos en Pantalla</p></div>
                    <button onClick={()=>{setFiltroEstatus([]); setFiltroCoordinador(null); setFiltroCliente('')}} className="text-[9px] font-black text-rose-500 hover:text-rose-700 underline tracking-tighter">BORRAR TODOS LOS FILTROS X</button>
                </div>
            )}

            <div className="flex-none bg-white px-8 py-3 overflow-x-auto no-scrollbar flex gap-2 border-b">
                <button onClick={()=>setFiltroCoordinador(null)} className={`px-5 py-2 rounded-full text-[10px] font-black border-2 transition-all ${!filtroCoordinador ? 'bg-[#121c32] text-white border-[#121c32]' : 'bg-white text-slate-500 border-slate-200 shadow-sm'}`}>TODOS</button>
                {Object.entries(statsCoord).map(([coord, count]: any) => (
                    <button key={coord} onClick={()=>setFiltroCoordinador(coord)} className={`flex items-center gap-2 px-4 py-2 rounded-full border-2 transition-all ${filtroCoordinador === coord ? 'bg-blue-600 text-white border-blue-600 shadow-md' : 'bg-white text-slate-600 border-slate-200'}`}>
                        <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black ${filtroCoordinador===coord ? 'bg-white text-blue-600' : 'bg-slate-100'}`}>{count}</div><span className="text-[9px] font-black uppercase">{coord.split('@')[0]}</span>
                    </button>
                ))}
            </div>

            <div className="flex-none bg-[#f8fafc] px-8 py-6 overflow-x-auto no-scrollbar flex gap-6 border-b border-slate-200 shadow-inner">
                {Object.entries(stats).map(([key, val]: any) => {
                    const isSelected = filtroEstatus.includes(key);
                    const styles = getStatusStyles(key);
                    return (
                        <div key={key} onClick={()=>toggleEstatus(key)} className="flex-none flex flex-col items-center cursor-pointer group w-20">
                            <div className={`w-16 h-20 ${styles.ribbon} rounded-b-[2.2rem] flex items-center justify-center text-white text-2xl font-black shadow-xl transition-all duration-300 ${isSelected ? '-translate-y-4 ring-4 ring-blue-400 scale-110' : 'group-hover:-translate-y-1'}`}>{val}</div>
                            <span className={`mt-4 text-[9px] font-black tracking-widest text-center transition-colors ${isSelected ? 'text-blue-700' : 'text-slate-400 uppercase'}`}>{key.replace(/\s/g, '\n')}</span>
                        </div>
                    )
                })}
            </div>

            <main className="flex-1 overflow-y-auto px-8 pb-20 pt-10 bg-slate-50/50 scroll-smooth">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
                    {filtrados.map(t => {
                         const p = (t.tipo_mantenimiento || "").split('|');
                         return (
                            <div key={t.id} className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-2xl hover:-translate-y-2 transition-all duration-300 overflow-hidden flex flex-col min-h-[300px]">
                                <div className="p-4 text-center bg-slate-50/30">
                                    <h3 className="text-xl font-black italic text-[#121c32] mb-1">{t.codigo_servicio}</h3>
                                    <span className={`inline-block px-3 py-1 rounded-full text-[8px] font-black uppercase ${getStatusStyles(t.estatus).badge}`}>{t.estatus}</span>
                                </div>
                                <div className="px-6 py-4 flex-1 space-y-3">
                                    <div><p className="text-[7px] font-black text-slate-400 uppercase tracking-tighter mb-1 leading-none">Empresa / Cliente</p><p className="text-[10px] font-black text-slate-800 line-clamp-1 italic uppercase">{p[1]} / {p[2]}</p></div>
                                    <div><p className="text-[7px] font-black text-slate-400 uppercase tracking-tighter mb-1 leading-none">Servicio</p><p className="text-[10px] font-bold text-slate-700 line-clamp-1 uppercase leading-tight">{p[0]}</p></div>
                                    <div><p className="text-[7px] font-black text-slate-400 uppercase tracking-tighter mb-1 leading-none">Ubicación</p><p className="text-[9px] font-medium text-slate-500 line-clamp-1 italic uppercase">{p[3] || "N/A"}</p></div>
                                </div>
                                <div className="p-4 flex justify-between items-center bg-slate-50/30 px-8">
                                    <span className="text-[9px] font-black text-slate-300 italic">{new Date(t.fecha_solicitud).toLocaleDateString()}</span>
                                    <button onClick={()=>setTicketSeleccionado(t)} className="bg-[#121c32] text-white px-5 py-2 rounded-full text-[8px] font-black tracking-widest hover:bg-blue-600 transition-all active:scale-95 shadow-lg shadow-slate-200 uppercase">Detalle →</button>
                                </div>
                            </div>
                        )
                    })}
                </div>
            </main>
            {/* ModalDetalle recibe "ticketSeleccionado" que ahora se actualiza solo gracias a Realtime */}
            {ticketSeleccionado && (
                <ModalDetalle 
                    ticket={ticketSeleccionado} 
                    onClose={()=>setTicketSeleccionado(null)} 
                    onUpdate={handleUpdateManual} // Se mantiene como respaldo
                    perfiles={perfiles} 
                    usuarioActivo={usuarioActivo} 
                    rolUsuario={rolUsuario} 
                />
            )}
        </div>
    );
}