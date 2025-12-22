'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabaseClient'

export const ModalAprobacion = ({ onClose, onUpdate }: any) => {
    const [solicitudes, setSolicitudes] = useState<any[]>([]);
    const [procesando, setProcesando] = useState(false);

    // Cargar la lista de espera al abrir
    useEffect(() => {
        const cargarSolicitudes = async () => {
            const { data } = await supabase
                .from('solicitudes_registro')
                .select('*')
                .eq('estatus', 'PENDIENTE')
                .order('created_at', { ascending: false });
            
            if (data) setSolicitudes(data);
        };
        cargarSolicitudes();
    }, []);

    const procesarSolicitud = async (solicitud: any, accion: 'APROBAR' | 'RECHAZAR') => {
        if (procesando) return;
        
        const mensaje = accion === 'APROBAR' 
            ? `¿Dar acceso al sistema a ${solicitud.nombre_completo}?` 
            : `¿Rechazar y eliminar la solicitud de ${solicitud.nombre_completo}?`;

        if (!confirm(mensaje)) return;

        setProcesando(true);

        try {
            if (accion === 'APROBAR') {
                // 1. Crear el usuario en la tabla oficial de PERFILES (Lista Blanca)
                // OJO: Aquí asignamos el rol 'cliente' por defecto
                const { error: errorPerfil } = await supabase.from('perfiles').insert({
                    email: solicitud.email,
                    nombre_completo: solicitud.nombre_completo,
                    empresa: solicitud.empresa, // Asegúrate que tu tabla perfiles tenga esta columna
                    telefono: solicitud.telefono,
                    rol: 'cliente', 
                    creado_en: new Date().toISOString()
                });

                if (errorPerfil) throw errorPerfil;
            }

            // 2. Actualizar el estatus en la tabla de solicitudes (para que ya no salga pendiente)
            const estatusFinal = accion === 'APROBAR' ? 'APROBADO' : 'RECHAZADO';
            await supabase.from('solicitudes_registro')
                .update({ estatus: estatusFinal })
                .eq('id', solicitud.id);

            // 3. Actualizar la lista visualmente
            setSolicitudes(prev => prev.filter(s => s.id !== solicitud.id));
            
            if (accion === 'APROBAR') alert(`✅ ${solicitud.nombre_completo} ahora puede ingresar solicitudes.`);
            
            // Avisar al dashboard que hubo cambios (opcional)
            if (onUpdate) onUpdate();

        } catch (error: any) {
            alert("Error al procesar: " + error.message);
        } finally {
            setProcesando(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-[#121c32]/90 backdrop-blur-sm flex justify-center items-center z-[100] p-4 animate-in fade-in duration-300">
            <div className="bg-white w-full max-w-3xl rounded-[2rem] overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
                
                {/* Header del Modal */}
                <div className="bg-amber-400 px-6 py-4 flex justify-between items-center text-[#121c32]">
                    <div className="flex items-center gap-3">
                        <span className="text-2xl">🔐</span>
                        <div>
                            <h2 className="text-lg font-black italic tracking-tighter uppercase leading-none">CONTROL DE ACCESOS</h2>
                            <p className="text-[10px] font-bold uppercase opacity-70">Solicitudes Pendientes: {solicitudes.length}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="bg-black/10 hover:bg-black/20 w-8 h-8 rounded-full flex items-center justify-center transition-all font-bold">✕</button>
                </div>

                {/* Lista de Solicitudes */}
                <div className="p-6 overflow-y-auto bg-[#f8fafc] flex-1 space-y-4">
                    {solicitudes.length === 0 ? (
                        <div className="text-center py-16 opacity-50 flex flex-col items-center">
                            <span className="text-4xl mb-2">✅</span>
                            <p className="text-sm font-black text-slate-400 uppercase">Todo al día</p>
                            <p className="text-xs text-slate-300">No hay solicitudes pendientes</p>
                        </div>
                    ) : (
                        solicitudes.map((s) => (
                            <div key={s.id} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4 hover:border-blue-200 transition-all group">
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="bg-blue-100 text-blue-700 text-[9px] font-black px-2 py-0.5 rounded uppercase">{s.empresa}</span>
                                        <span className="text-[9px] text-slate-400 font-bold">{new Date(s.created_at).toLocaleDateString()}</span>
                                    </div>
                                    <h3 className="text-sm font-black text-[#121c32] uppercase">{s.nombre_completo}</h3>
                                    <p className="text-xs font-bold text-slate-500">{s.email}</p>
                                    <p className="text-[10px] text-slate-400 mt-0.5">📞 {s.telefono || 'Sin teléfono'}</p>
                                </div>

                                <div className="flex gap-2 w-full md:w-auto">
                                    <button 
                                        onClick={() => procesarSolicitud(s, 'RECHAZAR')}
                                        disabled={procesando}
                                        className="flex-1 md:flex-none px-4 py-2 rounded-xl border border-slate-200 text-slate-400 hover:bg-red-50 hover:text-red-600 hover:border-red-200 text-[10px] font-black uppercase transition-all"
                                    >
                                        Rechazar
                                    </button>
                                    <button 
                                        onClick={() => procesarSolicitud(s, 'APROBAR')}
                                        disabled={procesando}
                                        className="flex-1 md:flex-none bg-[#121c32] text-white px-6 py-2 rounded-xl text-[10px] font-black uppercase shadow-lg hover:bg-emerald-600 hover:shadow-emerald-200 transition-all flex items-center justify-center gap-2"
                                    >
                                        {procesando ? '...' : '✅ HABILITAR ACCESO'}
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};