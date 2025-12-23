'use client'
import { useMemo, useState } from 'react'
import { getStatusStyles } from '../../../lib/utils'
import { generarPDF } from '../../../lib/pdfGenerator'

export const VistaControlExacto = ({ servicios, usuarioEmail, rolUsuario, setTicket, statsEmergencia }: any) => {
    // 1. Estados de Ordenamiento y Filtrado dinámico por Contador
    const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>({ 
        key: 'fecha_solicitud', 
        direction: 'desc' 
    });
    const [filtroEstatusManual, setFiltroEstatusManual] = useState<string | null>(null);

    // 2. Procesamiento de datos (Seguridad + Filtro de Contador + Orden)
    const serviciosProcesados = useMemo(() => {
        // Filtrado por permisos de rol
        // Corrección ts(7006): Tipado 's: any' para el filtro
        let items = rolUsuario === 'admin' 
            ? [...servicios] 
            : servicios.filter((s: any) => 
                (s.coordinador || '').toLowerCase().includes(usuarioEmail.toLowerCase()) ||
                (s.operativo || '').toLowerCase().includes(usuarioEmail.toLowerCase())
            );

        // Filtrado por clic en contador superior
        if (filtroEstatusManual) {
            items = items.filter((s: any) => s.estatus === filtroEstatusManual);
        }

        // Ordenamiento dinámico
        // Corrección ts(7006): Tipado 'a: any, b: any' para el sort
        if (sortConfig.key) {
            items.sort((a: any, b: any) => {
                const aValue = a[sortConfig.key] || '';
                const bValue = b[sortConfig.key] || '';
                if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
                if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        }
        return items;
    }, [servicios, usuarioEmail, rolUsuario, sortConfig, filtroEstatusManual]);

    // 3. Lógica para los contadores superiores (Sincronizados con Gestión Operativa)
    const contadores = useMemo(() => {
        const base = ['SIN ASIGNAR', 'ASIGNADO', 'EN PROCESO', 'PENDIENTE', 'EJECUTADO', 'REVISION DE CONTROL INTERNO', 'CIERRE ADMINISTRATIVO', 'CERRADO', 'CANCELADO'];
        const counts: any = { TOTAL: servicios.length };
        base.forEach(est => {
            counts[est] = servicios.filter((s: any) => s.estatus === est).length;
        });
        return counts;
    }, [servicios]);

    // 4. Función de Exportación CSV (Alta Densidad)
    const exportarCSV = () => {
        const encabezados = ["FECHA", "ESTATUS", "FOLIO", "EMPRESA", "SOLICITANTE", "COORDINADOR", "TIPO SERVICIO", "REPORTE"];
        const filas = serviciosProcesados.map((s: any) => [
            s.fecha_solicitud ? new Date(s.fecha_solicitud).toLocaleDateString() : '',
            s.estatus || 'SIN ASIGNAR',
            s.codigo_servicio || '',
            s.Empresa || '',
            s["Nombre Completo"] || '',
            s.coordinador || 'PENDIENTE',
            s.tipo_mantenimiento || '',
            s.descripcion_falla || ''
        ].map(val => `"${val}"`).join(","));

        const csvContent = [encabezados.join(","), ...filas].join("\n");
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.setAttribute("download", `REPORTE_CONTROL_WUOTTO_${new Date().toISOString().slice(0,10)}.csv`);
        link.click();
    };

    const handleSort = (key: string) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
        setSortConfig({ key, direction });
    };

    return (
        <main className="flex-1 overflow-hidden flex flex-col bg-[#f8fafc] animate-in fade-in duration-500">
            
            {/* --- SECCIÓN A: HEADER Y CONTADORES INTERACTIVOS --- */}
            <div className="p-6 px-8 bg-white border-b flex flex-col gap-6 shadow-sm">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-[12px] font-black text-[#121c32] uppercase tracking-[0.3em] italic leading-none">
                            Control Exacto Operativo
                        </h2>
                        <p className="text-[10px] font-bold text-slate-400 uppercase mt-2">
                            Visualización de alta densidad • {serviciosProcesados.length} Registros
                        </p>
                    </div>
                    
                    <div className="flex gap-4">
                        <div className="bg-red-600 px-4 py-2 rounded-xl flex items-center gap-3 shadow-lg shadow-red-200 animate-pulse">
                            <span className="text-white text-lg">🚨</span>
                            <div>
                                <p className="text-white text-[7px] font-black uppercase leading-none text-center">Activas</p>
                                <p className="text-white text-lg font-black leading-none text-center">{statsEmergencia?.activas || 0}</p>
                            </div>
                        </div>

                        <button 
                            onClick={exportarCSV}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-2xl text-[10px] font-black uppercase italic shadow-lg transition-all active:scale-95 flex items-center gap-2 border border-emerald-500"
                        >
                            <span>📥</span> Exportar CSV
                        </button>
                    </div>
                </div>

                <div className="flex gap-3 overflow-x-auto no-scrollbar py-2">
                    {['TOTAL', 'SIN ASIGNAR', 'ASIGNADO', 'EN PROCESO', 'PENDIENTE', 'EJECUTADO', 'REVISION DE CONTROL INTERNO', 'CIERRE ADMINISTRATIVO', 'CERRADO', 'CANCELADO'].map((e) => {
                        const esActivo = (e === 'TOTAL' && !filtroEstatusManual) || (filtroEstatusManual === e);
                        return (
                            <button
                                key={e}
                                onClick={() => setFiltroEstatusManual(e === 'TOTAL' ? null : e)}
                                className={`flex flex-col items-center justify-center min-w-[115px] h-[80px] rounded-[1.8rem] transition-all duration-300 border-2 ${
                                    esActivo 
                                    ? 'bg-[#121c32] border-[#121c32] shadow-xl -translate-y-1' 
                                    : 'bg-white border-slate-100 hover:border-blue-200 shadow-sm'
                                }`}
                            >
                                <span className={`text-xl font-black ${esActivo ? 'text-white' : 'text-[#121c32]'}`}>{contadores[e] || 0}</span>
                                <span className={`text-[7px] font-black uppercase tracking-widest mt-1 ${esActivo ? 'text-blue-300' : 'text-slate-400'}`}>{e}</span>
                            </button>
                        );
                    })}
                    {filtroEstatusManual && (
                        <button onClick={() => setFiltroEstatusManual(null)} className="text-[10px] font-black text-red-500 uppercase italic px-4 hover:underline transition-all">✕ Limpiar</button>
                    )}
                </div>
            </div>

            {/* --- SECCIÓN B: TABLA DE DATOS REDISEÑADA --- */}
            <div className="flex-1 overflow-auto no-scrollbar p-6">
                <div className="bg-white rounded-[2.5rem] shadow-2xl border border-slate-100 overflow-hidden">
                    <table className="w-full border-collapse text-left">
                        <thead className="bg-slate-50/50 border-b border-slate-100">
                            <tr>
                                {[
                                    { label: 'Fecha', key: 'fecha_solicitud' },
                                    { label: 'Estatus', key: 'estatus' },
                                    { label: 'Folio', key: 'codigo_servicio' },
                                    { label: 'Empresa', key: 'Empresa' },
                                    { label: 'Solicitante', key: 'Nombre Completo' },
                                    { label: 'Coordinador', key: 'coordinador' },
                                    { label: 'Tipo Servicio', key: 'tipo_mantenimiento' },
                                    { label: 'Reporte Cliente', key: 'descripcion_falla' }
                                ].map((col) => (
                                    <th 
                                        key={col.key} 
                                        onClick={() => handleSort(col.key)}
                                        className="px-6 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest italic cursor-pointer hover:bg-slate-100/50 transition-colors border-r border-slate-100 last:border-0"
                                    >
                                        <div className="flex justify-between items-center gap-2">
                                            {col.label}
                                            <span className="text-[8px] text-blue-500">
                                                {sortConfig.key === col.key ? (sortConfig.direction === 'asc' ? '▲' : '▼') : '↕'}
                                            </span>
                                        </div>
                                    </th>
                                ))}
                                <th className="px-6 py-6 text-[10px] font-black text-slate-400 uppercase italic text-center">PDF</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {/* Corrección ts(7006): Tipado 's: any' para el map */}
                            {serviciosProcesados.map((s: any) => {
                                const styles = getStatusStyles(s.estatus);
                                const esEmergencia = s.tipo_mantenimiento?.toUpperCase().includes('EMERGENCIA');
                                const esActiva = s.estatus !== 'EJECUTADO' && s.estatus !== 'CANCELADO' && s.estatus !== 'CERRADO';
                                
                                return (
                                    <tr 
                                        key={s.id} 
                                        onClick={() => setTicket(s)}
                                        className={`group transition-all hover:bg-blue-50/30 cursor-pointer ${esEmergencia && esActiva ? 'animate-emergency-row' : ''}`}
                                    >
                                        <td className="px-6 py-5 text-[11px] font-bold text-slate-500 italic uppercase whitespace-nowrap">
                                            {s.fecha_solicitud ? new Date(s.fecha_solicitud).toLocaleDateString() : '---'}
                                        </td>
                                        <td className="px-6 py-5">
                                            <span className={`px-3 py-1.5 rounded-full text-[9px] font-black uppercase italic shadow-sm flex items-center justify-center w-fit ${esEmergencia && esActiva ? 'bg-red-600 text-white animate-pulse' : styles.badge}`}>
                                                {s.estatus || 'SIN ASIGNAR'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-5 text-[11px] font-black text-blue-700 italic tracking-tight">{s.codigo_servicio}</td>
                                        <td className="px-6 py-5 text-[11px] font-black text-[#121c32] uppercase">{s.Empresa}</td>
                                        <td className="px-6 py-5 text-[11px] font-bold text-slate-600 uppercase">{s["Nombre Completo"] || '---'}</td>
                                        
                                        <td className="px-6 py-5">
                                            <span className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase italic border ${s.coordinador ? 'bg-blue-50 text-blue-700 border-blue-100' : 'bg-red-50 text-red-500 border-red-100 animate-pulse'}`}>
                                                {s.coordinador || 'PENDIENTE'}
                                            </span>
                                        </td>

                                        <td className="px-6 py-5 max-w-[300px]">
                                            <div className={`text-[10px] font-black px-3 py-2 rounded-2xl border leading-relaxed uppercase italic truncate ${esEmergencia ? 'bg-red-50/50 text-red-600 border-red-100' : 'bg-slate-50 text-slate-500 border-slate-100'}`}>
                                                {s.tipo_mantenimiento || 'General'}
                                            </div>
                                        </td>
                                        <td className="px-6 py-5 max-w-[200px]">
                                            <p className="truncate text-slate-400 italic font-medium text-[10px]">
                                                {s.descripcion_falla || 'Sin descripción'}
                                            </p>
                                        </td>
                                        <td className="px-6 py-5 text-center">
                                            <button
                                                onClick={(e) => { e.stopPropagation(); generarPDF(s, s, false); }}
                                                className="bg-[#121c32] hover:bg-blue-900 text-white text-[9px] font-black px-4 py-2.5 rounded-xl transition-all shadow-lg uppercase italic active:scale-95"
                                            >
                                                Descargar
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </main>
    );
};