// lib/utils.ts

export const MESES = ["ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO", "JULIO", "AGOSTO", "SEPTIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE"];

export const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute:'2-digit' });
};

export const getStatusStyles = (estatus: string) => {
    const s = (estatus || '').toUpperCase().replace(/\s/g, '');
    // Colores más vibrantes según tu imagen de referencia
    if (['CERRADO', 'CIERREADMINISTRATIVO', 'EJECUTADO'].includes(s)) 
        return { badge: 'bg-emerald-100 text-emerald-700', ribbon: 'bg-emerald-600', text: 'text-emerald-700' };
    if (['ENPROCESO', 'REVISIONCONTROLINTERNO'].includes(s)) 
        return { badge: 'bg-amber-100 text-amber-700', ribbon: 'bg-amber-500', text: 'text-amber-700' };
    if (['ASIGNADO', 'QA'].includes(s)) 
        return { badge: 'bg-blue-100 text-blue-700', ribbon: 'bg-blue-600', text: 'text-blue-700' };
    if (['PENDIENTE', 'SINASIGNAR'].includes(s)) 
        return { badge: 'bg-rose-100 text-rose-700', ribbon: 'bg-rose-500', text: 'text-rose-700' };
    if (['CANCELADO'].includes(s)) 
        return { badge: 'bg-slate-100 text-slate-700', ribbon: 'bg-slate-600', text: 'text-slate-700' };
        
    if (s === 'TOTAL') return { badge: '', ribbon: 'bg-[#121c32]', text: '' };
    return { badge: 'bg-slate-100 text-slate-700', ribbon: 'bg-slate-500', text: 'text-slate-700' };
};