// app/test/page.tsx
'use client'
import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient'; // Asegúrate de que esta ruta sea correcta

export default function TestPage() {
  const [data, setData] = useState<any[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      // Intentamos leer la tabla perfiles
      const { data, error } = await supabase
        .from('perfiles')
        .select('*') 
        .limit(5); // Solo las primeras 5 filas

      if (error) {
        console.error("Error de Supabase:", error);
        setError(`Error al conectar o leer: ${error.message}. ¿Clave y URL correctas?`);
      } else {
        setData(data);
      }
    }
    fetchData();
  }, []);

  return (
    <div className="min-h-screen bg-gray-900 text-white p-10">
      <h1 className="text-3xl font-bold mb-4">🧪 Prueba de Conexión Supabase</h1>
      
      {error && (
        <div className="bg-red-800 p-4 rounded-lg">
          <p className="font-bold">❌ Error Crítico de Conexión/Lectura:</p>
          <p>{error}</p>
        </div>
      )}

      {!error && !data && (
        <p className="animate-pulse">Cargando datos de la tabla 'perfiles'...</p>
      )}

      {data && data.length > 0 && (
        <div className="bg-green-800/50 p-4 rounded-lg">
          <p className="font-bold text-lg mb-2">✅ Conexión Exitosa: Se encontraron {data.length} perfiles.</p>
          <pre className="bg-gray-700 p-3 rounded text-sm overflow-x-auto">
            {JSON.stringify(data, null, 2)}
          </pre>
        </div>
      )}
      
      {data && data.length === 0 && (
        <div className="bg-yellow-800/50 p-4 rounded-lg">
          <p className="font-bold">⚠️ Conexión Exitosa, pero la tabla está vacía.</p>
        </div>
      )}
    </div>
  );
}