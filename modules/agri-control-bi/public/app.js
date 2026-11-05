// Controlador Principal de AgriControl BI - Finca La Leonora

// Constantes de autocompletado (sugerencias por defecto)
const SUGGESTED_CULTIVOS = ["Café", "Cacao", "Aguacate", "Maíz", "Cítricos", "Plátano"];
const SUGGESTED_LABORES = [
  "Fertilización Foliar",
  "Fertilización Suelo/Piso",
  "Herbicida",
  "Control de Plagas",
  "Riego",
  "Poda",
  "Enmienda Suelo",
  "Cosecha",
  "Monitoreo"
];
const SUGGESTED_PRODUCTOS = [
  { id: "prod-def-1", nombre: "Fertilizante Foliar Líquido", tipo: "Fertilización Foliar" },
  { id: "prod-def-2", nombre: "Abono Orgánico (Compost)", tipo: "Fertilización Suelo/Piso" },
  { id: "prod-def-3", nombre: "Fungicida Preventivo", tipo: "Control de Plagas" },
  { id: "prod-def-4", nombre: "Herbicida Selectivo", tipo: "Herbicida" }
];

let STATE = {
  lotes: [],
  actividades: [],
  estudiosSuelo: [],
  dosificacionesHistoricas: [],
  clima: { temporada: "sequia", temperaturaPromedio: 28, humedadPromedio: 60 },
  
  // Sugerencias locales / sistema
  sugCultivos: SUGGESTED_CULTIVOS,
  sugLabores: SUGGESTED_LABORES,
  sugPersonal: [],
  sugProductos: SUGGESTED_PRODUCTOS
};

// Instancias de Chart.js globales
let chartProductividad = null;
let chartDistribucion = null;

// Ejecución al iniciar
document.addEventListener("DOMContentLoaded", async () => {
  setupNavigation();
  setupClimateToggles();
  setupFormsAndModals();
  
  // Cargar datos desde la API al iniciar
  await refreshStateFromAPI();
  
  // Establecer fecha
  document.getElementById("current-time-lbl").textContent = HOY;
});

// Refrescar el estado de la aplicación desde la API REST
async function refreshStateFromAPI() {
  try {
    const [lotesRes, actividadesRes, suelosRes, dosificacionesRes, climaRes, personalRes] = await Promise.all([
      fetch('/api/lotes'),
      fetch('/api/actividades'),
      fetch('/api/suelos'),
      fetch('/api/dosificaciones'),
      fetch('/api/clima'),
      fetch('/api/personal')
    ]);

    STATE.lotes = await lotesRes.json();
    STATE.actividades = await actividadesRes.json();
    STATE.estudiosSuelo = await suelosRes.json();
    STATE.dosificacionesHistoricas = await dosificacionesRes.json();
    STATE.clima = await climaRes.json();
    STATE.sugPersonal = await personalRes.json();

    // Sincronizar autocompletados
    sincronizarDatalists();

    // Refrescar vistas
    updateDashboard();
    renderLotesGrid();
    applyFilters();
    renderSuelosGrid();
    updateClimatePanel();
  } catch (err) {
    console.error("Error al refrescar estado desde la API:", err);
    showToast("Error de conexión con la base de datos.");
  }
}

// Guardado de estado (ahora delega al refresco desde la API ya que las operaciones mutan la BD directamente)
async function saveState() {
  await refreshStateFromAPI();
  if (window.lucide) lucide.createIcons();
}

/* ==========================================================================
   NAVEGACIÓN (Sleek Page Router)
   ========================================================================== */
function setupNavigation() {
  const navItems = document.querySelectorAll(".nav-item");
  const sections = document.querySelectorAll(".app-section");

  navItems.forEach(item => {
    item.addEventListener("click", () => {
      const targetSection = item.getAttribute("data-section");

      navItems.forEach(i => i.classList.remove("active"));
      sections.forEach(s => s.classList.remove("active"));

      item.classList.add("active");
      const activeSec = document.getElementById(`${targetSection}-section`);
      if (activeSec) {
        activeSec.classList.add("active");
      }

      // Acciones adicionales por sección
      if (targetSection === "dashboard") {
        updateDashboard();
      } else if (targetSection === "lotes") {
        renderLotesGrid();
      } else if (targetSection === "agenda") {
        applyFilters();
      } else if (targetSection === "suelos") {
        renderSuelosGrid();
      } else if (targetSection === "clima") {
        updateClimatePanel();
      }
    });
  });
}

/* ==========================================================================
   SINCRONIZACIÓN DE DATALISTS (HISTORIAL AUTO-SUGERIDO)
   ========================================================================== */
function sincronizarDatalists() {
  // Extraer valores únicos de las actividades registradas
  const cultivosEnUso = new Set([...STATE.sugCultivos]);
  const laboresEnUso = new Set([...STATE.sugLabores]);
  const personalEnUso = new Set([...STATE.sugPersonal]);
  const insumosEnUso = new Set(STATE.sugProductos.map(p => p.nombre));
  const dosificacionesEnUso = new Set();

  STATE.lotes.forEach(l => {
    if (l.cultivo) cultivosEnUso.add(l.cultivo);
    if (l.cultivo2) cultivosEnUso.add(l.cultivo2);
  });

  STATE.actividades.forEach(a => {
    if (a.tipo) laboresEnUso.add(a.tipo);
    if (a.personal) personalEnUso.add(a.personal);
    if (a.productoNombre) insumosEnUso.add(a.productoNombre);
    if (a.dosificacion) dosificacionesEnUso.add(a.dosificacion);
  });

  // Cargar en Datalists
  poblarDatalist("crop-suggestions", [...cultivosEnUso]);
  poblarDatalist("labor-suggestions", [...laboresEnUso]);
  poblarDatalist("personal-suggestions", [...personalEnUso]);
  poblarDatalist("producto-suggestions", [...insumosEnUso]);
  poblarDatalist("dosificacion-suggestions", [...dosificacionesEnUso]);

  // Actualizar listas del estado
  STATE.sugCultivos = [...cultivosEnUso];
  STATE.sugLabores = [...laboresEnUso];
  STATE.sugPersonal = [...personalEnUso];
}

function poblarDatalist(id, lista) {
  const datalist = document.getElementById(id);
  if (!datalist) return;
  datalist.innerHTML = "";
  lista.forEach(item => {
    datalist.innerHTML += `<option value="${escapeHtml(item)}">`;
  });
}

/* ==========================================================================
   DASHBOARD & BUSINESS INTELLIGENCE
   ========================================================================== */
function updateDashboard() {
  const kpis = calcularKPIs(STATE.lotes, STATE.actividades, STATE.clima, STATE.estudiosSuelo);

  // Actualizar Gran Indicador Ejecutivo de Capacidad Finca
  updateFincaGrandKPI();

  // Renderizar números en KPIs
  document.getElementById("kpi-cumplimiento-val").textContent = `${kpis.tasaCumplimiento}%`;
  document.getElementById("kpi-lotes-val").textContent = kpis.totalLotes;
  document.getElementById("kpi-atrasadas-val").textContent = kpis.atrasadas;
  document.getElementById("kpi-riesgo-val").textContent = `${kpis.riesgoClimatico}%`;

  // Color dinámico riesgo
  const riesgoEl = document.getElementById("kpi-riesgo-val");
  if (kpis.riesgoClimatico > 60) {
    riesgoEl.style.color = "var(--danger)";
  } else if (kpis.riesgoClimatico > 30) {
    riesgoEl.style.color = "var(--accent-gold)";
  } else {
    riesgoEl.style.color = "var(--primary)";
  }

  // Recomendaciones BI
  renderBIRecommendations(kpis);

  // Analizador de observaciones
  renderObservationAlerts();

  // Gráficos
  renderCharts(kpis);
}

function renderBIRecommendations(kpis) {
  const recsList = document.getElementById("bi-recs-list");
  recsList.innerHTML = "";

  const recomendaciones = generarRecomendaciones(STATE.lotes, STATE.actividades, STATE.clima, STATE.estudiosSuelo);

  if (recomendaciones.length === 0) {
    recsList.innerHTML = `
      <div class="empty-state">
        <i data-lucide="sparkles"></i>
        <p>No hay alertas. ¡La Leonora está al día según las buenas prácticas!</p>
      </div>
    `;
    if (window.lucide) lucide.createIcons();
    return;
  }

  recomendaciones.forEach(rec => {
    recsList.appendChild(crearElementoRecomendacion(rec));
  });
  if (window.lucide) lucide.createIcons();
}

function crearElementoRecomendacion(rec) {
  const item = document.createElement("div");
  item.className = `rec-item ${rec.tipo}`;
  
  item.innerHTML = `
    <div class="rec-badge-row">
      <span class="rec-lote">${rec.loteNombre}</span>
      <span class="rec-priority ${rec.prioridad}">${rec.prioridad}</span>
    </div>
    <div class="rec-text">${rec.mensaje}</div>
    <div class="rec-suggested-action">
      <span>💡 ${rec.accionSugerida}</span>
      <button class="rec-create-btn" onclick="quickScheduleFromBI('${escapeHtml(rec.loteNombre)}', '${escapeHtml(rec.categoria)}')">
        <i data-lucide="plus"></i> Programar
      </button>
    </div>
  `;
  return item;
}

function quickScheduleFromBI(loteNombre, categoria) {
  const lote = STATE.lotes.find(l => l.nombre === loteNombre);
  abrirModalActividad();
  
  if (lote) {
    document.getElementById("act-form-lote").value = lote.id;
    document.getElementById("act-form-etapa").value = lote.etapa;
  }

  let tipoSugerido = "Monitoreo";
  if (categoria === "Riego") tipoSugerido = "Riego";
  else if (categoria === "Fertilización" || categoria === "Suelos") tipoSugerido = "Fertilización Suelo/Piso";
  else if (categoria === "Control de Plagas") tipoSugerido = "Control de Plagas";

  document.getElementById("act-form-tipo").value = tipoSugerido;
  document.getElementById("act-form-fecha").value = HOY;
  
  // Forzar predicción
  predecirDosificacion();
}

function renderObservationAlerts() {
  const tbody = document.getElementById("observation-alerts-body");
  tbody.innerHTML = "";

  const alertas = analizarObservaciones(STATE.actividades, STATE.lotes);

  if (alertas.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="text-center" style="padding: 24px; color: var(--text-muted);">
          Sin reportes ni anomalías sanitarias activas extraídas de las observaciones.
        </td>
      </tr>
    `;
    return;
  }

  alertas.forEach(a => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><strong>${a.loteNombre}</strong></td>
      <td><span style="font-weight:600; color: ${a.tipo === 'danger' ? 'var(--danger)' : 'var(--accent-gold)'};">${a.titulo}</span></td>
      <td><span class="badge ${a.tipo === 'danger' ? 'badge-atrasada' : 'badge-pendiente'}">${a.tipo.toUpperCase()}</span></td>
      <td style="font-style: italic; max-width: 250px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${escapeHtml(a.observacion)}">"${a.observacion}"</td>
      <td>${a.fecha}</td>
      <td>${a.personal}</td>
      <td><span class="badge stage-badge">${a.actividadTipo}</span></td>
    `;
    tbody.appendChild(tr);
  });
}

function renderCharts(kpis) {
  if (chartProductividad) chartProductividad.destroy();
  if (chartDistribucion) chartDistribucion.destroy();

  const ctxProd = document.getElementById("chartProductividad").getContext("2d");
  const ctxDist = document.getElementById("chartDistribucion").getContext("2d");

  Chart.defaults.color = '#9ca3af';
  Chart.defaults.font.family = "'Inter', sans-serif";

  const nombresLotes = Object.keys(kpis.actividadesPorLote);
  const completadasData = nombresLotes.map(n => kpis.actividadesPorLote[n].completadas);
  const pendientesData = nombresLotes.map(n => kpis.actividadesPorLote[n].pendientes);
  const atrasadasData = nombresLotes.map(n => kpis.actividadesPorLote[n].atrasadas);

  if (nombresLotes.length === 0) {
    // Si no hay datos, renderizar un gráfico vacío
    return;
  }

  chartProductividad = new Chart(ctxProd, {
    type: 'bar',
    data: {
      labels: nombresLotes,
      datasets: [
        { label: 'Cumplidas', data: completadasData, backgroundColor: '#10b981', borderRadius: 4 },
        { label: 'Pendientes', data: pendientesData, backgroundColor: '#f59e0b', borderRadius: 4 },
        { label: 'Atrasadas', data: atrasadasData, backgroundColor: '#ef4444', borderRadius: 4 }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { stacked: true, grid: { display: false } },
        y: { stacked: true, grid: { color: 'rgba(255,255,255,0.05)' } }
      }
    }
  });

  const tiposMap = {};
  STATE.actividades.forEach(a => {
    tiposMap[a.tipo] = (tiposMap[a.tipo] || 0) + 1;
  });

  const labelsTipos = Object.keys(tiposMap);
  const dataTipos = Object.values(tiposMap);

  chartDistribucion = new Chart(ctxDist, {
    type: 'doughnut',
    data: {
      labels: labelsTipos.length > 0 ? labelsTipos : ["Sin actividades"],
      datasets: [{
        data: dataTipos.length > 0 ? dataTipos : [1],
        backgroundColor: labelsTipos.length > 0 
          ? ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#6b7280']
          : ['rgba(255,255,255,0.05)'],
        borderWidth: 1,
        borderColor: 'rgba(9, 17, 12, 0.8)'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: 'right', labels: { boxWidth: 12, padding: 8 } } },
      cutout: '65%'
    }
  });
}

/* ==========================================================================
   MÓDULO CLIMÁTICO Y TEMPORADAS
   ========================================================================== */
function setupClimateToggles() {
  const btnSequia = document.getElementById("btn-clima-sequia");
  const btnLluvia = document.getElementById("btn-clima-lluvia");

  const updateClimaAPI = async (temporada, temp, hum) => {
    try {
      const response = await fetch('/api/clima', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ temporada, temperaturaPromedio: temp, humedadPromedio: hum })
      });
      if (!response.ok) throw new Error("Error al actualizar clima");
      await saveState();
    } catch (err) {
      console.error(err);
      alert("Error al guardar cambios de clima.");
    }
  };

  btnSequia.addEventListener("click", async () => {
    await updateClimaAPI("sequia", 30, 45);
    showToast("Clima cambiado a Sequía. Recomendaciones actualizadas.");
  });

  btnLluvia.addEventListener("click", async () => {
    await updateClimaAPI("lluvia", 24, 85);
    showToast("Clima cambiado a Lluvias. Recomendaciones de hongos activas.");
  });
}

function updateClimatePanel() {
  if (!STATE.clima) return;
  const temp = STATE.clima.temporada;
  const isSequia = temp === "sequia";
  
  const btnSequia = document.getElementById("btn-clima-sequia");
  const btnLluvia = document.getElementById("btn-clima-lluvia");
  if (btnSequia && btnLluvia) {
    if (isSequia) {
      btnSequia.classList.add("active");
      btnLluvia.classList.remove("active");
    } else {
      btnLluvia.classList.add("active");
      btnSequia.classList.remove("active");
    }
  }

  const iconDiv = document.getElementById("climate-panel-icon");
  const titleDiv = document.getElementById("climate-panel-title");
  const descDiv = document.getElementById("climate-panel-desc");
  const inputTemp = document.getElementById("climate-input-temp");
  const inputHum = document.getElementById("climate-input-hum");

  inputTemp.value = STATE.clima.temperaturaPromedio;
  inputHum.value = STATE.clima.humedadPromedio;

  if (isSequia) {
    iconDiv.innerHTML = '<i data-lucide="sun"></i>';
    iconDiv.className = "climate-icon-big sequia";
    titleDiv.textContent = "Temporada de Sequía / Verano";
    descDiv.textContent = "Evaporación alta. Se requiere un riguroso control del riego.";
  } else {
    iconDiv.innerHTML = '<i data-lucide="cloud-rain"></i>';
    iconDiv.className = "climate-icon-big lluvia";
    titleDiv.textContent = "Temporada de Lluvias / Invierno";
    descDiv.textContent = "Humedad alta. Atención a la escorrentía e infecciones por hongos.";
  }

  // Recomendaciones de clima
  const recs = generarRecomendaciones(STATE.lotes, STATE.actividades, STATE.clima, STATE.estudiosSuelo);
  const climateRecsContainer = document.getElementById("clima-recs-list");
  if (climateRecsContainer) {
    climateRecsContainer.innerHTML = "";

    const weatherRecs = recs.filter(r => r.categoria === "Riego" || r.categoria === "Control de Plagas" || r.categoria === "Enmienda Suelo");

    if (weatherRecs.length === 0) {
      climateRecsContainer.innerHTML = `<div class="empty-recs"><p>No hay alertas climáticas.</p></div>`;
    } else {
      weatherRecs.forEach(r => {
        climateRecsContainer.appendChild(crearElementoRecomendacion(r));
      });
    }
  }

  inputTemp.onchange = async (e) => {
    const parsedTemp = parseInt(e.target.value) || 25;
    try {
      await fetch('/api/clima', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...STATE.clima, temperaturaPromedio: parsedTemp })
      });
      await saveState();
    } catch (err) {
      console.error(err);
    }
  };
  inputHum.onchange = async (e) => {
    const parsedHum = parseInt(e.target.value) || 60;
    try {
      await fetch('/api/clima', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...STATE.clima, humedadPromedio: parsedHum })
      });
      await saveState();
    } catch (err) {
      console.error(err);
    }
  };
}

