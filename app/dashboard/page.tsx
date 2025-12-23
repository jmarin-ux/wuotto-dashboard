'use client'
import { useEffect, useState, useMemo, useCallback } from 'react'
import { supabase } from '../../lib/supabaseClient' 
import { useRouter } from 'next/navigation' 
import { ModalDetalle } from '../components/ModalDetalle'
import { VistaClientes } from '../components/VistaClientes'
import { HeaderDashboard } from '../components/dashboard/HeaderDashboard'
import { NavegacionDashboard } from '../components/dashboard/NavegacionDashboard'
import { SeccionGestion } from '../components/dashboard/SeccionGestion'
import { SeccionAnalitica } from '../components/dashboard/SeccionAnalitica'
import { VistaControlExacto } from '../components/dashboard/VistaControlExacto'

export default function DashboardPage() {
    const ahora = new Date();
    const [servicios, setServicios] = useState<any[]>([]);
    const [perfiles, setPerfiles] = useState<any[]>([]);
    const [cargando, setCargando] = useState(true);
    const [usuarioActivo, setUsuarioActivo] = useState(''); 
    const [rolUsuario, setRolUsuario] = useState('');
    const [ticketSeleccionado, setTicketSeleccionado] = useState<any | null>(null);
    const [pestañaActiva, setPestañaActiva] = useState<'ordenes' | 'dashboard' | 'clientes' | 'control'>('ordenes');

    const [filtroMes, setFiltroMes] = useState<string>(ahora.getMonth().toString());
    const [filtroAnio, setFiltroAnio] = useState<string>(ahora.getFullYear().toString());
    const [filtroEstatus, setFiltroEstatus] = useState<string[]>([]); 
    const [filtroCliente, setFiltroCliente] = useState<string>('');
    const [filtroCoord, setFiltroCoord] = useState<string | null>(null);

    const router = useRouter();

    // --- NUEVO: Lógica de Contadores de Emergencia ---
    const statsEmergencia = useMemo(() => {
        const emergencias = servicios.filter(s => 
            s.tipo_mantenimiento?.toUpperCase().includes('EMERGENCIA')
        );
        return {
            total: emergencias.length,
            activas: emergencias.filter(s => 
                s.estatus !== 'EJECUTADO' && s.estatus !== 'CANCELADO' && s.estatus !== 'CERRADO'
            ).length
        };
    }, [servicios]);

    const enviarNotificacionCliente = async (ticket: any) => {
        if (!ticket.email_solicitante) return;
        try {
            await fetch('/api/notify-client', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: ticket.email_solicitante,
                    nombre: ticket["Nombre Completo"],
                    folio: ticket.codigo_servicio,
                    estatus: ticket.estatus,
                    empresa: ticket.Empresa
                })
            });
        } catch (error) { console.error("Error correos:", error); }
    };

    const initDashboard = useCallback(async (email: string) => {
        setCargando(true);
        const { data: pData } = await supabase.from('perfiles').select('*').ilike('email', email).maybeSingle();
        setRolUsuario(pData?.rol || 'operativo');
        const { data: sData } = await supabase.from('servicios').select('*').order('fecha_solicitud', { ascending: false });
        const { data: allP } = await supabase.from('perfiles').select('*');
        setServicios(sData || []); 
        setPerfiles(allP || []); 
        setCargando(false);
    }, []);

    useEffect(() => {
        const user = localStorage.getItem('USUARIO_ACTIVO');
        if (!user) router.replace('/login');
        else {
            const email = user.toLowerCase();
            setUsuarioActivo(email);
            initDashboard(email);
        }
    }, [initDashboard, router]);

    if (cargando) return <div className="h-screen flex items-center justify-center font-black italic text-[#121c32] animate-pulse uppercase">Cargando Sistema Wuotto...</div>;

    return (
        <div className="h-screen w-full flex flex-col bg-[#f4f7fa] text-black font-sans uppercase overflow-hidden relative">
            <HeaderDashboard usuarioActivo={usuarioActivo} rolUsuario={rolUsuario} servicios={servicios} />
            <NavegacionDashboard pestaña={pestañaActiva} setPestaña={setPestañaActiva} usuario={usuarioActivo} />

            <div className="flex-1 flex flex-col overflow-hidden relative">
                {pestañaActiva === 'ordenes' && (
                    <SeccionGestion 
                        servicios={servicios} perfiles={perfiles} setTicket={setTicketSeleccionado}
                        filtros={{filtroMes, filtroAnio, filtroEstatus, filtroCliente, filtroCoord}}
                        setters={{setFiltroMes, setFiltroAnio, setFiltroEstatus, setFiltroCliente, setFiltroCoord}}
                    />
                )}
                {pestañaActiva === 'dashboard' && <SeccionAnalitica servicios={servicios} perfiles={perfiles} rol={rolUsuario} />}
                
                {pestañaActiva === 'control' && (
                    <VistaControlExacto 
                        servicios={servicios} 
                        usuarioEmail={usuarioActivo} 
                        rolUsuario={rolUsuario} 
                        setTicket={setTicketSeleccionado}
                        statsEmergencia={statsEmergencia} // Pasamos los stats
                    />
                )}

                {pestañaActiva === 'clientes' && usuarioActivo === 'jmarin@cmw.com.mx' && (
                    <VistaClientes perfiles={perfiles} onUpdate={() => initDashboard(usuarioActivo)} rolUsuario={rolUsuario} />
                )}
            </div>

            {ticketSeleccionado && (
                <ModalDetalle 
                    ticket={ticketSeleccionado} 
                    onClose={()=>setTicketSeleccionado(null)} 
                    onUpdate={(updatedTicket?: any) => {
                        initDashboard(usuarioActivo);
                        if(updatedTicket) enviarNotificacionCliente(updatedTicket);
                    }} 
                    perfiles={perfiles} usuarioActivo={usuarioActivo} rolUsuario={rolUsuario} 
                />
            )}
        </div>
    );
}