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
    const actsLote = STATE.actividades.filter(a => a.loteId === l.id && a.cumplida && a.productoNombre);
    const prodNombres = [...new Set(actsLote.map(a => a.productoNombre))];

    const card = document.createElement("div");
    card.className = "lote-card";
    
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

      <div class="lote-actions" style="margin-top: 12px; display: flex; justify-content: flex-end; gap: 8px;">
        <button class="btn-icon-only" onclick="editarLote('${l.id}')" title="Editar Lote"><i data-lucide="edit-2"></i></button>
        <button class="btn-icon-only text-danger" onclick="eliminarLote('${l.id}')" title="Eliminar Lote"><i data-lucide="trash-2"></i></button>
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
let currentAgendaView = 'cards';

function switchAgendaView(mode) {
  currentAgendaView = mode;
  const cardsContainer = document.getElementById("agenda-cards-container");
  const tableWrapper = document.getElementById("agenda-table-wrapper");
  const btnCards = document.getElementById("btn-view-cards");
  const btnTable = document.getElementById("btn-view-table");

  if (!cardsContainer || !tableWrapper) return;

  if (mode === 'cards') {
    cardsContainer.style.display = 'grid';
    tableWrapper.style.display = 'none';
    if (btnCards) {
      btnCards.style.background = 'rgba(16, 185, 129, 0.2)';
      btnCards.style.color = '#34d399';
    }
    if (btnTable) {
      btnTable.style.background = 'transparent';
      btnTable.style.color = 'var(--text-muted)';
    }
  } else {
    cardsContainer.style.display = 'none';
    tableWrapper.style.display = 'block';
    if (btnTable) {
      btnTable.style.background = 'rgba(16, 185, 129, 0.2)';
      btnTable.style.color = '#34d399';
    }
    if (btnCards) {
      btnCards.style.background = 'transparent';
      btnCards.style.color = 'var(--text-muted)';
    }
  }
  if (window.lucide) lucide.createIcons();
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

  document.getElementById("act-modal").classList.add("active");
  showToast("📋 Datos copiados. Ajusta la fecha u operario y guarda con 1 clic.");
}