/* ==========================================================================
   MÓDULO LOTES & CULTIVOS (CRUD CON CULTIVO DUAL)
   ========================================================================== */
function renderLotesGrid() {
  const grid = document.getElementById("lotes-container");
  if (!grid) return;
  grid.innerHTML = "";

  if (STATE.lotes.length === 0) {
    grid.innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1;">
        <i data-lucide="layers"></i>
        <p>No tienes lotes registrados en La Leonora. ¡Crea uno para empezar!</p>
      </div>
    `;
    if (window.lucide) lucide.createIcons();
    return;
  }

  STATE.lotes.forEach(l => {
    const actsTotalLote = STATE.actividades.filter(a => a.loteId === l.id);
    const actsRealizadasLote = actsTotalLote.filter(a => a.cumplida).length;
    const actsPendientesLote = actsTotalLote.filter(a => !a.cumplida).length;
    const actsLote = actsTotalLote.filter(a => a.cumplida && a.productoNombre);
    const prodNombres = [...new Set(actsLote.map(a => a.productoNombre))];

    const card = document.createElement("div");
    card.className = "lote-card";
    card.id = `lote-card-${l.id}`;
    
    // Tags de cultivos presentes
    let cropsHtml = `<span class="lote-crop">${escapeHtml(l.cultivo)}</span>`;
    if (l.cultivo2) {
      cropsHtml += `<span class="lote-crop" style="background: rgba(59,130,246,0.12); color: var(--accent-blue); margin-left: 5px;">${escapeHtml(l.cultivo2)}</span>`;
    }
    if (l.cultivo3) {
      cropsHtml += `<span class="lote-crop" style="background: rgba(245,158,11,0.12); color: #fbbf24; margin-left: 5px;">${escapeHtml(l.cultivo3)}</span>`;
    }

    // Datos de Siembra 1
    const a1 = Number(l.arboles1 || 0);
    const s1 = Number(l.distanciaSurco1 || 0);
    const p1 = Number(l.distanciaPlanta1 || 0);
    const pend1 = Number(l.arbolesPendientes1 || 0);
    const densTeor1 = (s1 > 0 && p1 > 0) ? Math.round(10000 / (s1 * p1)) : 0;
    const densReal1 = (a1 > 0 && l.area > 0) ? Math.round(a1 / l.area) : 0;

    // Datos de Siembra 2
    const a2 = Number(l.arboles2 || 0);
    const s2 = Number(l.distanciaSurco2 || 0);
    const p2 = Number(l.distanciaPlanta2 || 0);
    const pend2 = Number(l.arbolesPendientes2 || 0);
    const densTeor2 = (s2 > 0 && p2 > 0) ? Math.round(10000 / (s2 * p2)) : 0;
    const densReal2 = (a2 > 0 && l.area > 0) ? Math.round(a2 / l.area) : 0;

    // Datos de Siembra 3
    const a3 = Number(l.arboles3 || 0);
    const s3 = Number(l.distanciaSurco3 || 0);
    const p3 = Number(l.distanciaPlanta3 || 0);
    const pend3 = Number(l.arbolesPendientes3 || 0);
    const densTeor3 = (s3 > 0 && p3 > 0) ? Math.round(10000 / (s3 * p3)) : 0;
    const densReal3 = (a3 > 0 && l.area > 0) ? Math.round(a3 / l.area) : 0;

    // Totales actuales y pendientes
    const totalArbolesActuales = a1 + a2 + a3;
    const totalPendientes = Number(l.arbolesPendientes || 0) || (pend1 + pend2 + pend3);
    const totalProyectado = totalArbolesActuales + totalPendientes;

    // Capacidad Teórica del lote (según marco dominante o promedio)
    let densTeorDominante = densTeor1 > 0 ? densTeor1 : (densTeor2 > 0 ? densTeor2 : (densTeor3 > 0 ? densTeor3 : 0));
    let capacidadTeorica = (densTeorDominante > 0 && l.area > 0) ? Math.round(densTeorDominante * l.area) : 0;

    let pctInstalada = capacidadTeorica > 0 ? Math.min(100, Math.round((totalArbolesActuales / capacidadTeorica) * 100)) : 0;
    let pctProyectada = capacidadTeorica > 0 ? Math.min(100, Math.round((totalProyectado / capacidadTeorica) * 100)) : 0;
    let pctPendiente = Math.max(0, pctProyectada - pctInstalada);
    let faltanteTeorico = capacidadTeorica > totalProyectado ? (capacidadTeorica - totalProyectado) : 0;

    card.innerHTML = `
      <div class="lote-header">
        <div>
          <h3 class="lote-name">${escapeHtml(l.nombre)}</h3>
          <span class="badge stage-badge mt-2">${escapeHtml(l.etapa)}</span>
        </div>
        <div style="display:flex; flex-direction:column; align-items:flex-end; gap:4px;">
          ${cropsHtml}
        </div>
      </div>

      <div class="lote-stats" style="grid-template-columns: 1fr 1fr; gap: 8px;">
        <div class="lote-stat-item">
          <span class="lote-stat-lbl">Área del Lote</span>
          <span class="lote-stat-val" style="color: #34d399;">${l.area} Ha</span>
        </div>
        <div class="lote-stat-item">
          <span class="lote-stat-lbl">Total Árboles Sembrados</span>
          <span class="lote-stat-val" style="color: #fbbf24;">${totalArbolesActuales > 0 ? totalArbolesActuales.toLocaleString() + ' arb.' : 'Sin parametrizar'}</span>
        </div>
      </div>

      <!-- PANEL BI: CAPACIDAD INSTALADA VS TEÓRICA -->
      <div class="lote-capacity-box">
        <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.76rem; margin-bottom: 4px;">
          <span style="color: #cbd5e1; font-weight: 600; display: flex; align-items: center; gap: 4px;">
            <i data-lucide="gauge" style="width: 14px; height: 14px; color: #10b981;"></i> Capacidad del Lote:
          </span>
          <span style="font-weight: 700; color: ${pctInstalada >= 80 ? '#10b981' : '#f59e0b'};">
            ${capacidadTeorica > 0 ? `${pctInstalada}% Instalada` : 'Densidad sin definir'}
          </span>
        </div>

        ${capacidadTeorica > 0 ? `
        <div class="lote-capacity-bar-container" title="Verde: Sembrados actuales (${pctInstalada}%) | Amarillo: Pendientes (${pctPendiente}%)">
          <div class="lote-capacity-installed" style="width: ${pctInstalada}%;"></div>
          <div class="lote-capacity-pending" style="width: ${pctPendiente}%;"></div>
        </div>

        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px; font-size: 0.68rem; color: var(--text-muted); text-align: center; margin-top: 6px;">
          <div style="background: rgba(16,185,129,0.1); padding: 3px 4px; border-radius: 6px;">
            <div style="color: #34d399; font-weight: 700;">${totalArbolesActuales.toLocaleString()}</div>
            <div>Sembrados</div>
          </div>
          <div style="background: rgba(245,158,11,0.1); padding: 3px 4px; border-radius: 6px;">
            <div style="color: #fbbf24; font-weight: 700;">+${totalPendientes.toLocaleString()}</div>
            <div>Pendientes</div>
          </div>
          <div style="background: rgba(255,255,255,0.05); padding: 3px 4px; border-radius: 6px;">
            <div style="color: #fff; font-weight: 700;">${capacidadTeorica.toLocaleString()}</div>
            <div>Teórica Máx.</div>
          </div>
        </div>
        ` : `
        <div style="font-size: 0.72rem; color: var(--text-muted); font-style: italic;">
          Ingresa distancias entre surcos y plantas para calcular la capacidad máxima instalada vs teórica.
        </div>
        `}
      </div>

      <!-- Detalle Agronómico: Siembra 1 (Cultivo Principal) -->
      <div style="background: rgba(16,185,129,0.06); border: 1px solid rgba(16,185,129,0.22); border-radius: 10px; padding: 10px; font-size: 0.8rem; margin-bottom: 8px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;">
          <strong style="color: #10b981;">🌱 ${escapeHtml(l.cultivo)}</strong>
          <span style="font-size: 0.72rem; color: var(--text-muted);">${l.fechaSiembra ? 'Siembra: ' + escapeHtml(l.fechaSiembra) : 'Sin fecha'}</span>
        </div>
        <div style="display: flex; flex-direction: column; gap: 3px; font-size: 0.76rem; color: #cbd5e1;">
          <div style="display: flex; justify-content: space-between;">
            <span style="color: var(--text-muted);">Árboles Sembrados:</span>
            <strong>${a1 > 0 ? a1.toLocaleString() + ' plantas' : '<span style="color:var(--text-muted); font-weight:normal;">Sin registrar</span>'}</strong>
          </div>
          ${pend1 > 0 ? `
          <div style="display: flex; justify-content: space-between;">
            <span style="color: #fde68a;">Árboles Pendientes:</span>
            <strong style="color: #fbbf24;">+${pend1.toLocaleString()} plantas</strong>
          </div>` : ''}
          <div style="display: flex; justify-content: space-between;">
            <span style="color: var(--text-muted);">Dist. Siembra:</span>
            <span>${(s1 > 0 && p1 > 0) ? `${s1}m × ${p1}m (${(s1 * p1).toFixed(2)} m²/pl)` : '<span style="color:var(--text-muted);">Sin registrar</span>'}</span>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <span style="color: var(--text-muted);">Densidad:</span>
            <strong style="color: #34d399;">${densReal1 > 0 ? `${densReal1.toLocaleString()} pl/Ha (Real)` : (densTeor1 > 0 ? `${densTeor1.toLocaleString()} pl/Ha (Teórica)` : '<span style="color:var(--text-muted); font-weight:normal;">-</span>')}</strong>
          </div>
        </div>
      </div>

      <!-- Detalle Agronómico: Siembra 2 (Segundo Cultivo o Distinta Fecha) -->
      ${l.cultivo2 ? `
      <div style="background: rgba(59,130,246,0.06); border: 1px solid rgba(59,130,246,0.22); border-radius: 10px; padding: 10px; font-size: 0.8rem; margin-bottom: 8px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;">
          <strong style="color: #60a5fa;">🌿 ${escapeHtml(l.cultivo2)}</strong>
          <span style="font-size: 0.72rem; color: var(--text-muted);">${l.fechaSiembra2 ? 'Siembra: ' + escapeHtml(l.fechaSiembra2) : 'Sin fecha'}</span>
        </div>
        <div style="display: flex; flex-direction: column; gap: 3px; font-size: 0.76rem; color: #cbd5e1;">
          <div style="display: flex; justify-content: space-between;">
            <span style="color: var(--text-muted);">Árboles Sembrados:</span>
            <strong>${a2 > 0 ? a2.toLocaleString() + ' plantas' : '<span style="color:var(--text-muted); font-weight:normal;">Sin registrar</span>'}</strong>
          </div>
          ${pend2 > 0 ? `
          <div style="display: flex; justify-content: space-between;">
            <span style="color: #fde68a;">Árboles Pendientes:</span>
            <strong style="color: #fbbf24;">+${pend2.toLocaleString()} plantas</strong>
          </div>` : ''}
          <div style="display: flex; justify-content: space-between;">
            <span style="color: var(--text-muted);">Dist. Siembra:</span>
            <span>${(s2 > 0 && p2 > 0) ? `${s2}m × ${p2}m (${(s2 * p2).toFixed(2)} m²/pl)` : '<span style="color:var(--text-muted);">Sin registrar</span>'}</span>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <span style="color: var(--text-muted);">Densidad:</span>
            <strong style="color: #60a5fa;">${densReal2 > 0 ? `${densReal2.toLocaleString()} pl/Ha (Real)` : (densTeor2 > 0 ? `${densTeor2.toLocaleString()} pl/Ha (Teórica)` : '<span style="color:var(--text-muted); font-weight:normal;">-</span>')}</strong>
          </div>
        </div>
      </div>
      ` : ''}

      <!-- Detalle Agronómico: Siembra 3 (Tercer Cultivo / Siembra Adicional) -->
      ${l.cultivo3 ? `
      <div style="background: rgba(245,158,11,0.06); border: 1px solid rgba(245,158,11,0.22); border-radius: 10px; padding: 10px; font-size: 0.8rem; margin-bottom: 8px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;">
          <strong style="color: #fbbf24;">🌾 ${escapeHtml(l.cultivo3)}</strong>
          <span style="font-size: 0.72rem; color: var(--text-muted);">${l.fechaSiembra3 ? 'Siembra: ' + escapeHtml(l.fechaSiembra3) : 'Sin fecha'}</span>
        </div>
        <div style="display: flex; flex-direction: column; gap: 3px; font-size: 0.76rem; color: #cbd5e1;">
          <div style="display: flex; justify-content: space-between;">
            <span style="color: var(--text-muted);">Árboles Sembrados:</span>
            <strong>${a3 > 0 ? a3.toLocaleString() + ' plantas' : '<span style="color:var(--text-muted); font-weight:normal;">Sin registrar</span>'}</strong>
          </div>
          ${pend3 > 0 ? `
          <div style="display: flex; justify-content: space-between;">
            <span style="color: #fde68a;">Árboles Pendientes:</span>
            <strong style="color: #fbbf24;">+${pend3.toLocaleString()} plantas</strong>
          </div>` : ''}
          <div style="display: flex; justify-content: space-between;">
            <span style="color: var(--text-muted);">Dist. Siembra:</span>
            <span>${(s3 > 0 && p3 > 0) ? `${s3}m × ${p3}m (${(s3 * p3).toFixed(2)} m²/pl)` : '<span style="color:var(--text-muted);">Sin registrar</span>'}</span>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <span style="color: var(--text-muted);">Densidad:</span>
            <strong style="color: #fbbf24;">${densReal3 > 0 ? `${densReal3.toLocaleString()} pl/Ha (Real)` : (densTeor3 > 0 ? `${densTeor3.toLocaleString()} pl/Ha (Teórica)` : '<span style="color:var(--text-muted); font-weight:normal;">-</span>')}</strong>
          </div>
        </div>
      </div>
      ` : ''}

      <div class="lote-active-products">
        <div class="lote-products-title">Insumos Registrados:</div>
        <div class="lote-products-list">
          ${prodNombres.length > 0 
            ? prodNombres.map(name => `<span class="product-tag">${escapeHtml(name)}</span>`).join("") 
            : '<span class="text-muted" style="font-size:0.75rem">Ninguno registrado</span>'}
        </div>
      </div>

      <div style="margin-top: 14px; padding-top: 12px; border-top: 1px solid rgba(255,255,255,0.08); display: flex; flex-direction: column; gap: 8px;">
        <button type="button" class="btn btn-secondary" onclick="verActividadesDeLote('${l.id}')" style="width: 100%; display: flex; align-items: center; justify-content: center; gap: 7px; font-weight: 600; font-size: 0.8rem; padding: 7px 10px; background: rgba(16,185,129,0.12); color: #34d399; border: 1px solid rgba(16,185,129,0.3); border-radius: 8px; cursor: pointer;" title="Ver todas las labores realizadas y futuras de este lote">
          <i data-lucide="calendar" style="width: 15px; height: 15px;"></i>
          <span>Ver Actividades (${actsTotalLote.length} tot: ${actsRealizadasLote} ✔, ${actsPendientesLote} ⏳)</span>
        </button>
        <div class="lote-actions" style="display: flex; justify-content: flex-end; gap: 8px;">
          <button class="btn-icon-only" onclick="editarLote('${l.id}')" title="Editar Lote"><i data-lucide="edit-2"></i></button>
          <button class="btn-icon-only text-danger" onclick="eliminarLote('${l.id}')" title="Eliminar Lote"><i data-lucide="trash-2"></i></button>
        </div>
      </div>
    `;
    grid.appendChild(card);
  });

  actualizarSelectorLoteRapido();
  if (window.lucide) lucide.createIcons();
}
// Actualización en tiempo real de cálculos en modal de lote
function actualizarCalculosModalLote() {
  const arboles1 = parseInt(document.getElementById("lote-form-arboles1")?.value) || 0;
  const pend1 = parseInt(document.getElementById("lote-form-pendientes1")?.value) || 0;
  const surco1 = parseFloat(document.getElementById("lote-form-surco1")?.value) || 0;
  const planta1 = parseFloat(document.getElementById("lote-form-planta1")?.value) || 0;

  const arboles2 = parseInt(document.getElementById("lote-form-arboles2")?.value) || 0;
  const pend2 = parseInt(document.getElementById("lote-form-pendientes2")?.value) || 0;
  const surco2 = parseFloat(document.getElementById("lote-form-surco2")?.value) || 0;
  const planta2 = parseFloat(document.getElementById("lote-form-planta2")?.value) || 0;

  const arboles3 = parseInt(document.getElementById("lote-form-arboles3")?.value) || 0;
  const pend3 = parseInt(document.getElementById("lote-form-pendientes3")?.value) || 0;
  const surco3 = parseFloat(document.getElementById("lote-form-surco3")?.value) || 0;
  const planta3 = parseFloat(document.getElementById("lote-form-planta3")?.value) || 0;

  const area = parseFloat(document.getElementById("lote-form-area")?.value) || 0;

  const inputPendientesGlobal = document.getElementById("lote-form-pendientes");
  const sumaPendientes = pend1 + pend2 + pend3;
  if (inputPendientesGlobal && sumaPendientes > 0 && !inputPendientesGlobal.value) {
    inputPendientesGlobal.value = sumaPendientes;
  }
  const pendientesGlobal = parseInt(inputPendientesGlobal?.value) || sumaPendientes;

  // Cultivo 1 preview
  const prev1 = document.getElementById("calc-preview-1");
  const prev1Mini = document.getElementById("calc-preview-1-mini");
  let densTeor1 = 0;
  if (surco1 > 0 && planta1 > 0) {
    densTeor1 = Math.round(10000 / (surco1 * planta1));
    const m2Planta = (surco1 * planta1).toFixed(2);
    const areaOcupada = arboles1 > 0 ? (arboles1 / densTeor1).toFixed(2) : null;
    if (prev1) {
      prev1.style.display = 'block';
      prev1.innerHTML = '<span>📐 Marco: <strong>' + m2Planta + ' m²/pl</strong> &bull; Densidad teórica: <strong>' + densTeor1.toLocaleString() + ' pl/Ha</strong>' + (areaOcupada ? ' &bull; Área necesaria: <strong>' + areaOcupada + ' Ha</strong>' : '') + '</span>';
    }
    if (prev1Mini) prev1Mini.textContent = densTeor1.toLocaleString() + ' pl/Ha teórica';
  } else {
    if (prev1) prev1.style.display = 'none';
    if (prev1Mini) prev1Mini.textContent = '';
  }

  // Cultivo 2 preview
  const prev2 = document.getElementById("calc-preview-2");
  const prev2Mini = document.getElementById("calc-preview-2-mini");
  let densTeor2 = 0;
  if (surco2 > 0 && planta2 > 0) {
    densTeor2 = Math.round(10000 / (surco2 * planta2));
    const m2Planta2 = (surco2 * planta2).toFixed(2);
    const areaOcupada2 = arboles2 > 0 ? (arboles2 / densTeor2).toFixed(2) : null;
    if (prev2) {
      prev2.style.display = 'block';
      prev2.innerHTML = '<span>📐 Marco: <strong>' + m2Planta2 + ' m²/pl</strong> &bull; Densidad teórica: <strong>' + densTeor2.toLocaleString() + ' pl/Ha</strong>' + (areaOcupada2 ? ' &bull; Área necesaria: <strong>' + areaOcupada2 + ' Ha</strong>' : '') + '</span>';
    }
    if (prev2Mini) prev2Mini.textContent = densTeor2.toLocaleString() + ' pl/Ha teórica';
  } else {
    if (prev2) prev2.style.display = 'none';
    if (prev2Mini) prev2Mini.textContent = '';
  }

  // Cultivo 3 preview
  const prev3 = document.getElementById("calc-preview-3");
  const prev3Mini = document.getElementById("calc-preview-3-mini");
  let densTeor3 = 0;
  if (surco3 > 0 && planta3 > 0) {
    densTeor3 = Math.round(10000 / (surco3 * planta3));
    const m2Planta3 = (surco3 * planta3).toFixed(2);
    const areaOcupada3 = arboles3 > 0 ? (arboles3 / densTeor3).toFixed(2) : null;
    if (prev3) {
      prev3.style.display = 'block';
      prev3.innerHTML = '<span>📐 Marco: <strong>' + m2Planta3 + ' m²/pl</strong> &bull; Densidad teórica: <strong>' + densTeor3.toLocaleString() + ' pl/Ha</strong>' + (areaOcupada3 ? ' &bull; Área necesaria: <strong>' + areaOcupada3 + ' Ha</strong>' : '') + '</span>';
    }
    if (prev3Mini) prev3Mini.textContent = densTeor3.toLocaleString() + ' pl/Ha teórica';
  } else {
    if (prev3) prev3.style.display = 'none';
    if (prev3Mini) prev3Mini.textContent = '';
  }

  // Resumen del Lote BI: Capacidad Instalada vs Teórica
  const summary = document.getElementById("lote-densidad-summary");
  if (summary) {
    const totalArbolesActuales = arboles1 + arboles2 + arboles3;
    const totalProyectado = totalArbolesActuales + pendientesGlobal;

    let densTeorDominante = densTeor1 > 0 ? densTeor1 : (densTeor2 > 0 ? densTeor2 : (densTeor3 > 0 ? densTeor3 : 0));
    let capacidadTeorica = (densTeorDominante > 0 && area > 0) ? Math.round(densTeorDominante * area) : 0;

    let pctInstalada = capacidadTeorica > 0 ? Math.min(100, Math.round((totalArbolesActuales / capacidadTeorica) * 100)) : 0;
    let pctProyectada = capacidadTeorica > 0 ? Math.min(100, Math.round((totalProyectado / capacidadTeorica) * 100)) : 0;
    let pctPendiente = Math.max(0, pctProyectada - pctInstalada);
    let espacioLibre = capacidadTeorica > totalProyectado ? (capacidadTeorica - totalProyectado) : 0;

    let summaryHtml = `
      <div style="background: rgba(0,0,0,0.35); border-radius: 10px; padding: 12px; border: 1px solid rgba(255,255,255,0.08);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; font-size: 0.82rem;">
          <span style="font-weight: 700; color: #fff;">Diagnóstico de Capacidad del Lote:</span>
          <span style="font-weight: 700; color: ${pctInstalada >= 80 ? '#10b981' : '#f59e0b'};">
            ${capacidadTeorica > 0 ? pctInstalada + '% Capacidad Instalada' : 'Parametriza distancias y área'}
          </span>
        </div>

        ${capacidadTeorica > 0 ? `
        <div class="lote-capacity-bar-container" style="height: 10px; margin: 8px 0;">
          <div class="lote-capacity-installed" style="width: ${pctInstalada}%;"></div>
          <div class="lote-capacity-pending" style="width: ${pctPendiente}%;"></div>
        </div>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 8px; margin-top: 10px; font-size: 0.76rem;">
          <div style="background: rgba(16,185,129,0.1); border: 1px solid rgba(16,185,129,0.25); border-radius: 8px; padding: 6px 10px;">
            <div style="color: var(--text-muted); font-size: 0.7rem;">Árboles Actuales</div>
            <strong style="color: #34d399; font-size: 0.9rem;">${totalArbolesActuales.toLocaleString()} arb.</strong>
            <div style="font-size: 0.68rem; color: #a7f3d0;">${pctInstalada}% de capacidad</div>
          </div>

          <div style="background: rgba(245,158,11,0.1); border: 1px solid rgba(245,158,11,0.25); border-radius: 8px; padding: 6px 10px;">
            <div style="color: var(--text-muted); font-size: 0.7rem;">Árboles Pendientes</div>
            <strong style="color: #fbbf24; font-size: 0.9rem;">+${pendientesGlobal.toLocaleString()} arb.</strong>
            <div style="font-size: 0.68rem; color: #fde68a;">${pctPendiente}% por sembrar</div>
          </div>

          <div style="background: rgba(59,130,246,0.1); border: 1px solid rgba(59,130,246,0.25); border-radius: 8px; padding: 6px 10px;">
            <div style="color: var(--text-muted); font-size: 0.7rem;">Capacidad Teórica Máx.</div>
            <strong style="color: #60a5fa; font-size: 0.9rem;">${capacidadTeorica.toLocaleString()} arb.</strong>
            <div style="font-size: 0.68rem; color: #93c5fd;">${area} Ha @ ${densTeorDominante} pl/Ha</div>
          </div>

          <div style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; padding: 6px 10px;">
            <div style="color: var(--text-muted); font-size: 0.7rem;">Espacio Disponible</div>
            <strong style="color: ${espacioLibre > 0 ? '#fff' : '#ef4444'}; font-size: 0.9rem;">${espacioLibre > 0 ? espacioLibre.toLocaleString() + ' arb.' : 'Lote Completo'}</strong>
            <div style="font-size: 0.68rem; color: var(--text-muted);">Proyectado: ${pctProyectada}%</div>
          </div>
        </div>
        ` : ''}
      </div>
    `;
    summary.innerHTML = summaryHtml;
  }
}

// Auto-cálculo de área a partir de árboles y distancias de siembra
function calcularAreaAutomatica() {
  const arboles1 = parseInt(document.getElementById("lote-form-arboles1")?.value) || 0;
  const surco1 = parseFloat(document.getElementById("lote-form-surco1")?.value) || 0;
  const planta1 = parseFloat(document.getElementById("lote-form-planta1")?.value) || 0;

  const arboles2 = parseInt(document.getElementById("lote-form-arboles2")?.value) || 0;
  const surco2 = parseFloat(document.getElementById("lote-form-surco2")?.value) || 0;
  const planta2 = parseFloat(document.getElementById("lote-form-planta2")?.value) || 0;

  const arboles3 = parseInt(document.getElementById("lote-form-arboles3")?.value) || 0;
  const surco3 = parseFloat(document.getElementById("lote-form-surco3")?.value) || 0;
  const planta3 = parseFloat(document.getElementById("lote-form-planta3")?.value) || 0;

  const pend1 = parseInt(document.getElementById("lote-form-pendientes1")?.value) || 0;
  const pend2 = parseInt(document.getElementById("lote-form-pendientes2")?.value) || 0;
  const pend3 = parseInt(document.getElementById("lote-form-pendientes3")?.value) || 0;

  let area1 = (surco1 > 0 && planta1 > 0) ? ((arboles1 + pend1) * surco1 * planta1) / 10000 : 0;
  let area2 = (surco2 > 0 && planta2 > 0) ? ((arboles2 + pend2) * surco2 * planta2) / 10000 : 0;
  let area3 = (surco3 > 0 && planta3 > 0) ? ((arboles3 + pend3) * surco3 * planta3) / 10000 : 0;

  let areaFinal = Math.max(area1, area2, area3);

  if (areaFinal > 0) {
    const areaRedondeada = (Math.round(areaFinal * 100) / 100).toFixed(2);
    document.getElementById("lote-form-area").value = areaRedondeada;
    actualizarCalculosModalLote();
    showToast("Área estimada calculada: " + areaRedondeada + " Ha");
  } else {
    alert("Para auto-calcular el área, ingresa el Nº de árboles y las distancias entre surcos y plantas.");
  }
}

// Estimación de árboles según área y distancia
function estimarArbolesSegunArea() {
  const area = parseFloat(document.getElementById("lote-form-area")?.value) || 0;
  const surco1 = parseFloat(document.getElementById("lote-form-surco1")?.value) || 0;
  const planta1 = parseFloat(document.getElementById("lote-form-planta1")?.value) || 0;
  const arboles1 = parseInt(document.getElementById("lote-form-arboles1")?.value) || 0;

  if (area > 0 && surco1 > 0 && planta1 > 0) {
    const densTeor = 10000 / (surco1 * planta1);
    const arbolesTeoricosTotales = Math.round(area * densTeor);
    
    if (arboles1 > 0 && arbolesTeoricosTotales > arboles1) {
      const faltantes = arbolesTeoricosTotales - arboles1;
      document.getElementById("lote-form-pendientes1").value = faltantes;
      document.getElementById("lote-form-pendientes").value = faltantes;
      showToast("Capacidad: " + arbolesTeoricosTotales.toLocaleString() + " árboles. Se estimaron " + faltantes.toLocaleString() + " árboles pendientes por sembrar.");
    } else {
      document.getElementById("lote-form-arboles1").value = arbolesTeoricosTotales;
      showToast("Estimados " + arbolesTeoricosTotales.toLocaleString() + " árboles teóricos (" + area + " Ha a " + surco1 + "m × " + planta1 + "m)");
    }
    actualizarCalculosModalLote();
  } else {
    alert("Para estimar árboles, ingresa el Área (Ha) y las distancias entre surcos y plantas de la Siembra 1.");
  }
}

function toggleSiembra3() {
  const sec = document.getElementById("sec-siembra-3");
  const lbl = document.getElementById("btn-toggle-siembra3-lbl");
  if (!sec) return;
  if (sec.style.display === "none" || !sec.style.display) {
    sec.style.display = "block";
    if (lbl) lbl.textContent = "Ocultar 3ª Siembra";
  } else {
    sec.style.display = "none";
    if (lbl) lbl.textContent = "+ Agregar 3ª Siembra / Policultivo";
  }
}

function abrirModalLote() {
  document.getElementById("lote-modal-title").textContent = "Nuevo Lote de Cultivo";
  document.getElementById("lote-form-id").value = "";
  document.getElementById("lote-form-nombre").value = "";
  document.getElementById("lote-form-cultivo").value = "";
  document.getElementById("lote-form-cultivo2").value = "";
  document.getElementById("lote-form-cultivo3").value = "";
  document.getElementById("lote-form-area").value = "";
  document.getElementById("lote-form-etapa").value = "Siembra";
  document.getElementById("lote-form-fecha").value = HOY;
  document.getElementById("lote-form-fecha2").value = "";
  document.getElementById("lote-form-fecha3").value = "";

  document.getElementById("lote-form-arboles1").value = "";
  document.getElementById("lote-form-pendientes1").value = "";
  document.getElementById("lote-form-surco1").value = "";
  document.getElementById("lote-form-planta1").value = "";

  document.getElementById("lote-form-arboles2").value = "";
  document.getElementById("lote-form-pendientes2").value = "";
  document.getElementById("lote-form-surco2").value = "";
  document.getElementById("lote-form-planta2").value = "";

  document.getElementById("lote-form-arboles3").value = "";
  document.getElementById("lote-form-pendientes3").value = "";
  document.getElementById("lote-form-surco3").value = "";
  document.getElementById("lote-form-planta3").value = "";

  document.getElementById("lote-form-pendientes").value = "";

  const sec3 = document.getElementById("sec-siembra-3");
  if (sec3) sec3.style.display = "none";
  const lbl3 = document.getElementById("btn-toggle-siembra3-lbl");
  if (lbl3) lbl3.textContent = "+ Agregar 3ª Siembra / Policultivo";

  actualizarCalculosModalLote();
  document.getElementById("lote-modal").classList.add("active");
  if (window.lucide) lucide.createIcons();
}

function editarLote(id) {
  const lote = STATE.lotes.find(l => l.id === id);
  if (!lote) return;

  document.getElementById("lote-modal-title").textContent = "Editar Lote de Cultivo";
  document.getElementById("lote-form-id").value = lote.id;
  document.getElementById("lote-form-nombre").value = lote.nombre;
  document.getElementById("lote-form-cultivo").value = lote.cultivo;
  document.getElementById("lote-form-cultivo2").value = lote.cultivo2 || "";
  document.getElementById("lote-form-cultivo3").value = lote.cultivo3 || "";
  document.getElementById("lote-form-area").value = lote.area;
  document.getElementById("lote-form-etapa").value = lote.etapa;
  document.getElementById("lote-form-fecha").value = lote.fechaSiembra || "";
  document.getElementById("lote-form-fecha2").value = lote.fechaSiembra2 || "";
  document.getElementById("lote-form-fecha3").value = lote.fechaSiembra3 || "";

  document.getElementById("lote-form-arboles1").value = lote.arboles1 || "";
  document.getElementById("lote-form-pendientes1").value = lote.arbolesPendientes1 || "";
  document.getElementById("lote-form-surco1").value = lote.distanciaSurco1 || "";
  document.getElementById("lote-form-planta1").value = lote.distanciaPlanta1 || "";

  document.getElementById("lote-form-arboles2").value = lote.arboles2 || "";
  document.getElementById("lote-form-pendientes2").value = lote.arbolesPendientes2 || "";
  document.getElementById("lote-form-surco2").value = lote.distanciaSurco2 || "";
  document.getElementById("lote-form-planta2").value = lote.distanciaPlanta2 || "";

  document.getElementById("lote-form-arboles3").value = lote.arboles3 || "";
  document.getElementById("lote-form-pendientes3").value = lote.arbolesPendientes3 || "";
  document.getElementById("lote-form-surco3").value = lote.distanciaSurco3 || "";
  document.getElementById("lote-form-planta3").value = lote.distanciaPlanta3 || "";

  document.getElementById("lote-form-pendientes").value = lote.arbolesPendientes || "";

  const sec3 = document.getElementById("sec-siembra-3");
  const lbl3 = document.getElementById("btn-toggle-siembra3-lbl");
  if (lote.cultivo3 || Number(lote.arboles3) > 0) {
    if (sec3) sec3.style.display = "block";
    if (lbl3) lbl3.textContent = "Ocultar 3ª Siembra";
  } else {
    if (sec3) sec3.style.display = "none";
    if (lbl3) lbl3.textContent = "+ Agregar 3ª Siembra / Policultivo";
  }

  actualizarCalculosModalLote();
  document.getElementById("lote-modal").classList.add("active");
  if (window.lucide) lucide.createIcons();
}

async function eliminarLote(id) {
  if (confirm("¿Estás seguro de eliminar este lote? Esto desasociará sus actividades de la vista general.")) {
    try {
      const response = await fetch('/api/lotes/' + id, { method: 'DELETE' });
      if (!response.ok) throw new Error("Error al eliminar lote");
      showToast("Lote y datos asociados eliminados.");
      await saveState();
    } catch (err) {
      console.error(err);
      alert("Error al eliminar el lote.");
    }
  }
}

/* ==========================================================================
   AGENDA DE ACTIVIDADES & DOSIFICACIÓN INTELIGENTE
   ========================================================================== */

/* ==========================================================================
   GESTIÓN DINÁMICA DE AGENDA: VISTAS (TARJETAS / TABLA) & AGENDADO EXPRÉS
   ========================================================================== */
/* ==========================================================================
   GESTIÓN DINÁMICA DE AGENDA: RESUMEN EJECUTIVO, GRÁFICOS, TARJETAS, TABLA & DETALLE
   ========================================================================== */
let currentAgendaView = 'summary'; // Por defecto inicia en la vista ejecutiva resumida
let chartAgendaLotes = null;
let chartAgendaTipos = null;
let actividadSeleccionadaId = null;

function switchAgendaView(mode) {
  currentAgendaView = mode;
  const summaryView = document.getElementById("agenda-summary-view");
  const cardsContainer = document.getElementById("agenda-cards-container");
  const tableWrapper = document.getElementById("agenda-table-wrapper");
  const btnSummary = document.getElementById("btn-view-summary");
  const btnCards = document.getElementById("btn-view-cards");
  const btnTable = document.getElementById("btn-view-table");

  if (summaryView) summaryView.style.display = (mode === 'summary') ? 'block' : 'none';
  if (cardsContainer) cardsContainer.style.display = (mode === 'cards') ? 'grid' : 'none';
  if (tableWrapper) tableWrapper.style.display = (mode === 'table') ? 'block' : 'none';

  [btnSummary, btnCards, btnTable].forEach(btn => {
    if (btn) {
      btn.style.background = 'transparent';
      btn.style.color = 'var(--text-muted)';
    }
  });

  if (mode === 'summary' && btnSummary) {
    btnSummary.style.background = 'rgba(16, 185, 129, 0.2)';
    btnSummary.style.color = '#34d399';
  } else if (mode === 'cards' && btnCards) {
    btnCards.style.background = 'rgba(16, 185, 129, 0.2)';
    btnCards.style.color = '#34d399';
  } else if (mode === 'table' && btnTable) {
    btnTable.style.background = 'rgba(16, 185, 129, 0.2)';
    btnTable.style.color = '#34d399';
  }

  if (window.lucide) lucide.createIcons();
}

// Renderizado del Resumen Ejecutivo, KPIs y Gráficos
function renderAgendaSummary(filtradas) {
  const total = filtradas.length;
  const cumplidas = filtradas.filter(a => a.cumplida).length;
  const pendientes = filtradas.filter(a => !a.cumplida).length;
  const atrasadas = filtradas.filter(a => !a.cumplida && a.fecha < HOY).length;
  const pctAvance = total > 0 ? Math.round((cumplidas / total) * 100) : 0;

  // Métodos de aplicación (Suelo/Piso vs Foliar)
  let sueloCount = 0;
  let foliarCount = 0;
  let insumosTotalVol = 0;
  const productosSet = new Set();

  filtradas.forEach(a => {
    const met = (a.metodo || "").toLowerCase();
    const tip = (a.tipo || "").toLowerCase();
    if (met.includes("suelo") || met.includes("piso") || tip.includes("suelo") || tip.includes("piso")) {
      sueloCount++;
    } else if (met.includes("foliar") || tip.includes("foliar")) {
      foliarCount++;
    }

    if (a.productoNombre) {
      productosSet.add(a.productoNombre);
    }
    if (a.cantidad > 0) {
      insumosTotalVol += parseFloat(a.cantidad) || 0;
    }
  });

  // Actualizar Tarjetas KPI del Resumen
  const kpiTot = document.getElementById("summary-kpi-total");
  const kpiAvance = document.getElementById("summary-kpi-avance");
  const kpiStatus = document.getElementById("summary-kpi-status");
  const kpiAtrasadas = document.getElementById("summary-kpi-atrasadas");
  const kpiMetodo = document.getElementById("summary-kpi-metodo");
  const kpiInsumos = document.getElementById("summary-kpi-insumos");
  const kpiProdsCount = document.getElementById("summary-kpi-prods-count");

  if (kpiTot) kpiTot.textContent = total;
  if (kpiAvance) kpiAvance.textContent = `${pctAvance}% Cumplimiento`;
  if (kpiStatus) kpiStatus.innerHTML = `<span style="color:#34d399;">${cumplidas} ✔</span> <span style="color:var(--text-muted);">|</span> <span style="color:#fbbf24;">${pendientes} ⏳</span>`;
  if (kpiAtrasadas) kpiAtrasadas.textContent = atrasadas > 0 ? `${atrasadas} Atrasadas ⚠️` : '0 Atrasadas';
  if (kpiMetodo) kpiMetodo.textContent = `${sueloCount} Suelo | ${foliarCount} Foliar`;
  if (kpiInsumos) kpiInsumos.textContent = `${insumosTotalVol.toLocaleString()} Kg/L`;
  if (kpiProdsCount) kpiProdsCount.textContent = `${productosSet.size} insumos diferentes`;

  // 1. Gráfico de Labores por Lote (Cumplidas vs Pendientes)
  const lotesMap = {};
  filtradas.forEach(a => {
    const lote = STATE.lotes.find(l => l.id === a.loteId);
    const nombre = lote ? lote.nombre : "Sin Lote";
    if (!lotesMap[nombre]) lotesMap[nombre] = { cumplidas: 0, pendientes: 0, atrasadas: 0 };
    if (a.cumplida) {
      lotesMap[nombre].cumplidas++;
    } else if (a.fecha < HOY) {
      lotesMap[nombre].atrasadas++;
    } else {
      lotesMap[nombre].pendientes++;
    }
  });

  const lotesLabels = Object.keys(lotesMap);
  const dataCumplidas = lotesLabels.map(l => lotesMap[l].cumplidas);
  const dataPendientes = lotesLabels.map(l => lotesMap[l].pendientes);
  const dataAtrasadas = lotesLabels.map(l => lotesMap[l].atrasadas);

  const canvasLotes = document.getElementById("chartAgendaLotes");
  if (canvasLotes) {
    if (chartAgendaLotes) chartAgendaLotes.destroy();
    const ctx = canvasLotes.getContext("2d");
    chartAgendaLotes = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: lotesLabels.length > 0 ? lotesLabels : ["Sin labores"],
        datasets: [
          { label: 'Cumplidas', data: dataCumplidas.length > 0 ? dataCumplidas : [0], backgroundColor: '#10b981', borderRadius: 4 },
          { label: 'Pendientes', data: dataPendientes.length > 0 ? dataPendientes : [0], backgroundColor: '#f59e0b', borderRadius: 4 },
          { label: 'Atrasadas', data: dataAtrasadas.length > 0 ? dataAtrasadas : [0], backgroundColor: '#ef4444', borderRadius: 4 }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'top', labels: { boxWidth: 10, color: '#9ca3af', font: { size: 10 } } }
        },
        scales: {
          x: { stacked: true, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#9ca3af', font: { size: 10 } } },
          y: { stacked: true, beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { precision: 0, color: '#9ca3af', font: { size: 10 } } }
        }
      }
    });
  }

  // 2. Gráfico de Distribución por Tipo de Labor
  const tiposMap = {};
  filtradas.forEach(a => {
    const tip = a.tipo || "General";
    tiposMap[tip] = (tiposMap[tip] || 0) + 1;
  });
  const tiposLabels = Object.keys(tiposMap);
  const tiposData = tiposLabels.map(t => tiposMap[t]);

  const canvasTipos = document.getElementById("chartAgendaTipos");
  if (canvasTipos) {
    if (chartAgendaTipos) chartAgendaTipos.destroy();
    const ctxTipos = canvasTipos.getContext("2d");
    chartAgendaTipos = new Chart(ctxTipos, {
      type: 'doughnut',
      data: {
        labels: tiposLabels.length > 0 ? tiposLabels : ["Sin actividades"],
        datasets: [{
          data: tiposData.length > 0 ? tiposData : [1],
          backgroundColor: tiposLabels.length > 0
            ? ['#10b981', '#3b82f6', '#f59e0b', '#ec4899', '#8b5cf6', '#14b8a6', '#f97316']
            : ['rgba(255,255,255,0.05)'],
          borderWidth: 1,
          borderColor: 'rgba(9, 17, 12, 0.8)'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'right', labels: { boxWidth: 10, color: '#9ca3af', font: { size: 10 } } }
        }
      }
    });
  }

  // 3. Tabla Resumen Compacta (1 fila por labor con clic para abrir detalle)
  const tbodySummary = document.getElementById("agenda-summary-tbody");
  if (tbodySummary) {
    tbodySummary.innerHTML = "";
    if (filtradas.length === 0) {
      tbodySummary.innerHTML = '<tr><td colspan="9" style="text-align:center; padding:30px; color:var(--text-muted);"><i data-lucide="calendar-x" style="width:28px; height:28px; margin-bottom:8px; opacity:0.6;"></i><br>No hay labores para el filtro seleccionado.</td></tr>';
    } else {
      filtradas.forEach(a => {
        const lote = STATE.lotes.find(l => l.id === a.loteId);
        const loteNombre = lote ? lote.nombre : "Lote";
        const esAtrasada = !a.cumplida && a.fecha < HOY;

        let badgeClass = "badge-pendiente";
        let badgeText = "Pendiente";
        if (a.cumplida) {
          badgeClass = "badge-cumplida";
          badgeText = "Cumplida";
        } else if (esAtrasada) {
          badgeClass = "badge-atrasada";
          badgeText = "Atrasada";
        }

        const met = (a.metodo || "").toLowerCase();
        const tip = (a.tipo || "").toLowerCase();
        let metodoBadge = '<span class="badge-metodo badge-general">General</span>';
        if (met.includes("suelo") || met.includes("piso") || tip.includes("suelo") || tip.includes("piso")) {
          metodoBadge = '<span class="badge-metodo badge-suelo">🌱 Suelo / Piso</span>';
        } else if (met.includes("foliar") || tip.includes("foliar")) {
          metodoBadge = '<span class="badge-metodo badge-foliar">🌿 Foliar</span>';
        }

        const tr = document.createElement("tr");
        tr.className = "summary-row";
        tr.title = "Haz clic para ver la Ficha Técnica con detalle completo";
        tr.onclick = () => abrirDetalleActividad(a.id);

        tr.innerHTML = `
          <td><span class="badge ${badgeClass}">${badgeText}</span></td>
          <td>
            <div style="font-weight:700; color:#fff;">${escapeHtml(loteNombre)}</div>
            <div style="font-size:0.75rem; color:var(--text-muted);">${escapeHtml(a.cultivoObjetivo || 'General')}</div>
          </td>
          <td>
            <strong style="color:#e2e8f0;">${escapeHtml(a.tipo)}</strong>
          </td>
          <td>${metodoBadge}</td>
          <td>
            ${a.productoNombre ? `<span style="color:#34d399; font-weight:600;">${escapeHtml(a.productoNombre)}</span>` : '<span style="color:var(--text-muted);">-</span>'}
          </td>
          <td>
            ${a.cantidad > 0 ? `<span style="color:#fbbf24; font-weight:700;">${a.cantidad} ${escapeHtml(a.unidad || 'Kg')}</span>` : '<span style="color:var(--text-muted);">-</span>'}
          </td>
          <td>
            <span style="${esAtrasada ? 'color:var(--danger); font-weight:700;' : ''}">${a.fecha}</span>
          </td>
          <td>
            <span style="color:var(--text-muted);">${escapeHtml(a.personal || 'Sin asignar')}</span>
          </td>
          <td style="text-align: right;">
            <button type="button" class="btn btn-secondary btn-sm" onclick="event.stopPropagation(); abrirDetalleActividad('${a.id}')" style="padding:4px 8px; font-size:0.75rem; border-color:rgba(16,185,129,0.3); color:#34d399;">
              <i data-lucide="eye" style="width:13px; height:13px;"></i> Detalle
            </button>
          </td>
        `;
        tbodySummary.appendChild(tr);
      });
    }
  }
}

// Abrir Ficha Técnica Detallada de la Labor
function abrirDetalleActividad(actId) {
  const act = STATE.actividades.find(a => a.id === actId);
  if (!act) return;

  actividadSeleccionadaId = actId;
  const modal = document.getElementById("act-detail-modal");
  if (!modal) return;

  const lote = STATE.lotes.find(l => l.id === act.loteId);
  const loteNombre = lote ? lote.nombre : "Lote";
  const esAtrasada = !act.cumplida && act.fecha < HOY;

  // Llenar campos del modal
  document.getElementById("detail-act-tipo").textContent = act.tipo || "Labor Agrícola";
  
  const bEstado = document.getElementById("detail-badge-estado");
  if (bEstado) {
    bEstado.className = "badge " + (act.cumplida ? "badge-cumplida" : (esAtrasada ? "badge-atrasada" : "badge-pendiente"));
    bEstado.textContent = act.cumplida ? "✔ Cumplida / Ejecutada" : (esAtrasada ? "⚠️ Atrasada (Vencida)" : "⏳ Pendiente por Realizar");
  }

  const bLote = document.getElementById("detail-badge-lote");
  if (bLote) bLote.textContent = `📍 Lote: ${loteNombre}`;

  const bCultivo = document.getElementById("detail-badge-cultivo");
  if (bCultivo) bCultivo.textContent = `🌱 Cultivo: ${act.cultivoObjetivo || 'General'}`;

  // Insumos y Suelo/Piso
  const met = (act.metodo || "").toLowerCase();
  const tip = (act.tipo || "").toLowerCase();
  let metodoTexto = "Aplicación Foliar";
  if (met.includes("suelo") || met.includes("piso") || tip.includes("suelo") || tip.includes("piso")) {
    metodoTexto = "🌱 Suelo / Piso (Al Piso)";
  } else if (met.includes("foliar") || tip.includes("foliar")) {
    metodoTexto = "🌿 Aplicación Foliar (Hojas)";
  } else if (act.metodo) {
    metodoTexto = act.metodo;
  }

  document.getElementById("detail-act-metodo").textContent = metodoTexto;
  document.getElementById("detail-act-producto").textContent = act.productoNombre || "Sin insumo químico / fertilizante";
  document.getElementById("detail-act-dosis").textContent = act.dosificacion || "Sin dosificación especificada";
  document.getElementById("detail-act-cantidad").textContent = act.cantidad > 0 ? `${act.cantidad} ${act.unidad || 'Kg'}` : "Sin volumen registrado";

  document.getElementById("detail-act-fecha").textContent = act.fecha || "Sin fecha";
  document.getElementById("detail-act-personal").textContent = act.personal || "Sin operario asignado";
  document.getElementById("detail-act-etapa").textContent = act.etapa || "General";
  document.getElementById("detail-act-notas").textContent = act.notas || "Sin observaciones ni notas de campo registradas.";

  // Botón de alternar estado
  const btnToggle = document.getElementById("detail-btn-toggle");
  if (btnToggle) {
    btnToggle.innerHTML = act.cumplida 
      ? '<i data-lucide="rotate-ccw"></i> <span>Reabrir / Marcar Pendiente</span>'
      : '<i data-lucide="check-circle-2"></i> <span>Marcar como Cumplida en 1 Clic</span>';
    btnToggle.className = act.cumplida ? "btn btn-secondary" : "btn btn-primary";
  }

  modal.classList.add("active");
  if (window.lucide) lucide.createIcons();
}

function cerrarDetalleActividad() {
  const modal = document.getElementById("act-detail-modal");
  if (modal) modal.classList.remove("active");
  actividadSeleccionadaId = null;
}

// Alternar estado directamente desde el modal de detalle
async function toggleStatusDesdeDetalle() {
  if (!actividadSeleccionadaId) return;
  await toggleActivityStatus(actividadSeleccionadaId);
  abrirDetalleActividad(actividadSeleccionadaId);
}

// Editar labor directamente desde el modal de detalle
function editarDesdeDetalle() {
  const id = actividadSeleccionadaId;
  cerrarDetalleActividad();
  if (id) editarActividad(id);
}

function selectQuickLabor(labor, cultivo, etapa) {
  const inpTipo = document.getElementById("quick-act-tipo");
  if (inpTipo) inpTipo.value = labor;
  const loteSel = document.getElementById("quick-act-lote");
  if (loteSel && !loteSel.value && loteSel.options.length > 0) {
    loteSel.selectedIndex = 0;
  }
  showToast('Labor rápida "' + labor + '" seleccionada.');
}

function fillModalLabor(labor, cultivo, etapa) {
  const tipoInp = document.getElementById("act-form-tipo");
  if (tipoInp) tipoInp.value = labor;
  if (etapa) {
    const etapaSel = document.getElementById("act-form-etapa");
    if (etapaSel) etapaSel.value = etapa;
  }
  showToast('Labor "' + labor + '" autocompletada.');
}

function actualizarSelectorLoteRapido() {
  const sel = document.getElementById("quick-act-lote");
  if (!sel) return;
  const curr = sel.value;
  sel.innerHTML = '<option value="" disabled ' + (!curr ? 'selected' : '') + '>-- Selecciona un Lote --</option>';
  STATE.lotes.forEach(l => {
    const totalArb = (Number(l.arboles1 || 0) + Number(l.arboles2 || 0) + Number(l.arboles3 || 0));
    const arbText = totalArb > 0 ? ' (' + totalArb.toLocaleString() + ' arb.)' : '';
    sel.innerHTML += '<option value="' + l.id + '">' + escapeHtml(l.nombre) + ' [' + escapeHtml(l.cultivo) + (l.cultivo2 ? ' + ' + escapeHtml(l.cultivo2) : '') + '] - ' + l.area + ' Ha' + arbText + '</option>';
  });
  if (curr && STATE.lotes.some(l => l.id === curr)) {
    sel.value = curr;
  } else if (STATE.lotes.length > 0) {
    sel.value = STATE.lotes[0].id;
  }
}

function duplicarActividad(id) {
  const act = STATE.actividades.find(a => a.id === id);
  if (!act) return;

  document.getElementById("act-modal-title").textContent = "Duplicar Actividad / Programar Siguiente";
  document.getElementById("act-form-id").value = "";
  document.getElementById("act-form-lote").value = act.loteId;
  actualizarSelectoresActividad();
  document.getElementById("act-form-cultivo-objetivo").value = act.cultivoObjetivo || "";
  document.getElementById("act-form-tipo").value = act.tipo;
  document.getElementById("act-form-producto").value = act.productoNombre || "";
  document.getElementById("act-form-fecha").value = HOY;
  document.getElementById("act-form-personal").value = act.personal;
  document.getElementById("act-form-etapa").value = act.etapa;
  document.getElementById("act-form-dosificacion").value = act.dosificacion || "";
  document.getElementById("act-form-metodo").value = act.metodo || "Foliar";
  document.getElementById("act-form-cantidad").value = act.cantidad || "";
  document.getElementById("act-form-unidad").value = act.unidad || "Kg";
  document.getElementById("act-form-notas").value = act.notas || "";

  const rNo = document.getElementById("act-form-cumplida-no");
  if (rNo) rNo.checked = true;

  const actModal = document.getElementById("act-modal");
  actModal.classList.add("active");
  actModal.scrollTop = 0;
  const modalBody = actModal.querySelector(".modal-body-scroll");
  if (modalBody) modalBody.scrollTop = 0;
  if (window.lucide) lucide.createIcons();
  showToast("📋 Datos copiados. Ajusta la fecha u operario y guarda con 1 clic.");
}

// Navegación directa a Agenda filtrada por Lote específico
function verActividadesDeLote(loteId) {
  // Navegar a sección de Agenda
  const navItem = document.querySelector('.nav-item[data-section="agenda"]');
  if (navItem) navItem.click();

  // Establecer filtro de lote
  const filterLoteSel = document.getElementById("filter-lote");
  if (filterLoteSel) filterLoteSel.value = loteId;

  // Limpiar filtros temporales para mostrar todo el historial (realizadas y futuras)
  const fAnio = document.getElementById("filter-anio");
  if (fAnio) fAnio.value = "";
  const fMes = document.getElementById("filter-mes");
  if (fMes) fMes.value = "";
  const fDesde = document.getElementById("filter-fecha-desde");
  if (fDesde) fDesde.value = "";
  const fHasta = document.getElementById("filter-fecha-hasta");
  if (fHasta) fHasta.value = "";
  const fSearch = document.getElementById("search-activity");
  if (fSearch) fSearch.value = "";

  // Activar modo 'todas' para ver simultáneamente realizadas y futuras
  setAgendaFilterMode('todas');
  switchAgendaView('summary');

  const lote = STATE.lotes.find(l => l.id === loteId);
  const nombreLote = lote ? lote.nombre : "Lote";
  showToast(`📅 Mostrando todas las actividades del Lote ${nombreLote} (Realizadas y Futuras)`);

  setTimeout(() => {
    const target = document.getElementById("agenda-cards-container") || document.getElementById("agenda-section");
    if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 120);
}

// Restablecer todos los filtros de la Agenda
function resetearTodosFiltrosAgenda() {
  const fLote = document.getElementById('filter-lote');
  if (fLote) fLote.value = '';
  const fSearch = document.getElementById('search-activity');
  if (fSearch) fSearch.value = '';
  const fAnio = document.getElementById('filter-anio');
  if (fAnio) fAnio.value = '';
  const fMes = document.getElementById('filter-mes');
  if (fMes) fMes.value = '';
  const fDesde = document.getElementById('filter-fecha-desde');
  if (fDesde) fDesde.value = '';
  const fHasta = document.getElementById('filter-fecha-hasta');
  if (fHasta) fHasta.value = '';

  setAgendaFilterMode('todas');
}

// Poblar dinámicamente los selectores de Lotes y Años según los datos
function poblarSelectoresFiltro() {
  const filterLoteSel = document.getElementById("filter-lote");
  if (filterLoteSel) {
    const actVal = filterLoteSel.value;
    filterLoteSel.innerHTML = '<option value="">🌾 Todos los Lotes</option>';
    STATE.lotes.forEach(l => {
      const actsLote = STATE.actividades.filter(a => a.loteId === l.id);
      const r = actsLote.filter(a => a.cumplida).length;
      const p = actsLote.filter(a => !a.cumplida).length;
      filterLoteSel.innerHTML += `<option value="${l.id}">${escapeHtml(l.nombre)} (${actsLote.length} tot: ${r} ✔, ${p} ⏳)</option>`;
    });
    filterLoteSel.value = actVal;
  }

  const filterAnioSel = document.getElementById("filter-anio");
  if (filterAnioSel) {
    const actAnio = filterAnioSel.value;
    const aniosSet = new Set();
    const anioActual = new Date().getFullYear();
    aniosSet.add(anioActual);
    aniosSet.add(2026);
    STATE.actividades.forEach(a => {
      if (a.fecha && a.fecha.length >= 4) {
        const y = parseInt(a.fecha.substring(0, 4));
        if (!isNaN(y)) aniosSet.add(y);
      }
    });
    const aniosOrd = Array.from(aniosSet).sort((a, b) => b - a);
    filterAnioSel.innerHTML = '<option value="">📅 Todos los Años</option>';
    aniosOrd.forEach(yr => {
      filterAnioSel.innerHTML += `<option value="${yr}">${yr}</option>`;
    });
    filterAnioSel.value = actAnio;
  }
}

// Modo de filtrado rápido por pestañas superiores
function setAgendaFilterMode(mode) {
  const sel = document.getElementById("filter-cumplida");
  if (sel) sel.value = mode;

  // Actualizar estilos visuales de las 4 pestañas superiores
  const tabAll = document.getElementById("tab-agenda-all");
  const tabPending = document.getElementById("tab-agenda-pending");
  const tabCompleted = document.getElementById("tab-agenda-completed");
  const tabFresh = document.getElementById("tab-agenda-fresh");

  [tabAll, tabPending, tabCompleted, tabFresh].forEach(tab => {
    if (tab) {
      tab.style.background = "transparent";
      tab.style.color = "var(--text-muted)";
      tab.style.borderColor = "rgba(255,255,255,0.1)";
    }
  });

  if (mode === "todas" && tabAll) {
    tabAll.style.background = "rgba(16,185,129,0.2)";
    tabAll.style.color = "#34d399";
    tabAll.style.borderColor = "#10b981";
  } else if ((mode === "pendientes" || mode === "atrasadas") && tabPending) {
    tabPending.style.background = "rgba(245,158,11,0.2)";
    tabPending.style.color = "#fbbf24";
    tabPending.style.borderColor = "#f59e0b";
  } else if (mode === "completadas" && tabCompleted) {
    tabCompleted.style.background = "rgba(16,185,129,0.15)";
    tabCompleted.style.color = "#6ee7b7";
    tabCompleted.style.borderColor = "rgba(16,185,129,0.4)";
  } else if (mode === "fresco" && tabFresh) {
    tabFresh.style.background = "rgba(59,130,246,0.18)";
    tabFresh.style.color = "#60a5fa";
    tabFresh.style.borderColor = "rgba(59,130,246,0.4)";
  }

  applyFilters();
}

function renderAgendaTable() {
  const tbody = document.getElementById("agenda-table-body");
  const cardsContainer = document.getElementById("agenda-cards-container");
  if (tbody) tbody.innerHTML = "";
  if (cardsContainer) cardsContainer.innerHTML = "";

  const filterLote = document.getElementById("filter-lote")?.value || "";
  const filterCumplida = document.getElementById("filter-cumplida")?.value || "todas";
  const filterAnio = document.getElementById("filter-anio")?.value || "";
  const filterMes = document.getElementById("filter-mes")?.value || "";
  const filterFechaDesde = document.getElementById("filter-fecha-desde")?.value || "";
  const filterFechaHasta = document.getElementById("filter-fecha-hasta")?.value || "";
  const searchQuery = (document.getElementById("search-activity")?.value || "").toLowerCase();

  // Fechas clave para vista fresca
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const primerDiaMesVigente = new Date(year, month, 1).toISOString().split('T')[0];
  const ultimoDiaProximoMes = new Date(year, month + 2, 0).toISOString().split('T')[0];
  const limiteReciente30d = obtenerFechaDiasAtras(30);

  const filtradas = STATE.actividades.filter(a => {
    const loteObj = STATE.lotes.find(l => l.id === a.loteId);
    const loteNombre = loteObj ? loteObj.nombre.toLowerCase() : "";
    const notesText = a.notas ? a.notas.toLowerCase() : "";
    const tipoText = (a.tipo || "").toLowerCase();
    const personalText = (a.personal || "").toLowerCase();
    const prodText = (a.productoNombre || "").toLowerCase();
    const cultivoText = (a.cultivoObjetivo || "").toLowerCase();

    // 1. Filtro por Lote
    if (filterLote && a.loteId !== filterLote) return false;

    // 2. Filtro por Estado (Cumplida / Pendiente / Atrasada / Fresco)
    const esCumplida = !!a.cumplida;
    const esAtrasada = !esCumplida && a.fecha < HOY;
    const esPendiente = !esCumplida;

    if (filterCumplida === "fresco") {
      const esRecienteOCorriente = (a.fecha >= primerDiaMesVigente && a.fecha <= ultimoDiaProximoMes) || (a.fecha >= limiteReciente30d);
      if (esCumplida && !esRecienteOCorriente) {
        return false;
      }
    } else if (filterCumplida === "pendientes") {
      if (!esPendiente) return false;
    } else if (filterCumplida === "atrasadas") {
      if (!esAtrasada) return false;
    } else if (filterCumplida === "completadas") {
      if (!esCumplida) return false;
    }
    // 'todas': incluye tanto cumplidas (realizadas) como pendientes (futuras)

    // 3. Filtro por Año
    if (filterAnio) {
      const anioAct = (a.fecha || "").substring(0, 4);
      if (anioAct !== filterAnio) return false;
    }

    // 4. Filtro por Mes (formato '01', '02', ...)
    if (filterMes) {
      const mesAct = (a.fecha || "").substring(5, 7);
      if (mesAct !== filterMes) return false;
    }

    // 5. Filtro por Rango de Fechas (Desde / Hasta)
    if (filterFechaDesde && a.fecha < filterFechaDesde) return false;
    if (filterFechaHasta && a.fecha > filterFechaHasta) return false;

    // 6. Búsqueda por texto libre
    if (searchQuery) {
      const match = loteNombre.includes(searchQuery) ||
                    prodText.includes(searchQuery) ||
                    tipoText.includes(searchQuery) ||
                    personalText.includes(searchQuery) ||
                    cultivoText.includes(searchQuery) ||
                    notesText.includes(searchQuery);
      if (!match) return false;
    }

    return true;
  });

  renderAgendaSummary(filtradas);

  // Actualizar badge de conteo e información detallada
  const countBadge = document.getElementById("agenda-count-badge");
  if (countBadge) {
    const cumplidasCount = filtradas.filter(a => a.cumplida).length;
    const pendientesCount = filtradas.filter(a => !a.cumplida).length;

    let loteInfo = "";
    if (filterLote) {
      const lObj = STATE.lotes.find(l => l.id === filterLote);
      loteInfo = lObj ? `📍 ${lObj.nombre} • ` : "";
    }

    let tiempoInfo = "";
    const mesesNombres = ["", "Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
    if (filterAnio && filterMes) {
      tiempoInfo = ` • ${mesesNombres[parseInt(filterMes)] || filterMes} ${filterAnio}`;
    } else if (filterAnio) {
      tiempoInfo = ` • Año ${filterAnio}`;
    } else if (filterMes) {
      tiempoInfo = ` • Mes ${mesesNombres[parseInt(filterMes)] || filterMes}`;
    } else if (filterFechaDesde || filterFechaHasta) {
      tiempoInfo = ` • ${filterFechaDesde || '...'} a ${filterFechaHasta || '...'}`;
    }

    countBadge.innerHTML = `${loteInfo}<strong>${filtradas.length}</strong> labores (<span style="color:#34d399">${cumplidasCount} Realizadas ✔</span> | <span style="color:#fbbf24">${pendientesCount} Futuras ⏳</span>)${tiempoInfo}`;
  }

  // Ordenamiento operativo prioritario:
  // 1. Tareas pendientes / futuras (lo que hay por hacer primero por fecha)
  // 2. Tareas cumplidas / realizadas (lo más recientemente ejecutado arriba)
  filtradas.sort((a, b) => {
    if (a.cumplida !== b.cumplida) {
      return a.cumplida ? 1 : -1;
    }
    if (!a.cumplida) {
      return a.fecha.localeCompare(b.fecha);
    } else {
      return b.fecha.localeCompare(a.fecha);
    }
  });

  if (filtradas.length === 0) {
    const emptyMsg = `
      <div class="empty-state" style="padding:40px 20px; text-align:center;">
        <i data-lucide="calendar-x" style="width:40px; height:40px; color:var(--text-muted); margin-bottom:12px;"></i>
        <h4 style="color:#cbd5e1; margin-bottom:6px;">No se encontraron labores con estos filtros</h4>
        <p style="color:var(--text-muted); font-size:0.85rem; max-width:480px; margin:0 auto 16px;">
          Prueba cambiando el lote, año, mes o seleccionando "Todas las Labores", o restablece los filtros con un clic.
        </p>
        <button type="button" class="btn btn-secondary" onclick="resetearTodosFiltrosAgenda()" style="font-size:0.8rem; padding:6px 14px;">
          <i data-lucide="rotate-ccw"></i> Restablecer Filtros
        </button>
      </div>
    `;
    if (tbody) tbody.innerHTML = '<tr><td colspan="7" class="text-center">' + emptyMsg + '</td></tr>';
    if (cardsContainer) cardsContainer.innerHTML = '<div style="grid-column: 1 / -1;">' + emptyMsg + '</div>';
    if (window.lucide) lucide.createIcons();
    return;
  }

  filtradas.forEach(a => {
    const lote = STATE.lotes.find(l => l.id === a.loteId);
    const loteNombre = lote ? lote.nombre : "Lote";
    const esAtrasada = !a.cumplida && a.fecha < HOY;
    const esHoy = a.fecha === HOY;

    let badgeClass = "badge-pendiente";
    let badgeText = "Pendiente";
    if (a.cumplida) {
      badgeClass = "badge-cumplida";
      badgeText = "Cumplida";
    } else if (esAtrasada) {
      badgeClass = "badge-atrasada";
      badgeText = "Atrasada";
    }

    // Insumos formateados
    let insumosHtml = '<span class="text-muted" style="font-size:0.8rem">N/A</span>';
    if (a.productoNombre) {
      insumosHtml = '<div><strong>' + escapeHtml(a.productoNombre) + '</strong></div>' +
        '<div style="font-size:0.75rem; color:var(--text-muted); margin-top:2px;">' +
        'Aplicación: ' + escapeHtml(a.metodo || 'Foliar') + ' | Dosis: ' + escapeHtml(a.dosificacion || 'Sin especificar') +
        '</div>' +
        (a.cantidad > 0 ? '<div style="font-size:0.7rem; opacity:0.8; color:var(--primary);">Volumen Total: ' + a.cantidad + ' ' + escapeHtml(a.unidad || 'Kg') + '</div>' : '');
    }

    // RENDER VISTA 1: TARJETA
    if (cardsContainer) {
      const card = document.createElement("div");
      card.className = "actividad-card " + (a.cumplida ? "cumplida is-cumplida" : (esAtrasada ? "atrasada is-atrasada" : "pendiente"));
      card.style.cursor = "pointer";
      card.onclick = (e) => { if (!e.target.closest("button")) abrirDetalleActividad(a.id); };
      card.innerHTML = `
        <div class="actividad-card-header">
          <div>
            <div style="display:flex; align-items:center; gap:8px;">
              <span class="badge ${badgeClass}">${badgeText}</span>
              <span style="font-size:0.78rem; font-weight:700; color:var(--primary); cursor:pointer;" onclick="verActividadesDeLote('${a.loteId}')" title="Filtrar solo este lote">${escapeHtml(loteNombre)}</span>
            </div>
            <h4 class="actividad-card-title">${escapeHtml(a.tipo)}</h4>
          </div>
          <button class="btn-check-toggle" onclick="toggleActivityStatus('${a.id}')" title="${a.cumplida ? 'Reabrir / Marcar pendiente' : 'Marcar como CUMPLIDA en 1 clic'}">
            <i data-lucide="${a.cumplida ? 'check-circle-2' : 'circle'}"></i>
          </button>
        </div>

        <div class="actividad-card-meta">
          <div class="meta-item">
            <span class="meta-label">Cultivo Objetivo</span>
            <span class="meta-val">${escapeHtml(a.cultivoObjetivo || 'General')}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">Fecha Programada</span>
            <span class="meta-val" style="${esAtrasada ? 'color: var(--danger); font-weight:700;' : (esHoy ? 'color: var(--accent-gold); font-weight:700;' : '')}">
              ${a.fecha} ${esHoy ? ' (HOY)' : (esAtrasada ? ' (Atrasada)' : '')}
            </span>
          </div>
          <div class="meta-item">
            <span class="meta-label">Responsable</span>
            <span class="meta-val">${escapeHtml(a.personal || 'Sin asignar')}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">Etapa Cultivo</span>
            <span class="meta-val">${escapeHtml(a.etapa || 'General')}</span>
          </div>
        </div>

        ${a.productoNombre ? `
        <div class="actividad-card-insumos">
          <div class="insumo-name"><i data-lucide="flask-conical" style="width:13px; height:13px; vertical-align:middle; margin-right:4px;"></i>${escapeHtml(a.productoNombre)}</div>
          <div class="insumo-dosis">Dosis: ${escapeHtml(a.dosificacion || 'Sin especificar')} | ${escapeHtml(a.metodo || 'Foliar')} ${a.cantidad > 0 ? `(${a.cantidad} ${escapeHtml(a.unidad || 'Kg')})` : ''}</div>
        </div>` : ''}

        ${a.notas ? `
        <div class="actividad-card-notes">
          <i data-lucide="file-text" style="width:12px; height:12px; display:inline; margin-right:3px;"></i>${escapeHtml(a.notas)}
        </div>` : ''}

        <div class="actividad-card-footer">
          <div style="font-size:0.75rem; color:var(--text-muted); display:flex; align-items:center; gap:4px;">
            <i data-lucide="${a.cumplida ? 'check' : 'clock'}" style="width:12px; height:12px;"></i>
            ${a.cumplida ? 'Ejecutada' : (esAtrasada ? 'Vencida' : 'Programada')}
          </div>
          <div class="act-actions" style="display:flex; gap:6px;">
            <button class="btn btn-icon btn-sm" onclick="duplicarActividad('${a.id}')" title="Duplicar labor"><i data-lucide="copy"></i></button>
            <button class="btn btn-icon btn-sm" onclick="editarActividad('${a.id}')" title="Editar labor"><i data-lucide="edit-2"></i></button>
            <button class="btn btn-icon btn-sm text-danger" onclick="eliminarActividad('${a.id}')" title="Eliminar labor"><i data-lucide="trash-2"></i></button>
          </div>
        </div>
      `;
      cardsContainer.appendChild(card);
    }

    // RENDER VISTA 2: FILA DE TABLA
    if (tbody) {
      const tr = document.createElement("tr");
      tr.style.cursor = "pointer";
      tr.onclick = (e) => { if (!e.target.closest("button")) abrirDetalleActividad(a.id); };
      tr.innerHTML = `
        <td><span class="badge ${badgeClass}">${badgeText}</span></td>
        <td>
          <div style="font-weight: 700; color: #fff;">${escapeHtml(a.tipo)}</div>
          <div style="font-size: 0.8rem; color: var(--primary); cursor:pointer;" onclick="verActividadesDeLote('${a.loteId}')" title="Filtrar solo este lote">${escapeHtml(loteNombre)} (${escapeHtml(a.cultivoObjetivo || 'General')})</div>
        </td>
        <td><span class="stage-tag">${escapeHtml(a.etapa || 'General')}</span></td>
        <td>${insumosHtml}</td>
        <td>
          <div style="font-weight: 600; ${esAtrasada ? 'color: var(--danger); font-weight:700;' : ''}">${a.fecha}</div>
          <div style="font-size: 0.8rem; color: var(--text-muted);">${escapeHtml(a.personal || 'Sin asignar')}</div>
        </td>
        <td>
          <div style="max-width: 250px; font-size: 0.85rem; color: #cbd5e1; white-space: normal; word-break: break-word;">
            ${escapeHtml(a.notas || '-')}
          </div>
        </td>
        <td style="text-align: right; white-space: nowrap;">
          <button class="btn btn-icon" onclick="toggleActivityStatus('${a.id}')" title="${a.cumplida ? 'Marcar Pendiente' : 'Marcar Cumplida'}">
            <i data-lucide="${a.cumplida ? 'check-circle' : 'circle'}"></i>
          </button>
          <button class="btn btn-icon" onclick="duplicarActividad('${a.id}')" title="Duplicar">
            <i data-lucide="copy"></i>
          </button>
          <button class="btn btn-icon" onclick="editarActividad('${a.id}')" title="Editar">
            <i data-lucide="edit-2"></i>
          </button>
          <button class="btn btn-icon text-danger" onclick="eliminarActividad('${a.id}')" title="Eliminar">
            <i data-lucide="trash-2"></i>
          </button>
        </td>
      `;
      tbody.appendChild(tr);
    }
  });

  if (window.lucide) lucide.createIcons();
}

function applyFilters() {
  poblarSelectoresFiltro();
  renderAgendaTable();
  updateDashboard();
}

async function toggleActivityStatus(id) {
  const act = STATE.actividades.find(a => a.id === id);
  if (!act) return;

  // Actualización optimista instantánea (0 milisegundos de espera)
  act.cumplida = !act.cumplida;
  const nuevoEstado = act.cumplida;

  renderAgendaTable();
  updateDashboard();
  showToast(nuevoEstado ? "✔ ¡Labor marcada como CUMPLIDA!" : "⏳ Labor marcada como PENDIENTE");

  // Enviar a la base de datos en segundo plano
  try {
    const response = await fetch('/api/actividades/' + id, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...act, cumplida: nuevoEstado })
    });
    if (!response.ok) throw new Error("Error al cambiar estado en servidor");
  } catch (err) {
    console.error(err);
    // Revertir cambio local si falló
    act.cumplida = !nuevoEstado;
    renderAgendaTable();
    updateDashboard();
    alert("Hubo un problema de conexión al guardar el cambio de estado. Se ha revertido.");
  }
}

async function reprogramarDias(id, dias) {
  const act = STATE.actividades.find(a => a.id === id);
  if (!act) return;

  const current = new Date(act.fecha);
  current.setDate(current.getDate() + dias);
  
  const yyyy = current.getFullYear();
  const mm = String(current.getMonth() + 1).padStart(2, '0');
  const dd = String(current.getDate()).padStart(2, '0');
  
  const updatedAct = { ...act, fecha: `${yyyy}-${mm}-${dd}` };
  try {
    const response = await fetch(`/api/actividades/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedAct)
    });
    if (!response.ok) throw new Error("Error al reprogramar actividad");
    showToast(`Actividad ${dias > 0 ? 'postergada' : 'adelantada'} al ${updatedAct.fecha}.`);
    await saveState();
  } catch (err) {
    console.error(err);
    alert("Error al reprogramar la actividad.");
  }
}

