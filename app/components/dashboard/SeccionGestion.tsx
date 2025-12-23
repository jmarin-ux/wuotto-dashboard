'use client'
import { useMemo } from 'react'
import { getStatusStyles, MESES } from '../../../lib/utils'

export const SeccionGestion = ({ servicios, perfiles, setTicket, filtros, setters }: any) => {
    // 1. LÓGICA DE CÁLCULO (Se mantiene intacta para no perder filtros ni estadísticas)
    const dataCalculada = useMemo(() => {
        const baseTiempo = servicios.filter((s: any) => {
            if (!s.fecha_solicitud) return false;
            const d = new Date(s.fecha_solicitud);
            return (filtros.filtroMes === 'all' || d.getMonth().toString() === filtros.filtroMes) && 
                   d.getFullYear().toString() === filtros.filtroAnio;
        });

        const coStats: any = {};
        perfiles.filter((p: any) => p.rol === 'coordinador').forEach((p: any) => {
            const count = baseTiempo.filter((s: any) => 
                (s.coordinador || '').toUpperCase().includes(p.email.toUpperCase()) || 
                (s.coordinador || '').toUpperCase().includes((p.nombre_completo || '').toUpperCase())
            ).length;
            coStats[p.email] = { nombre: p.nombre_completo || p.email, count };
        });

        const stRibbons: any = { "TOTAL": baseTiempo.length, "SIN ASIGNAR": 0, "ASIGNADO": 0, "EN PROCESO": 0, "PENDIENTE": 0, "EJECUTADO": 0, "REVISION DE CONTROL INTERNO": 0, "CIERRE ADMINISTRATIVO": 0, "CERRADO": 0, "CANCELADO": 0 };
        baseTiempo.forEach((s: any) => { 
            let key = (s.estatus || 'SIN ASIGNAR').toUpperCase().trim();
            if (key === 'REVISION DE CONTROL') key = 'REVISION DE CONTROL INTERNO';
            if (stRibbons.hasOwnProperty(key)) stRibbons[key]++; 
        });

        let paraGrid = baseTiempo;
        if (filtros.filtroEstatus.length > 0) {
            paraGrid = paraGrid.filter((s: any) => filtros.filtroEstatus.includes((s.estatus || 'SIN ASIGNAR').toUpperCase()));
        }
        
        if (filtros.filtroCoord) {
            const coordP = perfiles.find((p: any) => p.email === filtros.filtroCoord);
            const cName = (coordP?.nombre_completo || '').toUpperCase();
            paraGrid = paraGrid.filter((s: any) => (s.coordinador || '').toUpperCase().includes(cName) || (s.coordinador || '').toUpperCase().includes(filtros.filtroCoord.toUpperCase()));
        }

        if (filtros.filtroCliente) {
            const search = filtros.filtroCliente.toUpperCase();
            paraGrid = paraGrid.filter((s: any) => 
                (s.codigo_servicio || '').toUpperCase().includes(search) || 
                (s["Empresa"] || '').toUpperCase().includes(search) || 
                (s["Nombre Completo"] || '').toUpperCase().includes(search)
            );
        }

        // CORRECCIÓN ts(7006): Tipado explícito (s: any)
        const agrupados = Object.keys(stRibbons).filter(k => k !== "TOTAL").reduce((acc: any, status) => {
            const items = paraGrid.filter((s: any) => {
                let sStatus = (s.estatus || 'SIN ASIGNAR').toUpperCase().trim();
                if (sStatus === 'REVISION DE CONTROL') sStatus = 'REVISION DE CONTROL INTERNO';
                return sStatus === status;
            });
            if (items.length > 0) acc[status] = items;
            return acc;
        }, {});

        return { agrupados, stRibbons, total: baseTiempo.length, coStats, paraGrid };
    }, [servicios, filtros, perfiles]);

    // 2. FUNCIÓN DE EXPORTACIÓN CSV
    const exportarCSV = () => {
        const encabezados = ["ID Servicio", "Empresa", "Estatus", "Coordinador", "Fecha"];
        const filas = dataCalculada.paraGrid.map((s: any) => [
            `"${s.codigo_servicio || ''}"`,
            `"${s["Empresa"] || ''}"`,
            `"${s.estatus || 'SIN ASIGNAR'}"`,
            `"${s.coordinador || 'PENDIENTE'}"`,
            `"${s.fecha_solicitud ? new Date(s.fecha_solicitud).toLocaleDateString() : ''}"`
        ].join(","));

        const contenidoCSV = [encabezados.join(","), ...filas].join("\n");
        const blob = new Blob([contenidoCSV], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `REPORTE_GESTION_WUOTTO_${new Date().getTime()}.csv`;
        link.click();
    };

    const hayFiltros = filtros.filtroEstatus.length > 0 || filtros.filtroCliente || filtros.filtroCoord;

    return (
        <>
            {/* BARRA DE FILTROS */}
            <div className="flex-none bg-white border-b p-3 px-6 flex flex-col lg:flex-row gap-4 items-center justify-between shadow-sm z-10">
                <div className="flex gap-3 items-center">
                    <select value={filtros.filtroAnio} onChange={(e)=>setters.setFiltroAnio(e.target.value)} className="p-2 border border-slate-200 rounded-xl text-[10px] font-black bg-slate-50 outline-none shadow-sm"><option value="2025">2025</option><option value="2024">2024</option></select>
                    <select value={filtros.filtroMes} onChange={(e)=>setters.setFiltroMes(e.target.value)} className="p-2 border border-slate-200 rounded-xl text-[10px] font-black min-w-[140px] bg-slate-50 outline-none shadow-sm"><option value="all">TODO EL AÑO</option>{MESES.map((m: any, i: any) => <option key={m} value={i}>{m}</option>)}</select>
                    <div className="text-[10px] font-black bg-blue-50 text-blue-600 px-4 py-2 rounded-xl border border-blue-100 italic shadow-sm uppercase">Vivos: {dataCalculada.total}</div>
                    
                    {hayFiltros && (
                        <button 
                            onClick={() => {
                                setters.setFiltroEstatus([]);
                                setters.setFiltroCliente('');
                                setters.setFiltroCoord(null);
                            }}
                            className="bg-rose-500 hover:bg-rose-600 text-white text-[9px] font-black px-4 py-2 rounded-xl transition-all shadow-lg shadow-rose-200 animate-in zoom-in uppercase italic"
                        >
                            ✕ Limpiar Filtros
                        </button>
                    )}
                </div>

                <div className="flex-1 md:max-w-xl flex items-center gap-3 w-full">
                    <button 
                        onClick={exportarCSV}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl text-[9px] font-black uppercase italic shadow-lg transition-all active:scale-95 flex items-center gap-2 border border-emerald-500 shrink-0"
                    >
                        <span>📥</span> CSV
                    </button>
                    
                    <div className="relative flex-1">
                        <input 
                            type="text" 
                            value={filtros.filtroCliente} 
                            onChange={(e)=>setters.setFiltroCliente(e.target.value)} 
                            placeholder="🔍 BUSCAR SERVICIO O EMPRESA..." 
                            className="w-full px-5 py-2.5 border border-slate-200 rounded-2xl text-[11px] font-black outline-none focus:ring-4 focus:ring-blue-500/10 transition-all shadow-inner bg-slate-50 uppercase italic" 
                        />
                    </div>
                </div>
            </div>

            {/* CONTENEDOR DE LISTONES Y COORDINADORES */}
            <div className="flex-none bg-[#f8fafc] px-8 py-6 flex flex-col lg:flex-row gap-8 border-b border-slate-200 shadow-inner overflow-hidden">
                <div className="flex gap-4 overflow-x-auto no-scrollbar flex-1 items-start pb-2">
                    {Object.entries(dataCalculada.stRibbons).map(([key, val]: any) => {
                        const styles = getStatusStyles(key);
                        const activo = filtros.filtroEstatus.includes(key);
                        return (
                            <div key={key} onClick={()=>{ if (key === 'TOTAL') setters.setFiltroEstatus([]); else setters.setFiltroEstatus((prev: any) => prev.includes(key) ? prev.filter((e: any) => e !== key) : [...prev, key]); }} className="flex-none flex flex-col items-center cursor-pointer group w-[85px] transition-transform hover:scale-105">
                                <div className={`w-full h-20 ${styles.ribbon} rounded-b-[1.5rem] flex items-center justify-center text-white text-2xl font-black shadow-xl transition-all relative overflow-hidden ${activo ? 'translate-y-2 ring-4 ring-blue-400' : 'opacity-95 group-hover:opacity-100'}`}>
                                    <div className="absolute inset-0 bg-white/10 opacity-20 skew-x-12 translate-x-4"></div>
                                    {val}
                                </div>
                                <span className={`text-[8px] font-black text-center mt-3 leading-tight uppercase tracking-tighter ${activo ? 'text-blue-700 font-black' : 'text-slate-400'}`}>{key}</span>
                            </div>
                        )
                    })}
                </div>

                <div className="lg:border-l-2 lg:border-slate-200 lg:pl-8 w-full lg:w-72 shrink-0">
                    <p className="text-[9px] font-black text-slate-500 mb-3 uppercase tracking-widest italic flex items-center gap-2">
                        <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></span>
                        Carga por Coordinador:
                    </p>
                    <div className="grid grid-cols-2 lg:grid-cols-1 gap-2 max-h-40 overflow-y-auto no-scrollbar pr-2">
                        {Object.entries(dataCalculada.coStats).map(([email, info]: any) => (
                            <div 
                                key={email} 
                                onClick={() => setters.setFiltroCoord(filtros.filtroCoord === email ? null : email)}
                                className={`px-3 py-2 rounded-xl text-[8px] font-black cursor-pointer border-2 transition-all flex justify-between items-center ${filtros.filtroCoord === email ? 'bg-[#121c32] text-white shadow-xl border-[#121c32]' : 'bg-white text-slate-600 border-slate-100 hover:border-blue-400'}`}
                            >
                                <span className="truncate uppercase italic pr-2">{info.nombre}</span>
                                <span className={`px-2 py-0.5 rounded-lg text-[9px] font-bold ${filtros.filtroCoord === email ? 'bg-blue-500 text-white' : 'bg-slate-100 text-slate-500'}`}>{info.count}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* GRID DE TARJETAS */}
            <main className="flex-1 overflow-y-auto px-8 pb-24 pt-8 bg-white scroll-smooth animate-in fade-in duration-1000">
                {Object.entries(dataCalculada.agrupados).map(([status, items]: any) => (
                    <section key={status} className="mb-16">
                        <div className="flex items-center gap-6 mb-6">
                            <h2 className={`text-[11px] font-black px-6 py-1.5 rounded-full shadow-sm border-b-2 ${getStatusStyles(status).badge} uppercase italic tracking-tighter`}>{status} ({items.length})</h2>
                            <div className="h-[2px] flex-1 bg-gradient-to-r from-slate-100 to-transparent"></div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 2xl:grid-cols-6 gap-5">
                            {items.map((t: any) => {
                                const esEmergencia = (t.tipo_mantenimiento || "").toUpperCase().includes("EMERGENCIA");
                                const sinCoord = !t.coordinador || t.coordinador.trim() === "" || t.coordinador.toUpperCase() === "PENDIENTE";
                                
                                return (
                                    <div key={t.id} className={`bg-white rounded-[2rem] border-2 shadow-sm hover:shadow-2xl transition-all duration-500 flex flex-col min-h-[250px] overflow-hidden group ${esEmergencia ? 'border-red-500 animate-emergency-row' : sinCoord ? 'border-amber-400' : 'border-slate-100 hover:border-blue-400'}`}>
                                        {esEmergencia && (
                                            <div className="bg-red-600 text-white text-[8px] font-black py-2 text-center uppercase tracking-widest animate-pulse">🚨 EMERGENCIA CRÍTICA</div>
                                        )}
                                        {sinCoord && !esEmergencia && (
                                            <div className="bg-amber-400 text-[#121c32] text-[8px] font-black py-2 text-center uppercase tracking-widest">⚠️ ASIGNACIÓN PENDIENTE</div>
                                        )}
                                        
                                        <div className={`p-4 text-center ${esEmergencia ? 'bg-red-50/50' : sinCoord ? 'bg-amber-50/50' : 'bg-slate-50/50'}`}>
                                            <h3 className="text-sm font-black italic tracking-tighter truncate text-[#121c32] group-hover:text-blue-600 transition-colors uppercase">{t.codigo_servicio}</h3>
                                        </div>

                                        <div className="px-5 py-4 flex-1 space-y-3 text-left">
                                            <div className="border-l-4 border-slate-100 pl-3 group-hover:border-blue-500 transition-all">
                                                <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest">Empresa</p>
                                                <p className="text-[10px] font-black text-slate-700 italic truncate mt-0.5 leading-none uppercase">{t["Empresa"] || "N/A"}</p>
                                            </div>
                                            <div className="border-l-4 border-slate-100 pl-3">
                                                <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest">Coordinador</p>
                                                <p className={`text-[9px] font-bold truncate mt-0.5 uppercase ${sinCoord ? 'text-red-500 italic animate-pulse' : 'text-slate-500'}`}>
                                                    {t.coordinador || 'PENDIENTE'}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="p-4 flex justify-between items-center bg-slate-50/30 border-t border-slate-100">
                                            <span className="text-[9px] font-black text-slate-300 italic">{t.fecha_solicitud ? new Date(t.fecha_solicitud).toLocaleDateString() : '---'}</span>
                                            <button 
                                                onClick={()=>setTicket(t)} 
                                                className={`px-5 py-2 rounded-xl text-[9px] font-black shadow-lg transition-all active:scale-90 uppercase italic ${
                                                    esEmergencia ? 'bg-red-600 text-white hover:bg-red-500' : 
                                                    sinCoord ? 'bg-amber-400 text-[#121c32] hover:bg-amber-300' : 
                                                    'bg-[#121c32] text-white hover:bg-slate-800'
                                                }`}
                                            >
                                                Ver Detalle
                                            </button>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </section>
                ))}
            </main>
        </>
    );
};