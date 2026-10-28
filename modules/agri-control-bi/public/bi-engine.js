// Motor de Inteligencia de Negocio y Recomendaciones Agrícolas - Finca La Leonora

const HOY = "2026-05-25";

/**
 * Calcula las métricas clave (KPIs) del estado actual de la finca
 */
function calcularKPIs(lotes, actividades, clima, estudiosSuelo) {
  const totalLotes = lotes.length;
  const totalActividades = actividades.length;
  
  const completadas = actividades.filter(a => a.cumplida).length;
  const pendientes = actividades.filter(a => !a.cumplida).length;
  
  const atrasadas = actividades.filter(a => {
    return !a.cumplida && a.fecha < HOY;
  }).length;
  
  const tasaCumplimiento = totalActividades > 0 
    ? Math.round((completadas / totalActividades) * 100) 
    : 0;

  // Distribución de actividades por lote
  const actividadesPorLote = {};
  lotes.forEach(l => {
    actividadesPorLote[l.nombre] = { completadas: 0, pendientes: 0, atrasadas: 0 };
  });

  actividades.forEach(a => {
    const lote = lotes.find(l => l.id === a.loteId);
    if (lote) {
      if (!actividadesPorLote[lote.nombre]) {
        actividadesPorLote[lote.nombre] = { completadas: 0, pendientes: 0, atrasadas: 0 };
      }
      if (a.cumplida) {
        actividadesPorLote[lote.nombre].completadas++;
      } else {
        if (a.fecha < HOY) {
          actividadesPorLote[lote.nombre].atrasadas++;
        } else {
          actividadesPorLote[lote.nombre].pendientes++;
        }
      }
    }
  });

  // Calcular índice de riesgo climático (0 - 100)
  let factorRiesgo = 0;
  if (clima.temporada === "sequia") {
    lotes.forEach(l => {
      if (l.etapa === "Floración" || l.etapa === "Fructificación") {
        const tieneRiego = actividades.some(a => a.loteId === l.id && a.tipo.toLowerCase().includes("riego") && a.fecha >= obtenerFechaDiasAtras(7));
        if (!tieneRiego) factorRiesgo += 25;
      }
    });
  } else if (clima.temporada === "lluvia") {
    lotes.forEach(l => {
      if (l.etapa === "Floración" || l.etapa === "Cosecha") {
        const tieneControlHongos = actividades.some(a => a.loteId === l.id && a.tipo.toLowerCase().includes("hongo") || a.tipo.toLowerCase().includes("plagas"));
        if (!tieneControlHongos) factorRiesgo += 20;
      }
    });
  }
  const riesgoClimatico = Math.min(Math.max(factorRiesgo, 0), 100);

  return {
    totalLotes,
    totalActividades,
    completadas,
    pendientes,
    atrasadas,
    tasaCumplimiento,
    actividadesPorLote,
    riesgoClimatico
  };
}

/**
 * Genera recomendaciones inteligentes basadas en mejores prácticas, clima y estudios de suelo
 */
