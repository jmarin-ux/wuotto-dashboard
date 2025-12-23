// app/components/dashboard/HeaderDashboard.tsx
'use client'

export const HeaderDashboard = ({ usuarioActivo, rolUsuario }: any) => {
    return (
        <header className="flex-none bg-[#0a1120] p-4 px-8 flex justify-between items-center shadow-2xl z-30 border-b border-white/5">
            <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-lg rotate-3 hover:rotate-0 transition-transform">
                    <span className="text-[#0a1120] font-black italic text-xl">W</span>
                </div>
                <h1 className="text-white font-black italic text-lg tracking-tighter uppercase">
                    WUOTTO <span className="text-blue-500 text-[10px] tracking-[0.3em] block ml-1">Admin Central</span>
                </h1>
            </div>

            <div className="flex items-center gap-6">
                <div className="hidden md:flex flex-col items-end border-r border-white/10 pr-6">
                    <span className="text-[8px] font-black text-blue-400 tracking-[0.2em] uppercase mb-0.5 italic">Usuario Activo:</span>
                    <div className="flex items-center gap-2">
                        <span className="text-white text-[10px] font-black uppercase tracking-tighter italic">
                            {usuarioActivo || 'Invitado'}
                        </span>
                        <span className="bg-blue-500/20 text-blue-400 text-[7px] font-black px-2 py-0.5 rounded-md border border-blue-400/30 uppercase">
                            {rolUsuario || 'Perfil'}
                        </span>
                    </div>
                </div>
                <button 
                    onClick={() => { localStorage.removeItem('USUARIO_ACTIVO'); window.location.href = '/'; }}
                    className="bg-rose-600 hover:bg-rose-700 text-white text-[9px] font-black px-5 py-2.5 rounded-xl transition-all shadow-lg border-b-4 border-rose-800 uppercase italic"
                >
                    Salir
                </button>
            </div>
        </header>
    );
};