// lib/pdfGenerator.ts
import jsPDF from 'jspdf';

/**
 * Función auxiliar para cargar una imagen desde una URL y convertirla para jsPDF
 */
const cargarImagen = (url: string): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = "anonymous"; // Evita errores de CORS con Supabase
        img.onload = () => resolve(img);
        img.onerror = (e) => reject(e);
        img.src = url;
    });
};

export const generarPDF = async (ticket: any, evidencias: any[] = [], esVersionHistorica = false) => {
    try {
        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const margin = 15;
        const contentWidth = pageWidth - (margin * 2);

        // --- 1. ENCABEZADO ESTILIZADO ---
        doc.setFillColor(18, 28, 50); // Color #121c32
        doc.rect(0, 0, pageWidth, 40, 'F');
        
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(22);
        doc.setFont("helvetica", "bold");
        doc.text("REPORTE TÉCNICO DE SERVICIO", margin, 18);
        
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.text(`FOLIO: ${ticket.codigo_servicio || 'SIN FOLIO'}`, margin, 26);
        doc.text(`ESTADO: ${ticket.estatus || 'N/A'}`, margin, 32);
        if(esVersionHistorica) doc.text("(Copia de Historial / Snapshot)", pageWidth - 65, 32);

        // --- 2. INFORMACIÓN GENERAL ---
        doc.setTextColor(0, 0, 0);
        let y = 55;

        const parts = (ticket.tipo_mantenimiento || "").split('|');
        const servicio = parts[0] || "General";
        const empresa = parts[1] || "N/A";
        const cliente = parts[2] || "N/A";

        doc.setFontSize(11);
        doc.setFont("helvetica", "bold"); doc.text("CLIENTE:", margin, y);
        doc.setFont("helvetica", "normal"); doc.text(cliente, margin + 25, y);
        
        doc.setFont("helvetica", "bold"); doc.text("SUCURSAL:", margin + 95, y);
        doc.setFont("helvetica", "normal"); doc.text(empresa, margin + 120, y);
        y += 10;

        doc.setFont("helvetica", "bold"); doc.text("SERVICIO:", margin, y);
        doc.setFont("helvetica", "normal"); doc.text(servicio, margin + 25, y);
        y += 15;

        // --- 3. BLOQUES DE TEXTO TÉCNICO ---
        const secciones = [
            { titulo: "HALLAZGOS:", contenido: ticket.hallazgos },
            { titulo: "DIAGNÓSTICO TÉCNICO:", contenido: ticket.diagnostico },
            { titulo: "MATERIALES UTILIZADOS:", contenido: ticket.materiales },
            { titulo: "RECOMENDACIONES:", contenido: ticket.recomendaciones }
        ];

        secciones.forEach((sec) => {
            if (y > pageHeight - 30) { doc.addPage(); y = margin; } // Salto de página si no hay espacio

            doc.setFont("helvetica", "bold");
            doc.setFontSize(10);
            doc.text(sec.titulo, margin, y);
            y += 6;

            doc.setFont("helvetica", "normal");
            doc.setFontSize(10);
            const textLines = doc.splitTextToSize(sec.contenido || "No registrado.", contentWidth);
            doc.text(textLines, margin, y);
            
            y += (textLines.length * 5) + 10; // Espaciado dinámico basado en líneas de texto
        });

        // --- 4. EVIDENCIAS FOTOGRÁFICAS ---
        if (evidencias && evidencias.length > 0) {
            if (y > pageHeight - 100) { doc.addPage(); y = margin; }
            
            doc.setFont("helvetica", "bold");
            doc.text("EVIDENCIA FOTOGRÁFICA:", margin, y);
            y += 10;

            for (let i = 0; i < evidencias.length; i++) {
                const ev = evidencias[i];
                try {
                    const imgData = await cargarImagen(ev.url_foto);
                    
                    // Ajustar tamaño de imagen (2 por fila o 1 grande)
                    const imgW = 85;
                    const imgH = 65;
                    const posX = (i % 2 === 0) ? margin : margin + imgW + 10;

                    doc.addImage(imgData, 'JPEG', posX, y, imgW, imgH);
                    
                    // Si hay descripción de imagen
                    if (ev.descripcion) {
                        doc.setFontSize(8);
                        doc.text(ev.descripcion, posX, y + imgH + 5, { maxWidth: imgW });
                    }

                    if (i % 2 !== 0) y += imgH + 25; // Bajar Y cada 2 fotos
                    
                    // Verificar si necesitamos nueva página para fotos
                    if (y > pageHeight - 80 && i < evidencias.length - 1) {
                        doc.addPage();
                        y = margin;
                    }
                } catch (err) {
                    console.warn("No se pudo cargar una imagen para el PDF", err);
                }
            }
        }

        // --- 5. GUARDAR ---
        const nombreArchivo = `REPORTE_${ticket.codigo_servicio || 'SIN_FOLIO'}.pdf`;
        doc.save(nombreArchivo);

    } catch (e: any) {
        console.error("Error PDF:", e);
        alert("Error al generar PDF: " + e.message);
    }
};