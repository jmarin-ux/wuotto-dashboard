'use client'
import { useMemo } from 'react'

export const SeccionAnalitica = ({ servicios, perfiles, rol }: any) => {
    const stats = useMemo(() => {
        const total = servicios.length;
        const finalizados = servicios.filter((s:any) => 
            ['CIERRE ADMINISTRATIVO', 'CANCELADO', 'CERRADO', 'EJECUTADO'].includes(s.estatus?.toUpperCase())
        ).length;
        const ratio = finalizados > 0 ? (Math.round((total / finalizados) * 100) / 100) : 0;
        const eficacia = total > 0 ? Math.round((finalizados / total) * 100) : 0;
        
        return { total, finalizados, ratio, eficacia };
    }, [servicios]);

    return (
        <main className="flex-1 overflow-y-auto p-4 md:p-10 bg-[#f4f7fa] animate-in fade-in duration-700">
            <div className="max-w-[1600px] mx-auto space-y-10">
                
                {/* Encabezado de Analítica con Efecto Glass */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 bg-white p-8 rounded-[2.5rem] shadow-xl border border-white relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full -translate-y-16 translate-x-16 group-hover:scale-150 transition-transform duration-1000"></div>
                    <div className="z-10">
                        <h2 className="text-3xl md:text-5xl font-black italic uppercase text-[#121c32] tracking-tighter leading-none">
                            INTELIGENCIA <span className="text-blue-600">KPIs</span>
                        </h2>
                        <p className="text-[10px] font-black text-slate-400 tracking-[0.3em] uppercase italic mt-4 flex items-center gap-2">
                            <span className="w-10 h-[2px] bg-blue-500"></span> Rendimiento Operativo Estructural
                        </p>
                    </div>
                    <div className="bg-[#121c32] px-8 py-5 rounded-3xl flex items-center gap-6 shadow-2xl border-b-8 border-blue-600 active:scale-95 transition-all z-10">
                        <div className="text-right">
                            <p className="text-[8px] font-black text-blue-400 tracking-widest uppercase mb-1">Ratio de Alcance:</p>
                            <p className="text-3xl font-black text-white italic leading-none">{stats.ratio}x</p>
                        </div>
                        <div className="w-12 h-12 bg-white/10 rounded-full flex items-center justify-center text-2xl animate-pulse">📈</div>
                    </div>
                </div>

                {/* Grid de Métricas Responsivo */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8">
                    <MetricCardPro title="Carga Total" value={stats.total} label="Servicios en Red" color="bg-blue-600" icon="📊" />
                    <MetricCardPro title="Objetivos Logrados" value={stats.finalizados} label="Cierre Operativo" color="bg-emerald-600" icon="✅" />
                    <MetricCardPro title="Servicios Vivos" value={stats.total - stats.finalizados} label="Atención Inmediata" color="bg-amber-500" icon="⚡" />
                    <MetricCardPro title="Eficacia Real" value={`${stats.eficacia}%`} label="Tasa de Éxito" color="bg-indigo-600" icon="🎯" />
                </div>
            </div>
        </main>
    );
};

const MetricCardPro = ({ title, value, label, color, icon }: any) => (
    <div className={`${color} p-8 rounded-[3rem] text-white shadow-2xl hover:-translate-y-4 transition-all duration-500 border-b-[12px] border-black/20 group relative overflow-hidden`}>
        <div className="absolute top-0 right-0 p-6 text-4xl opacity-20 group-hover:scale-125 group-hover:rotate-12 transition-transform duration-500">
            {icon}
        </div>
        <p className="text-[10px] font-black uppercase opacity-70 tracking-[0.2em] mb-2">{title}</p>
        <p className="text-5xl md:text-6xl font-black italic tracking-tighter mb-4">{value}</p>
        <div className="h-[2px] w-full bg-white/20 mb-4"></div>
        <p className="text-[9px] font-bold uppercase tracking-widest text-white/60">{label}</p>
    </div>
);