function abrirModalActividad() {
  document.getElementById("act-modal-title").textContent = "Programar Actividad";
  document.getElementById("act-form-id").value = "";
  if (STATE.lotes.length > 0) {
    document.getElementById("act-form-lote").value = STATE.lotes[0].id;
  }
  actualizarSelectoresActividad();
  document.getElementById("act-form-tipo").value = "";
  document.getElementById("act-form-producto").value = "";
  document.getElementById("act-form-fecha").value = HOY;
  document.getElementById("act-form-personal").value = "";
  document.getElementById("act-form-etapa").value = "Crecimiento";
  document.getElementById("act-form-dosificacion").value = "";
  document.getElementById("act-form-metodo").value = "Foliar";
  document.getElementById("act-form-cantidad").value = "";
  document.getElementById("act-form-unidad").value = "Kg";
  document.getElementById("act-form-notas").value = "";

  const actModal = document.getElementById("act-modal");
  actModal.classList.add("active");
  actModal.scrollTop = 0;
  const modalBody = actModal.querySelector(".modal-body-scroll");
  if (modalBody) modalBody.scrollTop = 0;
  if (window.lucide) lucide.createIcons();
}

function actualizarSelectoresActividad() {
  const loteSel = document.getElementById("act-form-lote");
  const originalLoteVal = loteSel.value;
  loteSel.innerHTML = "";
  STATE.lotes.forEach(l => {
    loteSel.innerHTML += '<option value="' + l.id + '">' + escapeHtml(l.nombre) + ' (' + escapeHtml(l.cultivo) + ')</option>';
  });

  if (originalLoteVal && STATE.lotes.some(l => l.id === originalLoteVal)) {
    loteSel.value = originalLoteVal;
  } else if (STATE.lotes.length > 0) {
    loteSel.value = STATE.lotes[0].id;
  }

  const selectedLoteId = loteSel.value;
  const lote = STATE.lotes.find(l => l.id === selectedLoteId);
  const objSel = document.getElementById("act-form-cultivo-objetivo");
  objSel.innerHTML = "";
  if (lote) {
    objSel.innerHTML += '<option value="' + escapeHtml(lote.cultivo) + '">' + escapeHtml(lote.cultivo) + ' (Principal)</option>';
    if (lote.cultivo2) {
      objSel.innerHTML += '<option value="' + escapeHtml(lote.cultivo2) + '">' + escapeHtml(lote.cultivo2) + ' (Siembra 2)</option>';
    }
    if (lote.cultivo3) {
      objSel.innerHTML += '<option value="' + escapeHtml(lote.cultivo3) + '">' + escapeHtml(lote.cultivo3) + ' (Siembra 3)</option>';
    }
    if (lote.cultivo2 || lote.cultivo3) {
      objSel.innerHTML += '<option value="Ambos Cultivos">Todos los Cultivos</option>';
    }
    objSel.value = lote.cultivo;
  } else {
    objSel.innerHTML = '<option value="">Seleccione Lote primero</option>';
  }
}
function editarActividad(id) {
  const act = STATE.actividades.find(a => a.id === id);
  if (!act) return;

  document.getElementById("act-form-lote").value = act.loteId;
  actualizarSelectoresActividad();

  document.getElementById("act-modal-title").textContent = "Editar Actividad";
  document.getElementById("act-form-id").value = act.id;
  document.getElementById("act-form-lote").value = act.loteId;
  document.getElementById("act-form-cultivo-objetivo").value = act.cultivoObjetivo || "";
  document.getElementById("act-form-tipo").value = act.tipo;
  document.getElementById("act-form-producto").value = act.productoNombre || "";
  document.getElementById("act-form-fecha").value = act.fecha;
  document.getElementById("act-form-personal").value = act.personal;
  document.getElementById("act-form-etapa").value = act.etapa;
  document.getElementById("act-form-dosificacion").value = act.dosificacion || "";
  document.getElementById("act-form-metodo").value = act.metodo || "Foliar";
  document.getElementById("act-form-cantidad").value = act.cantidad || "";
  document.getElementById("act-form-unidad").value = act.unidad || "Kg";
  document.getElementById("act-form-notas").value = act.notas || "";

  const rSi = document.getElementById("act-form-cumplida-si");
  const rNo = document.getElementById("act-form-cumplida-no");
  if (act.cumplida) {
    if (rSi) rSi.checked = true;
  } else {
    if (rNo) rNo.checked = true;
  }

  const actModal = document.getElementById("act-modal");
  actModal.classList.add("active");
  actModal.scrollTop = 0;
  const modalBody = actModal.querySelector(".modal-body-scroll");
  if (modalBody) modalBody.scrollTop = 0;
  if (window.lucide) lucide.createIcons();
}

