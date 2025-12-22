'use client'
import Link from 'next/link'

export default function HomePage() {
    return (
        <div className="min-h-screen bg-[#0f172a] flex flex-col items-center justify-center p-6 relative overflow-hidden">
            
            {/* Efectos de iluminación de fondo */}
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/10 rounded-full blur-[120px]"></div>
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-amber-400/10 rounded-full blur-[120px]"></div>

            <div className="w-full max-w-5xl z-10">
                {/* Encabezado Principal */}
                <div className="text-center mb-16 animate-in fade-in slide-in-from-bottom-4 duration-700">
                    <div className="inline-flex items-center justify-center w-24 h-24 bg-white rounded-3xl shadow-2xl mb-8 rotate-3 transition-transform hover:rotate-0 cursor-default">
                        <span className="text-[#121c32] text-5xl font-black italic">W</span>
                    </div>
                    <h1 className="text-white text-6xl md:text-8xl font-black italic tracking-tighter leading-none uppercase">
                        WUOTTO <span className="text-amber-400">CENTRAL</span>
                    </h1>
                    <p className="text-blue-300/60 font-bold tracking-[0.4em] text-xs md:text-sm mt-6 uppercase">
                        Intelligence Dashboard & Management System
                    </p>
                </div>

                {/* Grid de Accesos Directos */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 animate-in zoom-in duration-500 delay-200">
                    
                    {/* ACCESO 1: REGISTRO */}
                    <Link href="/registro" className="group relative bg-white rounded-[2.5rem] p-10 transition-all hover:-translate-y-3 hover:shadow-[0_30px_60px_rgba(251,191,36,0.15)] border-b-8 border-slate-200 hover:border-amber-400 flex flex-col items-center text-center">
                        <div className="text-5xl mb-6 group-hover:scale-125 transition-transform duration-300">📝</div>
                        <h3 className="text-[#121c32] font-black text-2xl italic leading-none mb-3 uppercase">Registro</h3>
                        <p className="text-slate-500 text-sm font-medium leading-relaxed">
                            Alta de nuevos clientes en el sistema central Wuotto.
                        </p>
                        <div className="mt-8 flex items-center text-[#121c32] font-black text-[11px] tracking-widest uppercase bg-slate-100 px-4 py-2 rounded-full group-hover:bg-amber-100 transition-colors">
                            COMENZAR <span className="ml-2 group-hover:translate-x-2 transition-transform">→</span>
                        </div>
                    </Link>

                    {/* ACCESO 2: SERVICIOS (KIOSCO) */}
                    <Link href="/solicitud" className="group relative bg-amber-400 rounded-[2.5rem] p-10 transition-all hover:-translate-y-3 hover:shadow-[0_30px_60px_rgba(251,191,36,0.3)] border-b-8 border-amber-600 flex flex-col items-center text-center">
                        <div className="text-5xl mb-6 group-hover:scale-125 transition-transform duration-300">🛠️</div>
                        <h3 className="text-[#121c32] font-black text-2xl italic leading-none mb-3 uppercase">Servicios</h3>
                        <p className="text-[#121c32]/70 text-sm font-bold leading-relaxed">
                            Generar nuevas órdenes y reportes operativos inmediatos.
                        </p>
                        <div className="mt-8 flex items-center text-[#121c32] font-black text-[11px] tracking-widest uppercase bg-white/40 px-4 py-2 rounded-full group-hover:bg-white transition-colors">
                            INGRESAR <span className="ml-2 group-hover:translate-x-2 transition-transform">→</span>
                        </div>
                    </Link>

                    {/* ACCESO 3: ADMINISTRACIÓN */}
                    <Link href="/login" className="group relative bg-[#1e293b] border border-white/10 rounded-[2.5rem] p-10 transition-all hover:-translate-y-3 hover:shadow-[0_30px_60px_rgba(0,0,0,0.5)] border-b-8 border-black flex flex-col items-center text-center">
                        <div className="text-5xl mb-6 group-hover:scale-125 transition-transform duration-300">📊</div>
                        <h3 className="text-white font-black text-2xl italic leading-none mb-3 uppercase">Panel Central</h3>
                        <p className="text-blue-300/40 text-sm font-medium leading-relaxed">
                            Control total de la operación y analítica avanzada.
                        </p>
                        <div className="mt-8 flex items-center text-amber-400 font-black text-[11px] tracking-widest uppercase bg-white/5 px-4 py-2 rounded-full group-hover:bg-white/10 transition-colors">
                            GESTIONAR <span className="ml-2 group-hover:translate-x-2 transition-transform">→</span>
                        </div>
                    </Link>

                </div>

                {/* Footer decorativo */}
                <div className="text-center mt-20">
                    <p className="text-white/10 text-[10px] font-black tracking-[0.5em] uppercase italic">
                        © 2025 WUOTTO INTELLIGENCE SYSTEMS
                    </p>
                </div>
            </div>
        </div>
    )
}