function generarRecomendaciones(lotes, actividades, clima, estudiosSuelo) {
  const recomendaciones = [];

  // 1. Alertas de actividades atrasadas
  const atrasadas = actividades.filter(a => !a.cumplida && a.fecha < HOY);
  atrasadas.forEach(a => {
    const lote = lotes.find(l => l.id === a.loteId);
    if (lote) {
      recomendaciones.push({
        id: `rec-atrasada-${a.id}`,
        loteNombre: lote.nombre,
        tipo: "danger",
        prioridad: "Alta",
        categoria: "Operaciones",
        mensaje: `La actividad de <strong>${a.tipo}</strong> programada para el ${a.fecha} está atrasada.`,
        accionSugerida: `Reprogramar o marcar como cumplida.`
      });
    }
  });

  // 2. Alertas de Estudios de Suelo (Hacer 2 veces por año -> Cada 180 días)
  lotes.forEach(l => {
    const estudiosLote = (estudiosSuelo || []).filter(e => e.loteId === l.id);
    let requiereEstudio = false;
    let fechaUltimo = "Ninguno registrado";

    if (estudiosLote.length === 0) {
      requiereEstudio = true;
    } else {
      // Ordenar por fecha descendente
      estudiosLote.sort((a, b) => b.fecha.localeCompare(a.fecha));
      const ultimoEstudio = estudiosLote[0];
      fechaUltimo = ultimoEstudio.fecha;

      const diffTime = Math.abs(new Date(HOY) - new Date(ultimoEstudio.fecha));
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      if (diffDays > 180) {
        requiereEstudio = true;
      }
    }

    if (requiereEstudio) {
      recomendaciones.push({
        id: `rec-suelo-${l.id}`,
        loteNombre: l.nombre,
        tipo: "warning",
        prioridad: "Media",
        categoria: "Suelos",
        mensaje: `<strong>Estudio de suelo pendiente</strong>. Último análisis: ${fechaUltimo}. Se debe realizar 2 veces al año.`,
        accionSugerida: `Registrar un análisis de suelos en la sección de Estudios de Suelo.`
      });
    }
  });

  // 3. Recomendaciones por cultivo (Soporta múltiples cultivos por lote)
  lotes.forEach(l => {
    const cultivosLote = [l.cultivo, l.cultivo2].filter(c => c);

    cultivosLote.forEach(cult => {
      const prefijo = cultivosLote.length > 1 ? `[Asociado a ${cult}] ` : "";

      // Recomendación por Sequía
      if (clima.temporada === "sequia") {
        const tieneRiegoPendiente = actividades.some(a => a.loteId === l.id && a.tipo.toLowerCase().includes("riego") && !a.cumplida);
        if (!tieneRiegoPendiente && (l.etapa === "Crecimiento" || l.etapa === "Floración" || l.etapa === "Fructificación")) {
          recomendaciones.push({
            id: `rec-clima-seq-${l.id}-${cult}`,
            loteNombre: l.nombre,
            tipo: "warning",
            prioridad: "Alta",
            categoria: "Riego",
            mensaje: `${prefijo}Temporada seca. El cultivo de <strong>${cult}</strong> requiere hidratación regular en su etapa de ${l.etapa}.`,
            accionSugerida: `Programar un riego de piso.`
          });
        }
      }

      // Recomendación por Lluvias
      if (clima.temporada === "lluvia") {
        if (l.etapa === "Floración" || l.etapa === "Fructificación") {
          const tieneControlHongos = actividades.some(a => 
            a.loteId === l.id && 
            a.tipo.toLowerCase().includes("plaga") || a.tipo.toLowerCase().includes("hongo")
          );
          if (!tieneControlHongos) {
            recomendaciones.push({
              id: `rec-clima-lluvia-${l.id}-${cult}`,
              loteNombre: l.nombre,
              tipo: "warning",
              prioridad: "Media",
              categoria: "Control de Plagas",
              mensaje: `${prefijo}Temporada de lluvias activa. Riesgo alto de hongos en <strong>${cult}</strong> en etapa de ${l.etapa}.`,
              accionSugerida: `Programar una fumigación preventiva.`
            });
          }
        }
      }

      // Recomendaciones de etapa
      if (l.etapa === "Siembra") {
        const tieneAbono = actividades.some(a => a.loteId === l.id && a.tipo.toLowerCase().includes("fertiliz") || a.tipo.toLowerCase().includes("enmienda"));
        if (!tieneAbono) {
          recomendaciones.push({
            id: `rec-etapa-siem-${l.id}-${cult}`,
            loteNombre: l.nombre,
            tipo: "info",
            prioridad: "Media",
            categoria: "Enmienda Suelo",
            mensaje: `${prefijo}El lote está en etapa de Siembra de <strong>${cult}</strong>. Se recomienda acondicionar el suelo.`,
            accionSugerida: `Programar enmienda de piso o aplicación de abono orgánico.`
          });
        }
      }
    });
  });

  return recomendaciones;
}

/**
 * Escanea y analiza los comentarios y observaciones de las actividades completadas 
 * para alertar sobre incidencias reportadas en campo (maleza, plagas, deficiencias, etc.)
 */
function analizarObservaciones(actividades, lotes) {
  const alertas = [];
  const palabrasClave = [
    { key: "plaga", label: "Plagas detectadas", tipo: "danger" },
    { key: "roya", label: "Presencia de Roya / Hongos", tipo: "danger" },
    { key: "hongo", label: "Presencia de Hongos", tipo: "danger" },
    { key: "maleza", label: "Presencia de Malezas", tipo: "warning" },
    { key: "hierba", label: "Presencia de Malezas", tipo: "warning" },
    { key: "amarillo", label: "Hojas Amarillas (Deficiencia)", tipo: "warning" },
    { key: "deficiencia", label: "Deficiencia de Nutrientes", tipo: "warning" },
    { key: "sequia", label: "Estrés Hídrico", tipo: "danger" },
    { key: "estres", label: "Estrés en Cultivo", tipo: "warning" }
  ];

  actividades.forEach(a => {
    if (!a.cumplida || !a.notas) return;
    
    const notasLower = a.notas.toLowerCase();
    const lote = lotes.find(l => l.id === a.loteId);
    const loteNombre = lote ? lote.nombre : "Lote Desconocido";

    palabrasClave.forEach(p => {
      if (notasLower.includes(p.key)) {
        alertas.push({
          id: `alert-note-${a.id}-${p.key}`,
          loteNombre: loteNombre,
          titulo: p.label,
          tipo: p.tipo,
          observacion: a.notas,
          actividadTipo: a.tipo,
          fecha: a.fecha,
          personal: a.personal
        });
      }
    });
  });

  return alertas;
}

// Función auxiliar para restar días a la fecha de simulación
function obtenerFechaDiasAtras(dias) {
  const current = new Date(HOY);
  current.setDate(current.getDate() - dias);
  const yyyy = current.getFullYear();
  const mm = String(current.getMonth() + 1).padStart(2, '0');
  const dd = String(current.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}