async function eliminarActividad(id) {
  if (confirm("¿Estás seguro de borrar esta actividad de la bitácora?")) {
    try {
      const response = await fetch(`/api/actividades/${id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error("Error al eliminar actividad");
      showToast("Actividad eliminada correctamente.");
      await saveState();
    } catch (err) {
      console.error(err);
      alert("Error al eliminar la actividad.");
    }
  }
}

// Dosificación Inteligente: Al escribir el producto, predice y sugiere el método y dosis histórica
function predecirDosificacion() {
  const inputProd = document.getElementById("act-form-producto").value.trim().toLowerCase();
  if (!inputProd) return;

  // Buscar última dosificación para ese producto
  const historial = STATE.dosificacionesHistoricas.find(h => h.producto.toLowerCase() === inputProd);
  if (historial) {
    document.getElementById("act-form-dosificacion").value = historial.dosificacion;
    document.getElementById("act-form-metodo").value = historial.metodo;
  }
}

// Hook al escribir el producto para buscar auto-sugerencias de dosis
document.getElementById("act-form-producto").addEventListener("input", predecirDosificacion);


/* ==========================================================================
   ESTUDIOS DE SUELOS (CARGA Y VISUALIZACIÓN BASE64)
   ========================================================================== */
function renderSuelosGrid() {
  const container = document.getElementById("suelos-container");
  container.innerHTML = "";

  if (STATE.estudiosSuelo.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1;">
        <i data-lucide="microscope"></i>
        <p>No se han registrado estudios de suelo en La Leonora. Sube el primer análisis semestral.</p>
      </div>
    `;
    if (window.lucide) lucide.createIcons();
    return;
  }

  STATE.estudiosSuelo.forEach(e => {
    const lote = STATE.lotes.find(l => l.id === e.loteId);
    const loteNombre = lote ? lote.nombre : "Lote Desconocido";

    const card = document.createElement("div");
    card.className = "lote-card";
    
    // Detectar si el reporte es PDF o Imagen
    const isPdf = e.imagenBase64 && e.imagenBase64.startsWith("data:application/pdf");
    const previewHtml = isPdf ? `
      <div style="width:100%; height:100%; background:rgba(239,68,68,0.1); display:flex; flex-direction:column; align-items:center; justify-content:center; gap:8px; color:var(--danger);">
        <i data-lucide="file-text" style="width:32px; height:32px;"></i>
        <span style="font-size:0.75rem; font-weight:600;">Documento PDF</span>
      </div>
    ` : `
      <img src="${e.imagenBase64}" alt="Análisis" style="width:100%; height:100%; object-fit:cover;">
    `;
    
    card.innerHTML = `
      <div class="lote-header">
        <div>
          <h3 class="lote-name" style="font-size:1.1rem;">${e.titulo}</h3>
          <div style="font-size:0.75rem; color:var(--text-muted); margin-top:2px;">Lote: <strong>${loteNombre}</strong></div>
        </div>
        <span class="badge stage-badge">${e.fecha}</span>
      </div>
      
      <div style="position:relative; height:120px; overflow:hidden; border-radius:10px; cursor:zoom-in; border:1px solid var(--border-color);" onclick="zoomImagenSuelo('${e.id}')">
        ${previewHtml}
        <div style="position:absolute; bottom:6px; right:6px; background:rgba(0,0,0,0.6); color:white; padding:4px 6px; font-size:0.7rem; border-radius:4px; display:flex; align-items:center; gap:4px;">
          <i data-lucide="zoom-in" style="width:10px; height:10px;"></i> Ampliar
        </div>
      </div>

      <div style="font-size:0.8rem; line-height:1.4; color:var(--text-muted); background:rgba(0,0,0,0.15); padding:10px; border-radius:8px;">
        <strong>Resultados/Notas:</strong><br>
        ${e.notas || 'Sin anotaciones de laboratorio.'}
      </div>

      <div class="lote-actions" style="margin-top:auto;">
        <button class="btn btn-secondary" style="font-size:0.75rem; padding:6px 10px;" onclick="quickScheduleFromBI('${escapeHtml(loteNombre)}', 'Fertilización')">
          <i data-lucide="flask"></i> Planificar Abonado
        </button>
        <button class="btn-icon-only text-danger" onclick="eliminarSuelo('${e.id}')" title="Eliminar"><i data-lucide="trash-2"></i></button>
      </div>
    `;
    container.appendChild(card);
  });
  if (window.lucide) lucide.createIcons();
}

function abrirModalSuelo() {
  const selectLote = document.getElementById("suelo-form-lote");
  selectLote.innerHTML = "";
  
  if (STATE.lotes.length === 0) {
    alert("Primero debes crear al menos un lote para asociar el análisis de suelos.");
    return;
  }

  STATE.lotes.forEach(l => {
    selectLote.innerHTML += `<option value="${l.id}">${l.nombre}</option>`;
  });

  document.getElementById("suelo-form-titulo").value = "";
  document.getElementById("suelo-form-fecha").value = HOY;
  document.getElementById("suelo-form-imagen").value = "";
  document.getElementById("suelo-form-notas").value = "";

  document.getElementById("suelo-modal").classList.add("active");
}

function zoomImagenSuelo(id) {
  const e = STATE.estudiosSuelo.find(est => est.id === id);
  if (!e) return;

  const lote = STATE.lotes.find(l => l.id === e.loteId);
  const loteNombre = lote ? lote.nombre : "Lote Desconocido";

  document.getElementById("zoom-modal-title").textContent = `${e.titulo} - ${loteNombre}`;
  
  const isPdf = e.imagenBase64 && e.imagenBase64.startsWith("data:application/pdf");
  const imgEl = document.getElementById("zoom-modal-img");
  
  // Buscar o crear el visor de PDF
  let pdfEmbed = document.getElementById("zoom-modal-pdf");
  
  if (isPdf) {
    imgEl.style.display = "none";
    if (!pdfEmbed) {
      pdfEmbed = document.createElement("embed");
      pdfEmbed.id = "zoom-modal-pdf";
      pdfEmbed.style.cssText = "width: 100%; height: 500px; border-radius: 6px; background: white;";
      imgEl.parentNode.appendChild(pdfEmbed);
    }
    pdfEmbed.src = e.imagenBase64;
    pdfEmbed.type = "application/pdf";
    pdfEmbed.style.display = "block";
  } else {
    imgEl.src = e.imagenBase64;
    imgEl.style.display = "inline-block";
    if (pdfEmbed) {
      pdfEmbed.style.display = "none";
      pdfEmbed.src = "";
    }
  }

  document.getElementById("zoom-modal-desc").innerHTML = `
    <strong>Fecha del Análisis:</strong> ${e.fecha}<br>
    <strong>Observaciones:</strong> ${e.notas || 'Sin anotaciones adicionales.'}
  `;

  document.getElementById("zoom-modal").classList.add("active");
}

async function eliminarSuelo(id) {
  if (confirm("¿Estás seguro de eliminar este registro de análisis de suelo?")) {
    try {
      const response = await fetch(`/api/suelos/${id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error("Error al eliminar análisis");
      showToast("Análisis de suelo eliminado.");
      await saveState();
    } catch (err) {
      console.error(err);
      alert("Error al eliminar el análisis de suelo.");
    }
  }
}

/* ==========================================================================
   FORMULARIOS & SUBMITS
   ========================================================================== */
function setupFormsAndModals() {
  // Cierres de modales
  const closures = document.querySelectorAll(".modal-close, .modal-cancel");
  closures.forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".modal-overlay").forEach(m => m.classList.remove("active"));
    });
  });

  // Escuchar cambio de lote para actualizar el cultivo objetivo dinámicamente
  document.getElementById("act-form-lote").addEventListener("change", actualizarSelectoresActividad);

  // Escuchar inputs del lote para cálculos en vivo de densidad y área
    const inputsCalculosLote = [
      "lote-form-arboles1", "lote-form-surco1", "lote-form-planta1", "lote-form-pendientes1",
      "lote-form-arboles2", "lote-form-surco2", "lote-form-planta2", "lote-form-pendientes2",
      "lote-form-arboles3", "lote-form-surco3", "lote-form-planta3", "lote-form-pendientes3",
      "lote-form-area", "lote-form-pendientes"
    ];

    const btnToggleS3 = document.getElementById("btn-toggle-siembra3");
    if (btnToggleS3) btnToggleS3.addEventListener("click", toggleSiembra3);
  inputsCalculosLote.forEach(inpId => {
    const el = document.getElementById(inpId);
    if (el) el.addEventListener("input", actualizarCalculosModalLote);
  });

  const btnCalcArea = document.getElementById("btn-calc-area");
  if (btnCalcArea) btnCalcArea.addEventListener("click", calcularAreaAutomatica);

  const btnCalcArboles = document.getElementById("btn-calc-arboles");
  if (btnCalcArboles) btnCalcArboles.addEventListener("click", estimarArbolesSegunArea);

  // Submit Lote
  document.getElementById("lote-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const id = document.getElementById("lote-form-id").value;
    const nombre = document.getElementById("lote-form-nombre").value.trim();
    const cultivo = document.getElementById("lote-form-cultivo").value.trim();
    const cultivo2 = document.getElementById("lote-form-cultivo2").value.trim();
    const cultivo3 = document.getElementById("lote-form-cultivo3").value.trim();
    const area = parseFloat(document.getElementById("lote-form-area").value);
    const etapa = document.getElementById("lote-form-etapa").value;
    const fecha = document.getElementById("lote-form-fecha").value;
    const fecha2 = document.getElementById("lote-form-fecha2").value;
    const fecha3 = document.getElementById("lote-form-fecha3").value;

    const arboles1 = parseInt(document.getElementById("lote-form-arboles1").value) || 0;
    const distanciaSurco1 = parseFloat(document.getElementById("lote-form-surco1").value) || 0;
    const distanciaPlanta1 = parseFloat(document.getElementById("lote-form-planta1").value) || 0;
    const arbolesPendientes1 = parseInt(document.getElementById("lote-form-pendientes1").value) || 0;

    const arboles2 = parseInt(document.getElementById("lote-form-arboles2").value) || 0;
    const distanciaSurco2 = parseFloat(document.getElementById("lote-form-surco2").value) || 0;
    const distanciaPlanta2 = parseFloat(document.getElementById("lote-form-planta2").value) || 0;
    const arbolesPendientes2 = parseInt(document.getElementById("lote-form-pendientes2").value) || 0;

    const arboles3 = parseInt(document.getElementById("lote-form-arboles3").value) || 0;
    const distanciaSurco3 = parseFloat(document.getElementById("lote-form-surco3").value) || 0;
    const distanciaPlanta3 = parseFloat(document.getElementById("lote-form-planta3").value) || 0;
    const arbolesPendientes3 = parseInt(document.getElementById("lote-form-pendientes3").value) || 0;

    const sumaPendientesForm = arbolesPendientes1 + arbolesPendientes2 + arbolesPendientes3;
    const arbolesPendientes = sumaPendientesForm > 0 ? sumaPendientesForm : (parseInt(document.getElementById("lote-form-pendientes").value) || 0);

    if (!nombre || !cultivo || !area) {
      alert("Por favor completa los campos obligatorios (Nombre, Cultivo Principal y Área).");
      return;
    }

    const payload = {
      nombre, cultivo, cultivo2, cultivo3, area, etapa,
      fechaSiembra: fecha, fechaSiembra2: fecha2, fechaSiembra3: fecha3,
      arboles1, distanciaSurco1, distanciaPlanta1, arbolesPendientes1,
      arboles2, distanciaSurco2, distanciaPlanta2, arbolesPendientes2,
      arboles3, distanciaSurco3, distanciaPlanta3, arbolesPendientes3,
      arbolesPendientes
    };

    try {
      if (id) {
        const response = await fetch('/api/lotes/' + id, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (!response.ok) throw new Error("Error al actualizar lote");
      } else {
        const nuevoId = 'lote-' + Date.now();
        const response = await fetch('/api/lotes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: nuevoId, ...payload })
        });
        if (!response.ok) throw new Error("Error al crear lote");
      }

      document.getElementById("lote-modal").classList.remove("active");
      await saveState();
      actualizarSelectorLoteRapido();
      showToast("Lote de cultivo guardado correctamente.");
    } catch (err) {
      console.error(err);
      alert("Error al guardar el lote.");
    }
  });
  // Función para guardar actividad (reutilizada por submit normal y Guardar y Otra)
  async function guardarActividadDesdeModal(cerrarModalAlFinal = true) {
    const id = document.getElementById("act-form-id").value;
    const loteId = document.getElementById("act-form-lote").value;
    const cultivoObjetivo = document.getElementById("act-form-cultivo-objetivo").value;
    const tipo = document.getElementById("act-form-tipo").value.trim();
    const productoNombre = document.getElementById("act-form-producto").value.trim();
    const fecha = document.getElementById("act-form-fecha").value;
    const personal = document.getElementById("act-form-personal").value.trim();
    const etapa = document.getElementById("act-form-etapa").value;
    const dosificacion = document.getElementById("act-form-dosificacion").value.trim();
    const metodo = document.getElementById("act-form-metodo").value;
    const cantidad = parseFloat(document.getElementById("act-form-cantidad").value) || 0;
    const unidad = document.getElementById("act-form-unidad").value;
    const notesActualVal = document.getElementById("act-form-notas").value.trim();

    // Leer el radio button de cumplimiento real seleccionado por el usuario:
    const cumplidaRadio = document.querySelector('input[name="act-form-cumplida"]:checked');
    const cumplida = cumplidaRadio ? (cumplidaRadio.value === "true") : false;

    if (!loteId || !tipo || !fecha || !personal) {
      alert("Por favor completa los campos obligatorios: Lote, Tipo de Labor, Fecha y Responsable.");
      return false;
    }

    const loteObj = STATE.lotes.find(l => l.id === loteId);
    const cultivoFinal = cultivoObjetivo || (loteObj ? loteObj.cultivo : "General");

    try {
      if (productoNombre && dosificacion) {
        await fetch('/api/dosificaciones', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ producto: productoNombre, dosificacion, metodo })
        });
      }

      if (id) {
        const response = await fetch(`/api/actividades/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            loteId,
            cultivoObjetivo: cultivoFinal,
            tipo,
            productoNombre,
            cantidad,
            unidad,
            fecha,
            personal,
            etapa,
            dosificacion,
            metodo,
            cumplida,
            notas: notesActualVal
          })
        });
        if (!response.ok) throw new Error("Error al actualizar actividad");
      } else {
        const nuevoId = `act-${Date.now()}`;
        const response = await fetch('/api/actividades', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: nuevoId,
            loteId,
            cultivoObjetivo: cultivoFinal,
            tipo,
            productoNombre,
            cantidad,
            unidad,
            fecha,
            personal,
            etapa,
            dosificacion,
            metodo,
            cumplida,
            notas: notesActualVal
          })
        });
        if (!response.ok) throw new Error("Error al crear actividad");
      }

      await saveState();
      showToast(cumplida ? "✔ Actividad guardada como CUMPLIDA." : "📅 Actividad programada en agenda.");

      if (cerrarModalAlFinal) {
        document.getElementById("act-modal").classList.remove("active");
      } else {
        // Limpiar para registrar otra labor pero conservando lote, fecha y personal
        document.getElementById("act-form-id").value = "";
        document.getElementById("act-form-tipo").value = "";
        document.getElementById("act-form-producto").value = "";
        document.getElementById("act-form-dosificacion").value = "";
        document.getElementById("act-form-cantidad").value = "";
        document.getElementById("act-form-notas").value = "";
        const rNo = document.getElementById("act-form-cumplida-no");
        if (rNo) rNo.checked = true;
        const tipoInput = document.getElementById("act-form-tipo");
        if (tipoInput) tipoInput.focus();
        showToast("Listo para registrar otra actividad en este lote.");
      }
      return true;
    } catch (err) {
      console.error(err);
      alert("Error al guardar la actividad: " + err.message);
      return false;
    }
  }

  // Submit normal del formulario
  document.getElementById("act-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    await guardarActividadDesdeModal(true);
  });

  // Botón "Guardar y Otra"
  const btnSaveAnother = document.getElementById("btn-act-save-and-another");
  if (btnSaveAnother) {
    btnSaveAnother.addEventListener("click", async (e) => {
      e.preventDefault();
      await guardarActividadDesdeModal(false);
    });
  }

  // Submit Análisis de Suelo (Procesamiento Base64)
  document.getElementById("suelo-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const loteId = document.getElementById("suelo-form-lote").value;
    const titulo = document.getElementById("suelo-form-titulo").value.trim();
    const fecha = document.getElementById("suelo-form-fecha").value;
    const notas = document.getElementById("suelo-form-notas").value.trim();
    const fileInput = document.getElementById("suelo-form-imagen");

    if (!loteId || !titulo || !fecha || fileInput.files.length === 0) {
      alert("Por favor completa todos los campos del formulario de análisis.");
      return;
    }

    const file = fileInput.files[0];
    const reader = new FileReader();

    reader.onloadend = async () => {
      try {
        const nuevoId = `suelo-${Date.now()}`;
        const response = await fetch('/api/suelos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: nuevoId, loteId, titulo, fecha, notas, imagenBase64: reader.result })
        });
        if (!response.ok) throw new Error("Error al guardar estudio de suelo");

        document.getElementById("suelo-modal").classList.remove("active");
        await saveState();
        showToast("Estudio de suelos cargado correctamente a La Leonora.");
      } catch (err) {
        console.error(err);
        alert("Error al cargar el estudio de suelos.");
      }
    };

    reader.readAsDataURL(file); // Convierte archivo a cadena Base64
  });
}

