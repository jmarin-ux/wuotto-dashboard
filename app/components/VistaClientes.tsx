'use client'
import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../../lib/supabaseClient'
// IMPORTAMOS LA ACCIÓN DEL SERVIDOR
import { invitarUsuarioPorCorreo } from '../actions/invitar' 

export const VistaClientes = ({ perfiles, onUpdate, rolUsuario }: any) => {
    const [solicitudes, setSolicitudes] = useState<any[]>([]);
    const [procesando, setProcesando] = useState(false);
    const [busqueda, setBusqueda] = useState('');
    
    const [clienteEdicion, setClienteEdicion] = useState<any>(null);
    const esAdminGeneral = rolUsuario === 'admin';

    const coordinadoresDisponibles = useMemo(() => {
        return perfiles.filter((p: any) => p.rol === 'coordinador' || p.rol === 'admin');
    }, [perfiles]);

    useEffect(() => {
        cargarSolicitudes();
    }, []);

    const cargarSolicitudes = async () => {
        const { data } = await supabase
            .from('solicitudes_registro')
            .select('*')
            .eq('estatus', 'PENDIENTE')
            .order('created_at', { ascending: false });
        if (data) setSolicitudes(data);
    };

    const handleAsignarCoordinadorFijo = async (clienteId: string, coordinadorEmail: string) => {
        setProcesando(true);
        try {
            const { error } = await supabase
                .from('perfiles')
                .update({ coordinador_asignado: coordinadorEmail })
                .eq('id', clienteId);

            if (error) throw error;
            if (onUpdate) onUpdate(); 
        } catch (error: any) {
            alert("Error al asignar coordinador fijo: " + error.message);
        } finally {
            setProcesando(false);
        }
    };

    const handleActualizarCliente = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setProcesando(true);
        const formData = new FormData(e.currentTarget);
        const updates = {
            nombre_completo: formData.get('nombre'),
            empresa: formData.get('empresa'),
            puesto: formData.get('puesto'),
            telefono: formData.get('telefono'),
        };
        try {
            const { error } = await supabase.from('perfiles').update(updates).eq('id', clienteEdicion.id);
            if (error) throw error;
            setClienteEdicion(null);
            if (onUpdate) onUpdate(); 
            alert("✅ Cliente actualizado correctamente");
        } catch (error: any) {
            alert("Error al actualizar: " + error.message);
        } finally {
            setProcesando(false);
        }
    };

    const exportarCSV = () => {
        const clientesParaExportar = perfiles.filter((p: any) => p.rol === 'cliente');
        const encabezados = ["Empresa", "Nombre", "Puesto", "Contacto", "Correo", "Coordinador Fijo"];
        const filas = clientesParaExportar.map((c: any) => [
            `"${c.empresa || ''}"`, `"${c.nombre_completo || ''}"`, `"${c.puesto || 'CLIENTE'}"`,
            `"${c.telefono || 'S/N'}"`, `"${c.email || ''}"`, `"${c.coordinador_asignado || 'SIN ASIGNAR'}"`
        ].join(","));
        const contenidoCSV = [encabezados.join(","), ...filas].join("\n");
        const blob = new Blob([contenidoCSV], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `BASE_CLIENTES_WUOTTO_${new Date().getFullYear()}.csv`);
        link.click();
    };

    // --- LÓGICA DE APROBACIÓN CORREGIDA (Upsert para evitar duplicados) ---
    const procesarAcceso = async (solicitud: any, accion: 'APROBAR' | 'RECHAZAR') => {
        if (procesando) return;
        if (!confirm(`¿Confirmas ${accion.toLowerCase()} a ${solicitud.nombre_completo}?`)) return;

        setProcesando(true);
        try {
            if (accion === 'APROBAR') {
                // 1. Usamos la Server Action para invitar (Seguro)
                const resultado = await invitarUsuarioPorCorreo(solicitud.email);
                
                // Si falla (ej. usuario ya existe en Auth), solo logueamos advertencia y continuamos
                // para asegurar que se cree/actualice su perfil en la base de datos.
                if (!resultado.success) {
                    console.warn("Aviso de Auth:", resultado.error);
                }

                const userId = resultado.userId;
                if (!userId) throw new Error("No se pudo obtener el ID del usuario.");

                // 2. UPSERT: Soluciona el error "duplicate key value"
                // Si el ID ya existe, actualiza los datos. Si no existe, lo crea.
                const { error: errorPerfil } = await supabase.from('perfiles').upsert({
                    id: userId, 
                    email: solicitud.email,
                    nombre_completo: solicitud.nombre_completo,
                    empresa: solicitud.empresa,
                    telefono: solicitud.telefono,
                    puesto: solicitud.puesto || 'CLIENTE',
                    rol: 'cliente',
                    // Importante: Al hacer upsert, si ya tiene coordinador asignado, esto podría sobrescribirlo.
                    // Si quieres ser más estricto, podrías checar si existe antes, pero para aprobación inicial esto es seguro.
                    coordinador_asignado: '' 
                }, { onConflict: 'id' });

                if (errorPerfil) throw errorPerfil;
            }

            // Actualizamos la solicitud original
            await supabase.from('solicitudes_registro')
                .update({ estatus: accion === 'APROBAR' ? 'APROBADO' : 'RECHAZAR' })
                .eq('id', solicitud.id);

            setSolicitudes(prev => prev.filter(s => s.id !== solicitud.id));
            if (onUpdate) onUpdate();
            alert(`✅ Proceso completado. El cliente ha sido ${accion === 'APROBAR' ? 'aprobado correctamente' : 'rechazado'}.`);
        } catch (e: any) {
            alert("Error al procesar: " + e.message);
        } finally {
            setProcesando(false);
        }
    };

    const clientesActivos = perfiles.filter((p: any) => 
        p.rol === 'cliente' && 
        (p.nombre_completo.toUpperCase().includes(busqueda.toUpperCase()) || 
         p.empresa.toUpperCase().includes(busqueda.toUpperCase()))
    );

    return (
        <main className="flex-1 overflow-y-auto p-4 md:p-10 bg-[#f8fafc] space-y-10 animate-in fade-in duration-500">
            {/* SALA DE ESPERA */}
            <section className="max-w-[1600px] mx-auto">
                <div className="flex items-center gap-4 mb-8">
                    <div className="w-12 h-12 bg-amber-400 rounded-2xl flex items-center justify-center text-2xl shadow-lg shadow-amber-200">⏳</div>
                    <div>
                        <h2 className="text-sm font-black text-[#121c32] tracking-[0.2em] uppercase italic leading-none">Sala de Espera</h2>
                        <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase">Revisión de solicitudes pendientes ({solicitudes.length})</p>
                    </div>
                </div>
                {solicitudes.length === 0 ? (
                    <div className="bg-white rounded-[2.5rem] p-16 border-2 border-dashed border-slate-200 text-center">
                        <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest italic">No hay registros pendientes de revisión</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {solicitudes.map(s => (
                            <div key={s.id} className="bg-white p-7 rounded-[2.5rem] shadow-sm border border-slate-100 flex flex-col justify-between hover:shadow-2xl transition-all duration-500 group">
                                <div>
                                    <div className="flex justify-between items-start mb-5">
                                        <span className="bg-blue-50 text-blue-600 text-[9px] font-black px-3 py-1.5 rounded-xl uppercase italic border border-blue-100">{s.empresa}</span>
                                        <span className="text-[9px] font-black text-slate-400 uppercase italic">{s.puesto || 'CLIENTE'}</span>
                                    </div>
                                    <h3 className="text-base font-black text-[#121c32] uppercase leading-tight group-hover:text-blue-600 transition-colors">{s.nombre_completo}</h3>
                                    <p className="text-[11px] font-bold text-slate-400 mt-1">{s.email}</p>
                                    <div className="mt-5 flex items-center gap-3 bg-slate-50 p-3 rounded-2xl">
                                        <span className="text-lg">📞</span>
                                        <span className="text-[11px] font-black text-[#121c32]">{s.telefono}</span>
                                    </div>
                                </div>
                                <div className="flex gap-3 mt-8">
                                    <button onClick={() => procesarAcceso(s, 'APROBAR')} disabled={procesando} className="flex-1 bg-[#121c32] text-white text-[10px] font-black py-3.5 rounded-2xl uppercase italic hover:bg-blue-900 transition-all">Aprobar e Invitar</button>
                                    <button onClick={() => procesarAcceso(s, 'RECHAZAR')} disabled={procesando} className="px-5 text-slate-300 hover:text-red-500 text-[10px] font-black uppercase transition-colors">Borrar</button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </section>

            {/* BASE DE DATOS ACTIVA */}
            <section className="max-w-[1600px] mx-auto pb-20">
                <div className="flex flex-col md:flex-row justify-between items-center gap-6 mb-8 border-b border-slate-200 pb-8">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center text-2xl shadow-lg shadow-blue-200">👥</div>
                        <div>
                            <h2 className="text-sm font-black text-[#121c32] tracking-[0.2em] uppercase italic leading-none">Clientes Activos</h2>
                            <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase">Base de datos centralizada ({clientesActivos.length})</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3 w-full md:w-auto">
                        <button onClick={exportarCSV} className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3.5 rounded-2xl text-[10px] font-black uppercase italic shadow-lg active:scale-95 flex items-center gap-2"><span>📊</span> CSV</button>
                        <div className="w-full md:w-80 relative">
                            <input type="text" placeholder="🔍 BUSCAR..." className="w-full bg-white border border-slate-200 rounded-2xl px-6 py-3.5 text-[11px] font-black outline-none focus:ring-4 focus:ring-blue-500/5 shadow-sm transition-all uppercase" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-[3rem] shadow-2xl border border-slate-100 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-slate-50/50 border-b border-slate-100">
                                <tr>
                                    <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] italic text-center">Empresa</th>
                                    <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] italic text-center">Nombre</th>
                                    <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] italic text-center">Coordinador Fijo</th>
                                    <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] italic text-center">Puesto</th>
                                    <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] italic text-center">Contacto</th>
                                    <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] italic text-center">Correo</th>
                                    {esAdminGeneral && <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase italic text-center">Acciones</th>}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {clientesActivos.map((c: any) => (
                                    <tr key={c.id} className="hover:bg-blue-50/30 transition-all group">
                                        <td className="px-10 py-7 text-center"><span className="text-[11px] font-black text-blue-600 italic uppercase bg-blue-50 px-3 py-1.5 rounded-xl border border-blue-100">{c.empresa}</span></td>
                                        <td className="px-10 py-7 text-[12px] font-black text-[#121c32] uppercase text-center">{c.nombre_completo}</td>
                                        <td className="px-10 py-7 text-center">
                                            <select disabled={procesando} value={c.coordinador_asignado || ""} onChange={(e) => handleAsignarCoordinadorFijo(c.id, e.target.value)} className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-[10px] font-black uppercase italic outline-none focus:ring-2 focus:ring-blue-500 transition-all text-[#121c32] disabled:opacity-50">
                                                <option value="">Sin Asignar</option>
                                                {coordinadoresDisponibles.map((coord: any) => (
                                                    <option key={coord.id} value={coord.email}>{coord.nombre_completo}</option>
                                                ))}
                                            </select>
                                        </td>
                                        <td className="px-10 py-7 text-[11px] font-black text-slate-400 uppercase italic text-center">{c.puesto || 'CLIENTE'}</td>
                                        <td className="px-10 py-7 text-center"><div className="flex items-center justify-center gap-3"><span className="text-base">📞</span><span className="text-[11px] font-black text-slate-700">{c.telefono || 'S/N'}</span></div></td>
                                        <td className="px-10 py-7 text-[11px] font-bold text-slate-400 group-hover:text-blue-500 transition-colors lowercase text-center">{c.email}</td>
                                        {esAdminGeneral && <td className="px-10 py-7 text-center"><button onClick={() => setClienteEdicion(c)} className="p-2 hover:bg-blue-100 rounded-xl transition-colors text-blue-600">✏️</button></td>}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </section>

            {/* MODAL DE EDICIÓN */}
            {clienteEdicion && (
                <div className="fixed inset-0 bg-[#121c32]/40 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in duration-300">
                    <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-lg overflow-hidden border border-slate-100">
                        <div className="bg-[#121c32] p-8 text-white flex justify-between items-center">
                            <div><h3 className="font-black italic text-[12px] uppercase tracking-[0.3em]">Editar Perfil Oficial</h3><p className="text-[9px] text-blue-300 font-bold uppercase mt-1">{clienteEdicion.email}</p></div>
                            <button onClick={() => setClienteEdicion(null)} className="w-10 h-10 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center font-bold">✕</button>
                        </div>
                        <form className="p-10 space-y-6" onSubmit={handleActualizarCliente}>
                            <div className="grid grid-cols-2 gap-6">
                                <div className="col-span-2"><label className="text-[10px] font-black text-slate-400 uppercase italic mb-2 tracking-widest leading-none">Empresa</label><input name="empresa" type="text" defaultValue={clienteEdicion.empresa} required className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-[12px] font-black outline-none focus:ring-4 focus:ring-blue-500/10 transition-all uppercase" /></div>
                                <div className="col-span-2"><label className="text-[10px] font-black text-slate-400 uppercase italic mb-2 tracking-widest leading-none">Nombre del Solicitante</label><input name="nombre" type="text" defaultValue={clienteEdicion.nombre_completo} required className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-[12px] font-black outline-none focus:ring-4 focus:ring-blue-500/10 transition-all uppercase" /></div>
                                <div><label className="text-[10px] font-black text-slate-400 uppercase italic mb-2 tracking-widest leading-none">Puesto</label><input name="puesto" type="text" defaultValue={clienteEdicion.puesto} className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-[12px] font-black outline-none focus:ring-4 focus:ring-blue-500/10 transition-all uppercase" /></div>
                                <div><label className="text-[10px] font-black text-slate-400 uppercase italic mb-2 tracking-widest leading-none">Teléfono Oficial</label><input name="telefono" type="text" defaultValue={clienteEdicion.telefono} className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-[12px] font-black outline-none focus:ring-4 focus:ring-blue-500/10 transition-all" /></div>
                            </div>
                            <div className="pt-6 flex gap-4">
                                <button type="button" onClick={() => setClienteEdicion(null)} className="flex-1 bg-slate-100 text-slate-400 font-black text-[11px] py-4 rounded-2xl uppercase italic hover:bg-slate-200 transition-all">Cancelar</button>
                                <button type="submit" disabled={procesando} className="flex-2 bg-blue-600 text-white font-black text-[11px] py-4 px-10 rounded-2xl uppercase italic hover:bg-blue-700 shadow-xl shadow-blue-200 disabled:opacity-50 transition-all">Guardar Cambios</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </main>
    );
};