function renderAgendaTable() {
  const tbody = document.getElementById("agenda-table-body");
  const cardsContainer = document.getElementById("agenda-cards-container");
  if (tbody) tbody.innerHTML = "";
  if (cardsContainer) cardsContainer.innerHTML = "";

  const filterLote = document.getElementById("filter-lote")?.value || "";
  const filterCumplida = document.getElementById("filter-cumplida")?.value || "";
  const searchQuery = (document.getElementById("search-activity")?.value || "").toLowerCase();

  const filtradas = STATE.actividades.filter(a => {
    const loteObj = STATE.lotes.find(l => l.id === a.loteId);
    const loteNombre = loteObj ? loteObj.nombre.toLowerCase() : "";
    const notesText = a.notas ? a.notas.toLowerCase() : "";
    const tipoText = (a.tipo || "").toLowerCase();
    const personalText = (a.personal || "").toLowerCase();
    const prodText = (a.productoNombre || "").toLowerCase();

    if (filterLote && a.loteId !== filterLote) return false;
    
    if (filterCumplida === "completadas" && !a.cumplida) return false;
    if (filterCumplida === "pendientes" && (a.cumplida || a.fecha < HOY)) return false;
    if (filterCumplida === "atrasadas" && (a.cumplida || a.fecha >= HOY)) return false;

    if (searchQuery) {
      const match = loteNombre.includes(searchQuery) ||
                    prodText.includes(searchQuery) ||
                    tipoText.includes(searchQuery) ||
                    personalText.includes(searchQuery) ||
                    notesText.includes(searchQuery);
      if (!match) return false;
    }

    return true;
  });

  filtradas.sort((a, b) => b.fecha.localeCompare(a.fecha));

  if (filtradas.length === 0) {
    const emptyMsg = '<div class="empty-state" style="padding:40px 20px; text-align:center;"><i data-lucide="calendar-x" style="width:40px; height:40px; color:var(--text-muted); margin-bottom:12px;"></i><p style="color:var(--text-muted);">No se encontraron actividades planificadas con los filtros seleccionados.</p></div>';
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

    // 1. RENDERIZADO EN TARJETA VISUAL (VISTA PRINCIPAL)
    if (cardsContainer) {
      const card = document.createElement("div");
      card.className = 'actividad-card' + (a.cumplida ? ' is-cumplida' : (esAtrasada ? ' is-atrasada' : ''));
      card.innerHTML = `
        <div class="actividad-card-header">
          <div style="flex: 1; min-width: 0;">
            <div class="actividad-card-title" title="${escapeHtml(a.tipo)}">${escapeHtml(a.tipo)}</div>
            <div class="actividad-card-badges">
              <span class="badge" style="background: rgba(16, 185, 129, 0.15); color: #34d399; font-weight: 600;">
                <i data-lucide="layers" style="width:12px; height:12px; vertical-align:middle; margin-right:3px;"></i> ${escapeHtml(loteNombre)}
              </span>
              <span class="badge" style="background: rgba(245, 158, 11, 0.15); color: #fbbf24; font-weight: 600;">
                ${escapeHtml(a.cultivoObjetivo || 'General')}
              </span>
              <span class="badge stage-badge">${escapeHtml(a.etapa || 'Crecimiento')}</span>
            </div>
          </div>
          <div>
            <button type="button" class="btn-status-toggle ${a.cumplida ? 'is-cumplida' : 'is-pendiente'}" onclick="toggleActivityStatus('${a.id}')" title="Haga 1 clic para cambiar estado al instante">
              <i data-lucide="${a.cumplida ? 'check-circle-2' : 'circle'}"></i>
              <span>${a.cumplida ? 'CUMPLIDA' : 'Marcar CUMPLIDA'}</span>
            </button>
          </div>
        </div>

        <div class="actividad-card-body">
          <div class="actividad-card-meta">
            <div class="meta-item">
              <i data-lucide="calendar"></i>
              <div>
                <span class="meta-label">Fecha Programada</span>
                <span class="meta-val" style="${esAtrasada ? 'color: var(--danger); font-weight: 700;' : (esHoy ? 'color: #38bdf8; font-weight: 700;' : '')}">
                  ${a.fecha} ${esHoy ? '(HOY)' : (esAtrasada ? '(Atrasada)' : '')}
                </span>
              </div>
            </div>
            <div class="meta-item">
              <i data-lucide="user"></i>
              <div>
                <span class="meta-label">Responsable</span>
                <span class="meta-val">${escapeHtml(a.personal || 'Sin asignar')}</span>
              </div>
            </div>
            ${a.productoNombre ? `
            <div class="meta-item" style="grid-column: 1 / -1;">
              <i data-lucide="flask-conical"></i>
              <div>
                <span class="meta-label">Insumo & Dosificación</span>
                <span class="meta-val">${escapeHtml(a.productoNombre)} — ${escapeHtml(a.dosificacion || 'Dosis regular')} (${escapeHtml(a.metodo || 'Foliar')})</span>
              </div>
            </div>
            ` : ''}
          </div>

          ${a.notas ? `
          <div class="actividad-card-notes" title="Observaciones de campo">
            <i data-lucide="message-square" style="width: 14px; height: 14px; color: #94a3b8; flex-shrink: 0; margin-top: 2px;"></i>
            <span>"${escapeHtml(a.notas)}"</span>
          </div>
          ` : ''}
        </div>

        <div class="actividad-card-footer">
          <div style="font-size: 0.75rem; color: var(--text-muted); display: flex; align-items: center; gap: 4px;">
            <i data-lucide="clock" style="width: 12px; height: 12px;"></i>
            <span>Estado: <strong style="color: ${a.cumplida ? '#10b981' : (esAtrasada ? '#ef4444' : '#f59e0b')}">${badgeText}</strong></span>
          </div>
          <div style="display: flex; gap: 6px;">
            <button type="button" class="btn btn-secondary" onclick="duplicarActividad('${a.id}')" style="font-size: 0.76rem; padding: 5px 9px;" title="Duplicar o Clonar labor">
              <i data-lucide="copy"></i> Duplicar
            </button>
            <button type="button" class="btn btn-secondary" onclick="editarActividad('${a.id}')" style="font-size: 0.76rem; padding: 5px 9px;" title="Editar">
              <i data-lucide="edit-2"></i>
            </button>
            <button type="button" class="btn btn-secondary text-danger" onclick="eliminarActividad('${a.id}')" style="font-size: 0.76rem; padding: 5px 9px;" title="Eliminar">
              <i data-lucide="trash-2"></i>
            </button>
          </div>
        </div>
      `;
      cardsContainer.appendChild(card);
    }

    // 2. RENDERIZADO EN TABLA
    if (tbody) {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td style="text-align: center; vertical-align: middle;">
          <button type="button" class="btn-status-toggle ${a.cumplida ? 'is-cumplida' : 'is-pendiente'}" onclick="toggleActivityStatus('${a.id}')" style="font-size: 0.74rem; padding: 4px 8px; width: 100%; justify-content: center;" title="Haga 1 clic para cambiar estado">
            <i data-lucide="${a.cumplida ? 'check-circle-2' : 'circle'}"></i>
            <span>${a.cumplida ? 'Cumplida' : 'Pendiente'}</span>
          </button>
        </td>
        <td>
          <div style="font-weight: 700; color: #fff; font-size: 0.92rem;">${escapeHtml(a.tipo)}</div>
          <div style="font-size:0.75rem; color:var(--text-muted); margin-top:2px;">
            Lote: <strong style="color:#34d399">${escapeHtml(loteNombre)}</strong> | Cultivo: <span style="color:var(--accent-gold)">${escapeHtml(a.cultivoObjetivo || 'Ambos')}</span>
          </div>
        </td>
        <td><span class="badge stage-badge">${escapeHtml(a.etapa || 'Crecimiento')}</span></td>
        <td>${insumosHtml}</td>
        <td>
          <div style="font-weight: 600; ${esAtrasada ? 'color: var(--danger)' : (esHoy ? 'color: #38bdf8' : '')}">${a.fecha}</div>
          <div style="font-size:0.75rem; color:var(--text-muted);">${escapeHtml(a.personal)}</div>
        </td>
        <td style="max-width: 220px;">
          ${a.notas ? '<div style="font-size:0.78rem; color:#cbd5e1; font-style:italic; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="' + escapeHtml(a.notas) + '">"' + escapeHtml(a.notas) + '"</div>' : '<span class="text-muted" style="font-size:0.75rem;">-</span>'}
        </td>
        <td>
          <div class="action-controls">
            <button class="btn-icon-only" onclick="duplicarActividad('${a.id}')" title="Duplicar"><i data-lucide="copy"></i></button>
            <button class="btn-icon-only" onclick="editarActividad('${a.id}')" title="Editar"><i data-lucide="edit-2"></i></button>
            <button class="btn-icon-only text-danger" onclick="eliminarActividad('${a.id}')" title="Eliminar"><i data-lucide="trash-2"></i></button>
          </div>
        </td>
      `;
      tbody.appendChild(tr);
    }
  });

  if (window.lucide) lucide.createIcons();
}

function applyFilters() {
  const filterLoteSel = document.getElementById("filter-lote");
  const actVal = filterLoteSel ? filterLoteSel.value : "";
  if (filterLoteSel) {
    filterLoteSel.innerHTML = '<option value="">Todos los Lotes</option>';
    STATE.lotes.forEach(l => {
      filterLoteSel.innerHTML += '<option value="' + l.id + '">' + escapeHtml(l.nombre) + '</option>';
    });
    filterLoteSel.value = actVal;
  }

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

  document.getElementById("act-modal").classList.add("active");
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

  document.getElementById("act-modal").classList.add("active");
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
  // Submit Actividad
  document.getElementById("act-form").addEventListener("submit", async (e) => {
    e.preventDefault();
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

    if (!loteId || !tipo || !fecha || !personal || !cultivoObjetivo) {
      alert("Por favor completa los campos obligatorios del registro.");
      return;
    }

    try {
      if (productoNombre && dosificacion) {
        await fetch('/api/dosificaciones', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ producto: productoNombre, dosificacion, metodo })
        });
      }

      if (id) {
        const actPrev = STATE.actividades.find(a => a.id === id);
        const cum = actPrev ? actPrev.cumplida : false;
        const response = await fetch(`/api/actividades/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ loteId, cultivoObjetivo, tipo, productoNombre, cantidad, unidad, fecha, personal, etapa, dosificacion, metodo, cumplida: cum, notas: notesActualVal })
        });
        if (!response.ok) throw new Error("Error al actualizar actividad");
      } else {
        const nuevoId = `act-${Date.now()}`;
        const response = await fetch('/api/actividades', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: nuevoId, loteId, cultivoObjetivo, tipo, productoNombre, cantidad, unidad, fecha, personal, etapa, dosificacion, metodo, cumplida: false, notas: notesActualVal })
        });
        if (!response.ok) throw new Error("Error al crear actividad");
      }

      document.getElementById("act-modal").classList.remove("active");
      await saveState();
      showToast("Actividad agrícola registrada en agenda.");
    } catch (err) {
      console.error(err);
      alert("Error al registrar la actividad.");
    }
  });

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