/* ==========================================================================
   UTILIDADES (Toast, Escape HTML)
   ========================================================================== */
function showToast(mensaje) {
  let container = document.getElementById("toast-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "toast-container";
    container.style.cssText = "position: fixed; bottom: 24px; right: 24px; z-index: 999; display: flex; flex-direction: column; gap: 8px;";
    document.body.appendChild(container);
  }

  const toast = document.createElement("div");
  toast.style.cssText = `
    background: rgba(9, 20, 13, 0.95);
    border: 1px solid var(--primary);
    box-shadow: 0 4px 15px rgba(16,185,129,0.2);
    color: #ffffff;
    padding: 12px 20px;
    border-radius: 10px;
    font-size: 0.88rem;
    font-weight: 500;
    backdrop-filter: blur(8px);
    display: flex;
    align-items: center;
    gap: 8px;
    animation: slideIn 0.3s ease-out;
  `;
  toast.innerHTML = `<i data-lucide="sparkles" style="color:var(--primary)"></i> ${mensaje}`;
  container.appendChild(toast);
  
  if (window.lucide) lucide.createIcons();

  setTimeout(() => {
    toast.style.animation = "fadeOut 0.3s forwards";
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/* ==========================================================================
   ADMINISTRACIÓN DE PERSONAL (OPERARIOS)
   ========================================================================== */
function abrirModalPersonal() {
  document.getElementById("personal-new-name").value = "";
  renderPersonalList();
  document.getElementById("personal-modal").classList.add("active");
}

function renderPersonalList() {
  const container = document.getElementById("personal-list-container");
  container.innerHTML = "";

  if (STATE.sugPersonal.length === 0) {
    container.innerHTML = `<div style="text-align:center; padding:15px; color:var(--text-muted); font-size:0.85rem;">No hay operarios registrados.</div>`;
    return;
  }

  STATE.sugPersonal.forEach(p => {
    const div = document.createElement("div");
    div.style.cssText = "display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; background: rgba(255,255,255,0.02); border: 1px solid var(--border-color); border-radius: 8px;";
    div.innerHTML = `
      <span style="color:#ffffff; font-size:0.9rem;">${escapeHtml(p)}</span>
      <button class="btn-icon-only text-danger" onclick="eliminarPersonal('${escapeHtml(p)}')" title="Eliminar operario" style="width:28px; height:28px; display:inline-flex; align-items:center; justify-content:center;">
        <i data-lucide="trash-2" style="width:14px; height:14px;"></i>
      </button>
    `;
    container.appendChild(div);
  });

  if (window.lucide) lucide.createIcons();
}

async function agregarNuevoPersonal() {
  const input = document.getElementById("personal-new-name");
  const name = input.value.trim();

  if (!name) {
    alert("Por favor ingrese el nombre del operario.");
    return;
  }

  if (STATE.sugPersonal.some(p => p.toLowerCase() === name.toLowerCase())) {
    alert("Este operario ya está registrado.");
    return;
  }

  try {
    const response = await fetch('/api/personal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre: name })
    });
    if (!response.ok) throw new Error("Error al guardar personal");
    
    input.value = "";
    await saveState();
    renderPersonalList();
    showToast(`Operario "${name}" agregado correctamente.`);
  } catch (err) {
    console.error(err);
    alert("Error al registrar al operario.");
  }
}

async function eliminarPersonal(name) {
  if (confirm(`¿Estás seguro de eliminar a "${name}" de la lista de operarios?`)) {
    try {
      const response = await fetch(`/api/personal/${encodeURIComponent(name)}`, {
        method: 'DELETE'
      });
      if (!response.ok) throw new Error("Error al eliminar personal");
      await saveState();
      renderPersonalList();
      showToast(`Operario "${name}" eliminado de la lista.`);
    } catch (err) {
      console.error(err);
      alert("Error al eliminar al operario.");
    }
  }
}


function setupQuickActivityForm() {
  const form = document.getElementById("quick-act-form");
  if (!form) return;

  const fechaInp = document.getElementById("quick-act-fecha");
  if (fechaInp && !fechaInp.value) fechaInp.value = HOY;

  actualizarSelectorLoteRapido();

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const loteId = document.getElementById("quick-act-lote").value;
    const tipo = document.getElementById("quick-act-tipo").value.trim();
    const fecha = document.getElementById("quick-act-fecha").value;
    const personal = document.getElementById("quick-act-personal").value.trim();

    if (!loteId || !tipo || !fecha || !personal) {
      alert("Por favor completa los campos del agendado rápido.");
      return;
    }

    const lote = STATE.lotes.find(l => l.id === loteId);
    const cultivoObjetivo = lote ? lote.cultivo : "General";
    const etapa = lote ? lote.etapa : "Crecimiento";

    const nuevoId = 'act-' + Date.now();
    const nuevaAct = {
      id: nuevoId,
      loteId,
      cultivoObjetivo,
      tipo,
      productoNombre: "",
      cantidad: 0,
      unidad: "Kg",
      fecha,
      personal,
      etapa,
      dosificacion: "",
      metodo: "Campo / Manual",
      cumplida: false,
      notas: "Programada desde barra exprés"
    };

    STATE.actividades.unshift(nuevaAct);
    renderAgendaTable();
    updateDashboard();
    showToast('⚡ Labor "' + tipo + '" agendada exitosamente en 1 clic!');

    document.getElementById("quick-act-tipo").value = "";

    try {
      await fetch('/api/actividades', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(nuevaAct)
      });
    } catch (err) {
      console.error("Error al guardar en segundo plano:", err);
    }
  });
}

