import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatDate } from './utils';

// Función auxiliar para convertir URL de imagen a Base64 (necesario para jsPDF)
const getBase64ImageFromURL = (url: string): Promise<string> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = "Anonymous";
        img.src = url;
        img.onload = () => {
            const canvas = document.createElement("canvas");
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext("2d");
            ctx?.drawImage(img, 0, 0);
            const dataURL = canvas.toDataURL("image/jpeg");
            resolve(dataURL);
        };
        img.onerror = (error) => reject(error);
    });
};

export const generarPDF = async (ticket: any, datosTecnicos: any, esSnapshot: boolean = false) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;
    const margin = 15;
    const usableWidth = pageWidth - (margin * 2);
    const colWidth = usableWidth / 2; // Ancho exacto del 50%

    const azulWuotto = "#121c32";
    const rojoFolio = "#dc2626";
    const grisFondo = "#f8fafc";

    const datos = esSnapshot ? datosTecnicos : ticket;
    let yPos = 20;

    // --- 1. ENCABEZADO PREMIUM ---
    doc.setFont("helvetica", "bold");
    doc.setFontSize(24);
    doc.setTextColor(azulWuotto);
    doc.text("WUOTTO", margin, yPos);
    
    yPos += 6;
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100);
    doc.text("Construcciones, HVAC & Mantenimiento", margin, yPos);

    // Folio Alineado a la derecha
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(rojoFolio);
    doc.text(`FOLIO: ${ticket.codigo_servicio}`, pageWidth - margin, 20, { align: "right" });

    yPos += 15;

    // --- 2. TABLA DE DATOS (50/50 FORZADO) ---
    // Preparamos los textos con saltos de línea manuales para limpieza
    const col1Content = `CLIENTE:\n${ticket["Empresa"] || '---'}\n\nSOLICITANTE:\n${ticket["Nombre Completo"] || '---'}\n\nTIPO DE SERVICIO:\n${ticket.tipo_mantenimiento || '---'}`;
    const col2Content = `DIRECCIÓN:\n${ticket.ubicacion || 'Sin dirección registrada'}\n\nTELÉFONO:\n${ticket["Número de Contacto"] || '---'}\n\nFECHA SOLICITUD:\n${formatDate(ticket.fecha_solicitud)}`;

    autoTable(doc, {
        startY: yPos,
        head: [['DATOS DEL SERVICIO', 'UBICACIÓN Y CONTACTO']],
        body: [[col1Content, col2Content]],
        theme: 'grid',
        headStyles: {
            fillColor: azulWuotto,
            textColor: 255,
            halign: 'center',
            valign: 'middle',
            fontStyle: 'bold',
            fontSize: 9,
            cellPadding: 5
        },
        bodyStyles: {
            fontSize: 8,
            cellPadding: 6,
            valign: 'top',
            lineColor: [200, 200, 200]
        },
        // ESTO ES LO CLAVE: Forzar el ancho exacto
        columnStyles: {
            0: { cellWidth: colWidth },
            1: { cellWidth: colWidth }
        }
    });

    yPos = (doc as any).lastAutoTable.finalY + 12;

    // --- 3. REGISTRO DE TIEMPOS Y GPS (DISEÑO TIPO TARJETA) ---
    // Validación de texto GPS para que se vea profesional
    const txtGpsInicio = ticket.ubicacion_gps_inicio || ticket.ubicacion_gps;
    const txtGpsFin = ticket.ubicacion_gps_fin;
    const mostrarGpsInicio = txtGpsInicio && txtGpsInicio !== "GPS Desactivado" ? txtGpsInicio : "No disponible (Sin permiso)";
    const mostrarGpsFin = txtGpsFin ? txtGpsFin : (ticket.hora_fin ? "No disponible" : "Pendiente");

    // Fondo del bloque
    doc.setFillColor(grisFondo);
    doc.setDrawColor(220);
    doc.roundedRect(margin, yPos, usableWidth, 28, 2, 2, 'FD');

    // Títulos
    doc.setFontSize(8);
    doc.setTextColor(azulWuotto);
    doc.setFont("helvetica", "bold");
    
    const centroIzq = margin + (usableWidth / 4);
    const centroDer = pageWidth - margin - (usableWidth / 4);

    // Columna Inicio
    doc.text("REGISTRO DE INICIO", centroIzq, yPos + 8, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.text(`Fecha: ${formatDate(ticket.hora_inicio) || '--'}`, centroIzq, yPos + 14, { align: "center" });
    doc.setTextColor(100);
    doc.setFontSize(7);
    doc.text(`GPS: ${mostrarGpsInicio}`, centroIzq, yPos + 20, { align: "center" });

    // Separador Vertical
    doc.setDrawColor(200);
    doc.line(pageWidth / 2, yPos + 4, pageWidth / 2, yPos + 24);

    // Columna Cierre
    doc.setFontSize(8);
    doc.setTextColor(azulWuotto);
    doc.setFont("helvetica", "bold");
    doc.text("REGISTRO DE CIERRE", centroDer, yPos + 8, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.text(`Fecha: ${formatDate(ticket.hora_fin) || '--'}`, centroDer, yPos + 14, { align: "center" });
    doc.setTextColor(100);
    doc.setFontSize(7);
    doc.text(`GPS: ${mostrarGpsFin}`, centroDer, yPos + 20, { align: "center" });

    yPos += 40;

    // --- 4. INFORME TÉCNICO (BLOQUES LIMPIOS) ---
    const crearBloque = (titulo: string, contenido: string) => {
        if (yPos > 260) { doc.addPage(); yPos = 20; }

        // Encabezado de sección
        doc.setFillColor(azulWuotto);
        doc.rect(margin, yPos, usableWidth, 7, 'F');
        doc.setTextColor(255);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.text(titulo, pageWidth / 2, yPos + 5, { align: "center" });

        yPos += 10;

        // Contenido
        doc.setTextColor(0);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        
        const texto = contenido || "Sin comentarios registrados.";
        const lineas = doc.splitTextToSize(texto, usableWidth - 4);
        
        // Imprimir líneas centradas
        lineas.forEach((line: string) => {
            doc.text(line, pageWidth / 2, yPos, { align: "center" });
            yPos += 5;
        });
        yPos += 8;
    };

    const hallazgos = datos.hallazgos || datos.hallazgos_guardado;
    const diagnostico = datos.diagnostico || datos.diagnostico_guardado;
    const materiales = datos.materiales || datos.materiales_guardado;
    const recomendaciones = datos.recomendaciones || datos.recomendaciones_guardado;

    crearBloque("HALLAZGOS ENCONTRADOS", hallazgos);
    crearBloque("DIAGNÓSTICO TÉCNICO", diagnostico);
    crearBloque("MATERIALES / HERRAMIENTAS", materiales);
    crearBloque("RECOMENDACIONES", recomendaciones);

    // --- 5. EVIDENCIA FOTOGRÁFICA (INCRUSTACIÓN REAL) ---
    if (yPos > 220) { doc.addPage(); yPos = 20; }

    doc.setFillColor(azulWuotto);
    doc.rect(margin, yPos, usableWidth, 7, 'F');
    doc.setTextColor(255);
    doc.setFont("helvetica", "bold");
    doc.text("EVIDENCIA FOTOGRÁFICA", pageWidth / 2, yPos + 5, { align: "center" });
    yPos += 15;

    // Procesar imágenes
    const evidenciasList = esSnapshot ? datos.evidencias_snapshot : datos.evidencias_actuales; // Asegúrate de pasar las evidencias en datosTecnicos cuando llamas a la función

    if (evidenciasList && evidenciasList.length > 0) {
        let xImg = margin;
        // Ajustamos tamaño de imagen (4 imágenes por fila aprox)
        const imgWidth = (usableWidth - 15) / 4; 
        const imgHeight = 35;

        for (const ev of evidenciasList) {
            try {
                // Intentamos convertir a base64
                if (ev.url_foto) {
                    const base64Img = await getBase64ImageFromURL(ev.url_foto);
                    
                    // Verificar si cabe en la línea
                    if (xImg + imgWidth > pageWidth - margin) {
                        xImg = margin;
                        yPos += imgHeight + 10;
                    }
                    // Verificar si cabe en la página
                    if (yPos + imgHeight > 270) {
                        doc.addPage();
                        yPos = 20;
                        xImg = margin;
                    }

                    doc.addImage(base64Img, 'JPEG', xImg, yPos, imgWidth, imgHeight);
                    
                    // Borde a la imagen
                    doc.setDrawColor(200);
                    doc.rect(xImg, yPos, imgWidth, imgHeight);
                    
                    xImg += imgWidth + 5;
                }
            } catch (error) {
                console.error("No se pudo cargar imagen:", error);
                // Si falla, ponemos un placeholder de texto
                doc.setFontSize(6);
                doc.setTextColor(150);
                doc.text("Img no disponible", xImg + 5, yPos + 15);
                xImg += imgWidth + 5;
            }
        }
        yPos += 45; // Espacio después de las fotos
    } else {
        doc.setTextColor(100);
        doc.setFont("helvetica", "italic");
        doc.text("No se adjuntaron fotografías en este reporte.", pageWidth / 2, yPos, { align: "center" });
        yPos += 20;
    }

    // --- 6. FIRMAS ---
    if (yPos > 250) { doc.addPage(); yPos = 250; } else { yPos = 265; } // Forzar al final

    doc.setDrawColor(0);
    doc.setLineWidth(0.5);
    
    // Líneas
    doc.line(margin + 10, yPos, margin + 70, yPos); // Izquierda
    doc.line(pageWidth - margin - 70, yPos, pageWidth - margin - 10, yPos); // Derecha

    doc.setTextColor(0);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    
    doc.text("TÉCNICO RESPONSABLE", margin + 40, yPos + 5, { align: "center" });
    doc.text("FIRMA DE CONFORMIDAD", pageWidth - margin - 40, yPos + 5, { align: "center" });

    // Guardar
    const nombreArchivo = `OS_${ticket.codigo_servicio}.pdf`;
    doc.save(nombreArchivo);
};