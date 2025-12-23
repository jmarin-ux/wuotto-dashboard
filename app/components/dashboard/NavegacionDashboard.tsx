'use client'

export const NavegacionDashboard = ({ pestaña, setPestaña, usuario }: any) => {
    // Se añade el ID 'control' para la nueva vista tipo Excel
    const tabs = [
        { id: 'ordenes', label: 'Gestión Operativa', icon: '📋' },
        { id: 'control', label: 'Control Exacto', icon: '📈' }, // Nueva pestaña integrada
        { id: 'dashboard', label: 'Inteligencia KPIs', icon: '📊' }
    ];

    return (
        <nav className="flex-none bg-white border-b border-slate-200 px-8 flex gap-2 overflow-x-auto no-scrollbar shadow-md relative z-20">
            {tabs.map((tab) => (
                <button 
                    key={tab.id}
                    onClick={() => setPestaña(tab.id as any)} 
                    className={`flex items-center gap-3 py-4 px-6 border-b-4 transition-all duration-300 group ${
                        pestaña === tab.id ? 'border-[#121c32] text-[#121c32] bg-slate-50/50' : 'border-transparent text-slate-400 hover:text-slate-600'
                    }`}
                >
                    <span className={`text-base transition-transform group-hover:scale-125 ${pestaña === tab.id ? 'grayscale-0' : 'grayscale opacity-50'}`}>{tab.icon}</span>
                    <span className={`text-[10px] font-black uppercase tracking-widest italic ${pestaña === tab.id ? 'opacity-100' : 'opacity-70'}`}>
                        {tab.label}
                    </span>
                </button>
            ))}

            {/* Acceso exclusivo para administrador principal */}
            {usuario === 'jmarin@cmw.com.mx' && (
                <button 
                    onClick={() => setPestaña('clientes')} 
                    className={`flex items-center gap-3 py-4 px-6 border-b-4 transition-all duration-300 group ${
                        pestaña === 'clientes' ? 'border-blue-600 text-blue-600 bg-blue-50/30' : 'border-transparent text-slate-400 hover:text-blue-500'
                    }`}
                >
                    <span className={`text-base transition-transform group-hover:scale-125 ${pestaña === 'clientes' ? 'grayscale-0' : 'grayscale opacity-50'}`}>👥</span>
                    <span className="text-[10px] font-black uppercase tracking-widest italic">Admin Clientes</span>
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse ml-1"></div>
                </button>
            )}
        </nav>
    );
};