/* ==========================================================================
   GRAN INDICADOR EJECUTIVO & RANKING DE CAPACIDAD FINCA LA LEONORA
   ========================================================================== */
function calcularMetricasCapacidadFinca() {
  const lotes = STATE.lotes || [];
  let totalAreaFinca = 0;
  let totalSembradosFinca = 0;
  let totalPendientesFinca = 0;
  let totalTeoricaFinca = 0;

  const ranking = lotes.map(l => {
    const area = parseFloat(l.area) || 0;
    totalAreaFinca += area;

    const a1 = parseInt(l.arboles1) || 0;
    const a2 = parseInt(l.arboles2) || 0;
    const a3 = parseInt(l.arboles3) || 0;
    const sembrados = a1 + a2 + a3;

    const p1 = parseInt(l.arbolesPendientes1 || l.arboles_pendientes1) || 0;
    const p2 = parseInt(l.arbolesPendientes2 || l.arboles_pendientes2) || 0;
    const p3 = parseInt(l.arbolesPendientes3 || l.arboles_pendientes3) || 0;
    const pendientes = parseInt(l.arbolesPendientes || l.arboles_pendientes) || (p1 + p2 + p3);
    const proyectado = sembrados + pendientes;

    const s1 = parseFloat(l.distanciaSurco1 || l.distancia_surco1) || 0;
    const pl1 = parseFloat(l.distanciaPlanta1 || l.distancia_planta1) || 0;
    const densTeor1 = (s1 > 0 && pl1 > 0) ? Math.round(10000 / (s1 * pl1)) : 0;

    const s2 = parseFloat(l.distanciaSurco2 || l.distancia_surco2) || 0;
    const pl2 = parseFloat(l.distanciaPlanta2 || l.distancia_planta2) || 0;
    const densTeor2 = (s2 > 0 && pl2 > 0) ? Math.round(10000 / (s2 * pl2)) : 0;

    const s3 = parseFloat(l.distanciaSurco3 || l.distancia_surco3) || 0;
    const pl3 = parseFloat(l.distanciaPlanta3 || l.distancia_planta3) || 0;
    const densTeor3 = (s3 > 0 && pl3 > 0) ? Math.round(10000 / (s3 * pl3)) : 0;

    let densDominante = densTeor1 > 0 ? densTeor1 : (densTeor2 > 0 ? densTeor2 : densTeor3);
    let teorica = densDominante > 0 && area > 0 ? Math.round(densDominante * area) : proyectado;
    const capacidadBase = Math.max(teorica, proyectado);

    totalSembradosFinca += sembrados;
    totalPendientesFinca += pendientes;
    totalTeoricaFinca += capacidadBase;

    const pctAvanceSiembra = proyectado > 0 ? ((sembrados / proyectado) * 100) : 0;
    const pctCapacidadInstalada = capacidadBase > 0 ? ((sembrados / capacidadBase) * 100) : 0;

    // Detalle de siembras para mostrar en el modal
    const siembrasDetalle = [];
    if (l.cultivo) {
      siembrasDetalle.push({
        nombre: l.cultivo,
        sembrados: a1,
        pendientes: p1,
        marco: (s1 > 0 && pl1 > 0) ? `${s1}m × ${pl1}m` : 'N/D'
      });
    }
    if (l.cultivo2) {
      siembrasDetalle.push({
        nombre: l.cultivo2,
        sembrados: a2,
        pendientes: p2,
        marco: (s2 > 0 && pl2 > 0) ? `${s2}m × ${pl2}m` : 'N/D'
      });
    }
    if (l.cultivo3) {
      siembrasDetalle.push({
        nombre: l.cultivo3,
        sembrados: a3,
        pendientes: p3,
        marco: (s3 > 0 && pl3 > 0) ? `${s3}m × ${pl3}m` : 'N/D'
      });
    }

    return {
      id: l.id,
      nombre: l.nombre,
      cultivo: l.cultivo,
      cultivo2: l.cultivo2,
      cultivo3: l.cultivo3,
      area,
      sembrados,
      pendientes,
      proyectado,
      capacidadBase,
      pctAvanceSiembra: pctAvanceSiembra,
      pctCapacidadInstalada: pctCapacidadInstalada,
      siembrasDetalle
    };
  });

  // Ordenar de menor a mayor avance (el lote más rezagado primero)
  ranking.sort((a, b) => a.pctAvanceSiembra - b.pctAvanceSiembra);

  const pctGlobalFinca = totalTeoricaFinca > 0 ? ((totalSembradosFinca / totalTeoricaFinca) * 100) : 0;
  const pctAvanceGlobal = (totalSembradosFinca + totalPendientesFinca) > 0 
    ? ((totalSembradosFinca / (totalSembradosFinca + totalPendientesFinca)) * 100) 
    : 0;

  return {
    totalAreaFinca: totalAreaFinca.toFixed(2),
    totalSembradosFinca,
    totalPendientesFinca,
    totalProyectadoFinca: totalSembradosFinca + totalPendientesFinca,
    totalTeoricaFinca,
    pctGlobalFinca: pctGlobalFinca.toFixed(1),
    pctAvanceGlobal: pctAvanceGlobal.toFixed(1),
    loteMasBajo: ranking[0] || null,
    ranking
  };
}

function updateFincaGrandKPI() {
  const data = calcularMetricasCapacidadFinca();
  
  const elSembrados = document.getElementById("finca-sembrados-val");
  if (!elSembrados) return;

  elSembrados.textContent = data.totalSembradosFinca.toLocaleString();
  const subInstalada = document.getElementById("finca-pct-instalada-sub");
  if (subInstalada) subInstalada.textContent = `${data.pctGlobalFinca}% de capacidad teórica (${data.pctAvanceGlobal}% de meta)`;
  
  const elPendientes = document.getElementById("finca-pendientes-val");
  if (elPendientes) elPendientes.textContent = `+${data.totalPendientesFinca.toLocaleString()}`;
  
  const pctPend = data.totalTeoricaFinca > 0 ? ((data.totalPendientesFinca / data.totalTeoricaFinca) * 100).toFixed(1) : "0";
  const subPend = document.getElementById("finca-pendientes-sub");
  if (subPend) subPend.textContent = `${pctPend}% pendiente por sembrar`;

  const elTeorica = document.getElementById("finca-teorica-val");
  if (elTeorica) elTeorica.textContent = data.totalTeoricaFinca.toLocaleString();
  
  const subProy = document.getElementById("finca-proyectado-sub");
  if (subProy) subProy.textContent = `${data.totalProyectadoFinca.toLocaleString()} arb. meta proyectada`;

  const elArea = document.getElementById("finca-area-val");
  if (elArea) elArea.textContent = data.totalAreaFinca;

  // Lote más bajo
  if (data.loteMasBajo) {
    const elLbNombre = document.getElementById("finca-lote-bajo-nombre");
    if (elLbNombre) elLbNombre.textContent = data.loteMasBajo.nombre;
    const elLbPct = document.getElementById("finca-lote-bajo-pct");
    if (elLbPct) elLbPct.textContent = `${data.loteMasBajo.pctAvanceSiembra.toFixed(1)}%`;
    const elLbFalt = document.getElementById("finca-lote-bajo-faltante");
    if (elLbFalt) elLbFalt.textContent = `${data.loteMasBajo.pendientes.toLocaleString()} árboles`;
  }

  // Barra de progreso global
  const barSembrados = document.getElementById("finca-bar-sembrados");
  const barPendientes = document.getElementById("finca-bar-pendientes");
  const barText = document.getElementById("finca-bar-pct-text");
  
  if (barSembrados && barPendientes && barText) {
    const wSembrados = Math.min(100, parseFloat(data.pctGlobalFinca) || 0);
    const wPendientes = Math.min(100 - wSembrados, parseFloat(pctPend) || 0);
    barSembrados.style.width = `${wSembrados}%`;
    barPendientes.style.width = `${wPendientes}%`;
    barText.textContent = `${wSembrados}% Instalado • +${wPendientes}% Pendiente • ${(wSembrados + wPendientes).toFixed(1)}% Proyectado`;
  }
}

function abrirModalRankingCapacidad() {
  const data = calcularMetricasCapacidadFinca();
  const modal = document.getElementById("ranking-modal");
  if (!modal) return;

  const heroContainer = document.getElementById("ranking-hero-lote-bajo");
  const listContainer = document.getElementById("ranking-lotes-list");

  // Renderizar Hero Lote Más Bajo
  if (data.loteMasBajo && heroContainer) {
    const lb = data.loteMasBajo;
    const faltantePct = (100 - lb.pctAvanceSiembra).toFixed(1);
    
    // Cultivos y pendientes desglosados
    const detalleCultivos = lb.siembrasDetalle.map(s => {
      return `<span style="background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); padding: 5px 12px; border-radius: 8px; font-size: 0.8rem;">
        <strong>${escapeHtml(s.nombre)}:</strong> ${s.sembrados.toLocaleString()} sembrados ${s.pendientes > 0 ? `<span style="color:#fbbf24; font-weight:700;">(+${s.pendientes.toLocaleString()} pend.)</span>` : ''}
      </span>`;
    }).join(" ");

    heroContainer.innerHTML = `
      <div style="background: linear-gradient(135deg, rgba(239, 68, 68, 0.16) 0%, rgba(127, 29, 29, 0.3) 100%); border: 1px solid rgba(239, 68, 68, 0.45); border-radius: 14px; padding: 18px 20px; box-shadow: 0 4px 18px rgba(0,0,0,0.3);">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 12px; margin-bottom: 12px;">
          <div style="display: flex; align-items: center; gap: 12px;">
            <div style="background: rgba(239, 68, 68, 0.25); border: 1px solid rgba(239, 68, 68, 0.5); width: 38px; height: 38px; border-radius: 10px; display: flex; align-items: center; justify-content: center; color: #f87171;">
              <i data-lucide="alert-circle" style="width: 22px; height: 22px;"></i>
            </div>
            <div>
              <span style="font-size: 0.74rem; text-transform: uppercase; letter-spacing: 0.5px; color: #fca5a5; font-weight: 700;">⚠️ LOTE CON MENOR AVANCE (PRIORIDAD DE SIEMBRA)</span>
              <h3 style="font-size: 1.35rem; font-weight: 800; color: #fff; margin: 2px 0 0 0;">Lote ${escapeHtml(lb.nombre)}</h3>
            </div>
          </div>
          <button type="button" class="btn btn-secondary" onclick="irASeccionLotes('${lb.id}')" style="border-color: rgba(239, 68, 68, 0.5); color: #fca5a5; font-weight: 700; display:flex; align-items:center; gap:6px;">
            <i data-lucide="external-link" style="width:15px; height:15px;"></i> Ir al Lote ${escapeHtml(lb.nombre)}
          </button>
        </div>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 10px; margin-bottom: 14px;">
          <div style="background: rgba(0,0,0,0.35); padding: 10px 12px; border-radius: 10px; border-left: 3px solid #ef4444;">
            <span style="font-size: 0.72rem; color: #94a3b8; display:block;">% Avance de Siembra</span>
            <span style="font-size: 1.35rem; font-weight: 800; color: #f87171;">${lb.pctAvanceSiembra.toFixed(1)}%</span>
            <small style="font-size: 0.7rem; color: #fca5a5; display:block;">Falta el ${faltantePct}%</small>
          </div>
          <div style="background: rgba(0,0,0,0.35); padding: 10px 12px; border-radius: 10px;">
            <span style="font-size: 0.72rem; color: #94a3b8; display:block;">Sembrados Actuales</span>
            <span style="font-size: 1.35rem; font-weight: 800; color: #34d399;">${lb.sembrados.toLocaleString()}</span>
            <small style="font-size: 0.7rem; color: #a7f3d0; display:block;">en ${lb.area} Ha</small>
          </div>
          <div style="background: rgba(0,0,0,0.35); padding: 10px 12px; border-radius: 10px; border-left: 3px solid #f59e0b;">
            <span style="font-size: 0.72rem; color: #94a3b8; display:block;">Árboles Pendientes</span>
            <span style="font-size: 1.35rem; font-weight: 800; color: #fbbf24;">+${lb.pendientes.toLocaleString()}</span>
            <small style="font-size: 0.7rem; color: #fde68a; display:block;">por sembrar</small>
          </div>
          <div style="background: rgba(0,0,0,0.35); padding: 10px 12px; border-radius: 10px;">
            <span style="font-size: 0.72rem; color: #94a3b8; display:block;">Capacidad Teórica</span>
            <span style="font-size: 1.35rem; font-weight: 800; color: #60a5fa;">${lb.capacidadBase.toLocaleString()}</span>
            <small style="font-size: 0.7rem; color: #bfdbfe; display:block;">árboles teóricos</small>
          </div>
        </div>

        <div style="font-size: 0.8rem; color: #cbd5e1; margin-bottom: 8px;">
          <strong>Desglose por Cultivo en ${escapeHtml(lb.nombre)}:</strong>
        </div>
        <div style="display:flex; flex-wrap:wrap; gap:8px;">
          ${detalleCultivos}
        </div>
      </div>
    `;
  }

  // Renderizar Ranking Completo
  if (listContainer) {
    listContainer.innerHTML = "";
    data.ranking.forEach((r, idx) => {
      const isLowest = idx === 0;
      const pct = r.pctAvanceSiembra;
      let badgeColor = "#10b981";
      let badgeBg = "rgba(16,185,129,0.15)";
      let badgeText = "Óptimo";

      if (pct < 70) {
        badgeColor = "#ef4444";
        badgeBg = "rgba(239,68,68,0.18)";
        badgeText = "Prioridad de Siembra";
      } else if (pct < 90) {
        badgeColor = "#f59e0b";
        badgeBg = "rgba(245,158,11,0.15)";
        badgeText = "En Proceso";
      }

      const row = document.createElement("div");
      row.className = `ranking-lot-row ${isLowest ? 'is-lowest' : ''}`;
      
      row.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <span style="background: ${isLowest ? '#ef4444' : 'rgba(255,255,255,0.1)'}; color: #fff; width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 0.85rem;">
              ${idx + 1}
            </span>
            <div>
              <span style="font-weight: 700; font-size: 1.05rem; color: #fff;">${escapeHtml(r.nombre)}</span>
              <span style="font-size: 0.78rem; color: var(--text-muted); margin-left: 8px;">(${r.area} Ha • ${escapeHtml([r.cultivo, r.cultivo2, r.cultivo3].filter(Boolean).join(" + "))})</span>
            </div>
          </div>

          <div style="display: flex; align-items: center; gap: 12px;">
            <span style="background: ${badgeBg}; color: ${badgeColor}; border: 1px solid ${badgeColor}40; padding: 4px 10px; border-radius: 12px; font-size: 0.75rem; font-weight: 700;">
              ${badgeText}
            </span>
            <button type="button" class="btn btn-secondary" onclick="irASeccionLotes('${r.id}')" style="padding: 5px 12px; font-size: 0.78rem; display:flex; align-items:center; gap:5px;">
              <i data-lucide="eye" style="width:13px; height:13px;"></i> Ver Lote
            </button>
          </div>
        </div>

        <!-- Barra de progreso individual -->
        <div>
          <div style="display: flex; justify-content: space-between; font-size: 0.78rem; margin-bottom: 5px;">
            <span style="color: #cbd5e1;">
              <strong style="color: #34d399;">${r.sembrados.toLocaleString()}</strong> sembrados 
              ${r.pendientes > 0 ? `<span style="color:#fbbf24; font-weight:600;">(+${r.pendientes.toLocaleString()} pendientes)</span>` : '<span style="color:#a7f3d0;">(Sin pendientes)</span>'}
            </span>
            <span style="font-weight: 800; color: ${badgeColor};">
              ${pct.toFixed(1)}% Avance (${r.capacidadBase.toLocaleString()} Teórica)
            </span>
          </div>
          <div class="finca-progress-track" style="height: 10px;">
            <div class="finca-progress-sembrados" style="width: ${Math.min(100, pct)}%;"></div>
            <div class="finca-progress-pendientes" style="width: ${Math.min(100 - pct, (r.pendientes / r.capacidadBase) * 100)}%;"></div>
          </div>
        </div>
      `;

      listContainer.appendChild(row);
    });
  }

  // Footer text
  const footerStats = document.getElementById("ranking-modal-footer-stats");
  if (footerStats) {
    footerStats.innerHTML = `Total Finca: <strong style="color:#34d399;">${data.totalSembradosFinca.toLocaleString()} sembrados</strong> | <strong style="color:#fbbf24;">+${data.totalPendientesFinca.toLocaleString()} pendientes</strong> | <strong>${data.totalTeoricaFinca.toLocaleString()} teórica máx.</strong> (${data.totalAreaFinca} Ha)`;
  }

  modal.classList.add("active");
  modal.scrollTop = 0;
  const modalBody = modal.querySelector(".modal-body-scroll");
  if (modalBody) modalBody.scrollTop = 0;
  if (window.lucide) lucide.createIcons();
}

function irASeccionLotes(loteId) {
  // Cerrar modal
  const rankingModal = document.getElementById("ranking-modal");
  if (rankingModal) rankingModal.classList.remove("active");

  // Navegar a seccion lotes
  const navLotes = document.querySelector('.nav-item[data-section="lotes"]');
  if (navLotes) {
    navLotes.click();
  }

  if (loteId) {
    setTimeout(() => {
      destacarLoteEnGrid(loteId);
    }, 250);
  }
}

function destacarLoteEnGrid(loteId) {
  const card = document.getElementById(`lote-card-${loteId}`);
  if (card) {
    card.scrollIntoView({ behavior: "smooth", block: "center" });
    card.classList.remove("lote-highlight-pulse");
    void card.offsetWidth; // trigger reflow
    card.classList.add("lote-highlight-pulse");
    setTimeout(() => {
      card.classList.remove("lote-highlight-pulse");
    }, 2800);
  }
}
