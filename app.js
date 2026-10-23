// app.js - Lógica Integral para Finca La Leonora
// Sistema de Planeación Estratégica, Proyecciones Financieras y Control Real vs. Proyección

// ==================== ESTADO GLOBAL DE LA APLICACIÓN ====================
let appData = null;
let currentHorizon = 24; // 12 o 24 meses
let activeErpModule = 'erp-hub-view'; // 'erp-hub-view', 'plan-finance-view', 'erp-agricontrol-view', 'erp-harvest-view', 'erp-ghalocafe-view', 'erp-web-view'
let activeView = 'dashboard-view';
let activeActivitySubView = 'gantt'; // 'gantt', 'kanban', 'table'
let activeFinancialSubTab = 'income'; // 'income', 'cash'
let activeControlMonthIndex = 9; // Por defecto Octubre 2026 (mes actual)
let cartItems = []; // Items en el carrito del simulador e-commerce

// Instancias de Chart.js
let chartInstances = {};

// ==================== INICIALIZACIÓN ====================
let isBackendConnected = false;

document.addEventListener("DOMContentLoaded", () => {
  initAppData();
  initTheme();
  setupEventListeners();
  populateDropdowns();
  renderAll();
  checkBackendStatus();
  switchErpModule('erp-hub-view');
  loadErpHarvestData();
  loadErpWarehouseAndStoresData();
  initSavedIframeUrls();
  checkAuthSession();
});

// Cargar datos de LocalStorage o inicializar con los de data.js
function initAppData() {
  const saved = localStorage.getItem("FINCA_LEONORA_APP_DATA");
  if (saved) {
    try {
      appData = JSON.parse(saved);
      // Sincronizar lotes y actividades enriquecidas de AgriControl BI
      if (!appData.lots || appData.lots.length !== DEFAULT_APP_DATA.lots.length) {
        appData.lots = JSON.parse(JSON.stringify(DEFAULT_APP_DATA.lots));
      }
      if (appData.activities && (!appData.activities.some(a => a.lotId) || appData.activities.length < DEFAULT_APP_DATA.activities.length)) {
        appData.activities = JSON.parse(JSON.stringify(DEFAULT_APP_DATA.activities));
      }
      if (appData.teamMembers && !appData.teamMembers.some(t => t.id === 'tm-5')) {
        appData.teamMembers = JSON.parse(JSON.stringify(DEFAULT_APP_DATA.teamMembers));
      }
      if (appData.financials && appData.financials.revenues && !appData.financials.revenues.some(r => r.name.includes("Aguacate"))) {
        appData.financials = JSON.parse(JSON.stringify(DEFAULT_APP_DATA.financials));
      }
      saveAppData();
    } catch (e) {
      console.error("Error al cargar datos guardados. Usando datos base:", e);
      appData = JSON.parse(JSON.stringify(DEFAULT_APP_DATA));
    }
  } else {
    appData = JSON.parse(JSON.stringify(DEFAULT_APP_DATA));
    saveAppData();
  }
}

function saveAppData() {
  try {
    localStorage.setItem("FINCA_LEONORA_APP_DATA", JSON.stringify(appData));
  } catch (e) {
    console.error("Error al guardar en LocalStorage:", e);
  }
}

// Comprobar estado de conexión con Neon PostgreSQL
async function checkBackendStatus() {
  const badge = document.getElementById("dbStatusBadge");
  const text = document.getElementById("dbStatusText");
  const modalBadge = document.getElementById("modalDbStatusBadge");
  const modalText = document.getElementById("modalDbStatusText");
  const modalDetails = document.getElementById("modalDbDetails");

  try {
    const res = await fetch("/api/status");
    if (!res.ok) throw new Error("Backend offline");
    const data = await res.json();

    if (data.status === 'connected') {
      isBackendConnected = true;
      if (badge) { badge.className = "db-status-badge connected"; }
      if (text) { text.textContent = "Neon DB Conectado"; }
      if (modalBadge) { modalBadge.className = "db-status-badge connected"; }
      if (modalText) { modalText.textContent = "Conectado a Neon PostgreSQL"; }
      if (modalDetails) {
        modalDetails.innerHTML = `<span style="color: #34d399;">● Conectado a base de datos: <strong>${data.database || 'Neon'}</strong></span><br>Todas las estrategias, cronograma y variaciones se guardan de forma permanente.`;
      }
    } else {
      isBackendConnected = false;
      if (badge) { badge.className = "db-status-badge offline"; }
      if (text) { text.textContent = "Modo Local (Offline)"; }
      if (modalBadge) { modalBadge.className = "db-status-badge offline"; }
      if (modalText) { modalText.textContent = "Modo Local (Sin Neon)"; }
      if (modalDetails) {
        modalDetails.innerHTML = `El servidor está activo pero la variable <code>DATABASE_URL</code> aún no ha sido configurada. Los datos se guardan en el navegador.`;
      }
    }
  } catch (e) {
    isBackendConnected = false;
    if (badge) { badge.className = "db-status-badge offline"; }
    if (text) { text.textContent = "Modo Local"; }
    if (modalBadge) { modalBadge.className = "db-status-badge offline"; }
    if (modalText) { modalText.textContent = "Servidor Offline"; }
    if (modalDetails) {
      modalDetails.textContent = "Operando en modo autónomo cliente. Puedes iniciar el servidor con 'npm start' o desplegar en Render.";
    }
  }
}

// Sincronizar con tablas existentes de café y P&G
async function triggerExternalSync() {
  showToast("Consultando tablas de Ventas de café y P&G en Neon...");
  try {
    const res = await fetch("/api/sync-external", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mesIndex: activeControlMonthIndex })
    });
    const result = await res.json();
    if (result.success) {
      showToast(`¡Sincronización exitosa! ${result.message}`);
    } else {
      showToast(`Aviso: ${result.message || 'Configura la conexión a Neon para sincronizar automáticamente'}`);
    }
  } catch (e) {
    showToast("Sincronización simulada completada (Modo Local).");
  }
}

function openDbConfigModal() {
  const modal = document.getElementById("dbModalOverlay");
  if (modal) modal.classList.add("active");
  checkBackendStatus();
}

function closeDbConfigModal() {
  const modal = document.getElementById("dbModalOverlay");
  if (modal) modal.classList.remove("active");
}

// ==================== NAVEGACIÓN Y PESTAÑAS ====================
function switchTab(viewId) {
  activeView = viewId;
  document.querySelectorAll(".view-section").forEach(sec => sec.classList.remove("active"));
  document.querySelectorAll(".nav-tab-btn").forEach(btn => btn.classList.remove("active"));

  const targetSec = document.getElementById(viewId);
  if (targetSec) targetSec.classList.add("active");

  const activeBtn = Array.from(document.querySelectorAll(".nav-tab-btn")).find(b => b.getAttribute("onclick")?.includes(viewId));
  if (activeBtn) activeBtn.classList.add("active");

  // Re-renderizar si es necesario
  if (viewId === 'dashboard-view') {
    setTimeout(renderDashboardCharts, 50);
  } else if (viewId === 'strategy-view') {
    renderStrategyPillars();
    renderObjectivesTable();
  } else if (viewId === 'activities-view') {
    renderActivities();
  } else if (viewId === 'financials-view') {
    renderFinancialTables();
  } else if (viewId === 'control-view') {
    renderControlAnalysis();
  }
}

function setHorizon(months) {
  currentHorizon = months;
  document.getElementById("horizon1YearBtn").classList.toggle("active", months === 12);
  document.getElementById("horizon2YearsBtn").classList.toggle("active", months === 24);

  const pgBadge = document.getElementById("pgHorizonBadge");
  const cashBadge = document.getElementById("cashHorizonBadge");
  const label = months === 12 ? "12 Meses (Año 2026)" : "24 Meses (2026 - 2027)";
  if (pgBadge) pgBadge.textContent = label;
  if (cashBadge) cashBadge.textContent = label;

  renderAll();
  showToast(`Horizonte ajustado a ${months === 12 ? '1 Año (12 meses)' : '2 Años (24 meses)'}`);
}

function setActivitySubView(subView) {
  activeActivitySubView = subView;
  document.getElementById("ganttViewToggleBtn").classList.toggle("active", subView === 'gantt');
  document.getElementById("kanbanViewToggleBtn").classList.toggle("active", subView === 'kanban');
  document.getElementById("tableViewToggleBtn").classList.toggle("active", subView === 'table');

  document.getElementById("activitiesGanttContainer").style.display = subView === 'gantt' ? 'block' : 'none';
  document.getElementById("activitiesKanbanContainer").style.display = subView === 'kanban' ? 'grid' : 'none';
  document.getElementById("activitiesTableContainer").style.display = subView === 'table' ? 'block' : 'none';

  renderActivities();
}

function setFinancialSubTab(subTab) {
  activeFinancialSubTab = subTab;
  document.getElementById("subTabIncomeStatement").classList.toggle("active", subTab === 'income');
  document.getElementById("subTabCashFlow").classList.toggle("active", subTab === 'cash');

  document.getElementById("incomeStatementTableWrapper").style.display = subTab === 'income' ? 'block' : 'none';
  document.getElementById("cashFlowTableWrapper").style.display = subTab === 'cash' ? 'block' : 'none';

  renderFinancialTables();
}

// ==================== RENDERS PRINCIPALES ====================
function renderAll() {
  updateDashboardKpis();
  renderDashboardCharts();
  renderStrategyPillars();
  renderObjectivesTable();
  renderActivities();
  renderFinancialTables();
  renderControlAnalysis();
}

function setupEventListeners() {
  // Configurar mes en selector de control
  const monthSelect = document.getElementById("controlMonthSelect");
  if (monthSelect) {
    monthSelect.innerHTML = appData.months.slice(0, currentHorizon).map((m, idx) => 
      `<option value="${idx}" ${idx === activeControlMonthIndex ? 'selected' : ''}>${m}</option>`
    ).join("");
  }
}

function populateDropdowns() {
  // Lotes agrícolas (AgriControl BI)
  const lotFilter = document.getElementById("filterLot");
  const modalActLot = document.getElementById("modalActivityLot");
  if (lotFilter && appData.lots) {
    lotFilter.innerHTML = `<option value="all">Todos los lotes (Finca completa)</option>` +
      appData.lots.map(l => `<option value="${l.id}">🌱 ${l.name} - ${l.crop} (${l.areaHa} Ha)</option>`).join("");
  }
  if (modalActLot && appData.lots) {
    modalActLot.innerHTML = `<option value="">General / Comercial (Sin Lote Específico)</option>` +
      appData.lots.map(l => `<option value="${l.id}">${l.name} (${l.crop} - ${l.type})</option>`).join("");
  }

  // Responsables
  const respFilter = document.getElementById("filterResponsible");
  const modalRespAct = document.getElementById("modalActivityResponsible");
  const modalRespObj = document.getElementById("modalObjectiveResponsible");

  if (respFilter) {
    respFilter.innerHTML = `<option value="all">Todos los responsables</option>` +
      appData.teamMembers.map(t => `<option value="${t.id}">${t.name} (${t.role.split("&")[0]})</option>`).join("");
  }
  if (modalRespAct) {
    modalRespAct.innerHTML = appData.teamMembers.map(t => `<option value="${t.id}">${t.name} - ${t.role}</option>`).join("");
  }
  if (modalRespObj) {
    modalRespObj.innerHTML = appData.teamMembers.map(t => `<option value="${t.id}">${t.name} - ${t.role}</option>`).join("");
  }

  // Pilares
  const pillarFilter = document.getElementById("filterPillar");
  const modalPillarObj = document.getElementById("modalObjectivePillar");
  if (pillarFilter) {
    pillarFilter.innerHTML = `<option value="all">Todos los pilares</option>` +
      appData.pillars.map(p => `<option value="${p.id}">${p.code}: ${p.name}</option>`).join("");
  }
  if (modalPillarObj) {
    modalPillarObj.innerHTML = appData.pillars.map(p => `<option value="${p.id}">${p.code} - ${p.name}</option>`).join("");
  }

  // Objetivos en modal de actividades
  const modalActObj = document.getElementById("modalActivityObjective");
  if (modalActObj) {
    modalActObj.innerHTML = appData.objectives.map(o => `<option value="${o.id}">${o.code}: ${o.name}</option>`).join("");
  }
}

// ==================== MÓDULO 1: DASHBOARD EJECUTIVO ====================
function updateDashboardKpis() {
  // Cuentas hasta el mes actual registrado (por defecto 10 meses: indices 0..9)
  const recordedCount = 10;
  let totalRevReal = 0;
  let totalRevProj = 0;
  let totalEcommerceReal = 0;
  let totalCogsReal = 0;
  let totalOpexReal = 0;

  for (let m = 0; m < recordedCount; m++) {
    appData.financials.revenues.forEach(r => {
      const realVal = r.real[m] !== null ? r.real[m] : r.projected[m];
      totalRevReal += realVal;
      totalRevProj += r.projected[m];
      if (r.isEcommerce) totalEcommerceReal += realVal;
    });

    appData.financials.cogs.forEach(c => {
      totalCogsReal += (c.real[m] !== null ? c.real[m] : c.projected[m]);
    });

    appData.financials.opexAdmin.forEach(a => {
      totalOpexReal += (a.real[m] !== null ? a.real[m] : a.projected[m]);
    });
    appData.financials.opexSales.forEach(s => {
      totalOpexReal += (s.real[m] !== null ? s.real[m] : s.projected[m]);
    });
  }

  const grossProfitReal = totalRevReal - totalCogsReal;
  const grossMarginReal = totalRevReal > 0 ? (grossProfitReal / totalRevReal) * 100 : 0;
  const ebitdaReal = grossProfitReal - totalOpexReal;
  const ecommerceShare = totalRevReal > 0 ? (totalEcommerceReal / totalRevReal) * 100 : 0;

  // Variación en Ventas
  const revDiffPct = totalRevProj > 0 ? ((totalRevReal - totalRevProj) / totalRevProj) * 100 : 0;

  // Cálculo de Saldo de Caja actual
  const cashData = calculateCashFlow();
  const currentCash = cashData.finalBalance[recordedCount - 1] || 45.0;

  // Avance del Plan Estratégico
  const totalActivities = appData.activities.length;
  const totalProgressSum = appData.activities.reduce((acc, act) => acc + (act.progress || 0), 0);
  const avgProgress = totalActivities > 0 ? (totalProgressSum / totalActivities) : 0;
  const completedCount = appData.activities.filter(a => a.status === 'completed').length;

  // Actualizar DOM
  document.getElementById("kpiTotalRevenue").textContent = `$${totalRevReal.toFixed(1)} M`;
  const trendPill = document.getElementById("kpiRevenueTrend");
  trendPill.className = `trend-pill ${revDiffPct >= 0 ? 'positive' : 'negative'}`;
  trendPill.innerHTML = `<i class="fa-solid fa-arrow-trend-${revDiffPct >= 0 ? 'up' : 'down'}"></i> ${revDiffPct >= 0 ? '+' : ''}${revDiffPct.toFixed(1)}%`;

  document.getElementById("kpiEcommerceShare").textContent = `${ecommerceShare.toFixed(1)}%`;
  document.getElementById("kpiGrossMargin").textContent = `${grossMarginReal.toFixed(1)}%`;
  document.getElementById("kpiEbitda").textContent = `$${ebitdaReal.toFixed(1)} M`;
  document.getElementById("kpiCashBalance").textContent = `$${currentCash.toFixed(1)} M`;
  document.getElementById("kpiStrategicProgress").textContent = `${avgProgress.toFixed(1)}%`;
}

function renderDashboardCharts() {
  const months = appData.months.slice(0, currentHorizon);
  
  // Datos de ingresos
  const projRevMonthly = months.map((_, i) => appData.financials.revenues.reduce((sum, r) => sum + (r.projected[i] || 0), 0));
  const realRevMonthly = months.map((_, i) => {
    const hasData = appData.financials.revenues.some(r => r.real[i] !== null);
    if (!hasData) return null;
    return appData.financials.revenues.reduce((sum, r) => sum + (r.real[i] !== null ? r.real[i] : 0), 0);
  });

  // 1. Chart: Real vs Proyección de Ingresos
  const ctxRev = document.getElementById("revenueChart");
  if (ctxRev) {
    if (chartInstances.revenue) chartInstances.revenue.destroy();
    chartInstances.revenue = new Chart(ctxRev, {
      type: 'bar',
      data: {
        labels: months,
        datasets: [
          {
            label: 'Ingresos Proyectados',
            data: projRevMonthly,
            backgroundColor: 'rgba(59, 130, 246, 0.4)',
            borderColor: '#3b82f6',
            borderWidth: 1,
            borderRadius: 4
          },
          {
            label: 'Ingresos Reales',
            data: realRevMonthly,
            backgroundColor: 'rgba(16, 185, 129, 0.85)',
            borderColor: '#10b981',
            borderWidth: 1,
            borderRadius: 4
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { labels: { color: '#94a3b8', font: { family: 'Inter', size: 11 } } },
          tooltip: {
            callbacks: {
              label: (item) => ` ${item.dataset.label}: $${item.raw !== null ? item.raw.toFixed(1) : 'Pendiente'} Millones`
            }
          }
        },
        scales: {
          x: { ticks: { color: '#64748b', font: { size: 10 } }, grid: { display: false } },
          y: {
            ticks: { color: '#64748b', font: { size: 10 }, callback: v => '$' + v + 'M' },
            grid: { color: 'rgba(255, 255, 255, 0.05)' }
          }
        }
      }
    });
  }

  // 2. Chart: Mix de Canales & E-commerce
  const ctxChannel = document.getElementById("channelMixChart");
  if (ctxChannel) {
    if (chartInstances.channel) chartInstances.channel.destroy();
    
    // Totales de ingresos proyectados por producto
    const channelTotals = appData.financials.revenues.map(r => 
      r.projected.slice(0, currentHorizon).reduce((a, b) => a + b, 0)
    );
    const channelLabels = appData.financials.revenues.map(r => r.name.split("-")[1] || r.name);

    chartInstances.channel = new Chart(ctxChannel, {
      type: 'doughnut',
      data: {
        labels: channelLabels,
        datasets: [{
          data: channelTotals,
          backgroundColor: [
            '#f59e0b',
            '#10b981',
            '#3b82f6',
            '#64748b',
            '#8b5cf6'
          ],
          borderWidth: 2,
          borderColor: '#111827'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: { color: '#94a3b8', font: { size: 10 }, boxWidth: 12 }
          }
        },
        cutout: '65%'
      }
    });
  }

  // 3. Chart: Flujo de Caja y Saldo
  const ctxCash = document.getElementById("cashFlowChart");
  if (ctxCash) {
    if (chartInstances.cash) chartInstances.cash.destroy();
    const cashData = calculateCashFlow();

    chartInstances.cash = new Chart(ctxCash, {
      type: 'line',
      data: {
        labels: months,
        datasets: [
          {
            type: 'line',
            label: 'Saldo Final de Caja ($)',
            data: cashData.finalBalance.slice(0, currentHorizon),
            borderColor: '#06b6d4',
            backgroundColor: 'rgba(6, 182, 212, 0.15)',
            fill: true,
            tension: 0.3,
            borderWidth: 2,
            pointRadius: 3
          },
          {
            type: 'bar',
            label: 'Flujo Neto Mensual',
            data: cashData.netFlow.slice(0, currentHorizon),
            backgroundColor: cashData.netFlow.slice(0, currentHorizon).map(v => v >= 0 ? 'rgba(16, 185, 129, 0.6)' : 'rgba(244, 63, 94, 0.6)'),
            borderRadius: 3
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { labels: { color: '#94a3b8', font: { size: 11 } } }
        },
        scales: {
          x: { ticks: { color: '#64748b', font: { size: 10 } }, grid: { display: false } },
          y: {
            ticks: { color: '#64748b', font: { size: 10 }, callback: v => '$' + v + 'M' },
            grid: { color: 'rgba(255, 255, 255, 0.05)' }
          }
        }
      }
    });
  }

  // 4. Chart: Cumplimiento de Actividades por Responsable
  const ctxResp = document.getElementById("responsibleChart");
  if (ctxResp) {
    if (chartInstances.responsible) chartInstances.responsible.destroy();
    
    const respNames = appData.teamMembers.map(t => t.name.split(" ")[0] + " " + (t.name.split(" ")[1] || ""));
    const completedPerResp = appData.teamMembers.map(t => 
      appData.activities.filter(a => a.responsibleId === t.id && a.status === 'completed').length
    );
    const inProgressPerResp = appData.teamMembers.map(t => 
      appData.activities.filter(a => a.responsibleId === t.id && (a.status === 'in_progress' || a.status === 'at_risk')).length
    );
    const notStartedPerResp = appData.teamMembers.map(t => 
      appData.activities.filter(a => a.responsibleId === t.id && a.status === 'not_started').length
    );

    chartInstances.responsible = new Chart(ctxResp, {
      type: 'bar',
      data: {
        labels: respNames,
        datasets: [
          { label: 'Completadas', data: completedPerResp, backgroundColor: '#10b981' },
          { label: 'En Curso', data: inProgressPerResp, backgroundColor: '#3b82f6' },
          { label: 'No Iniciadas', data: notStartedPerResp, backgroundColor: '#64748b' }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: 'y',
        plugins: {
          legend: { position: 'bottom', labels: { color: '#94a3b8', font: { size: 11 }, boxWidth: 12 } }
        },
        scales: {
          x: { stacked: true, ticks: { color: '#64748b', stepSize: 1 }, grid: { color: 'rgba(255, 255, 255, 0.05)' } },
          y: { stacked: true, ticks: { color: '#94a3b8', font: { size: 11 } }, grid: { display: false } }
        }
      }
    });
  }
}

// ==================== MÓDULO 2: ESTRATEGIA & OBJETIVOS ====================
function renderStrategyPillars() {
  const container = document.getElementById("pillarsGridContainer");
  if (!container) return;

  container.innerHTML = appData.pillars.map(p => {
    // Calcular avance promedio de actividades asociadas a este pilar
    const pilarObjs = appData.objectives.filter(o => o.pillarId === p.id);
    const pilarObjIds = pilarObjs.map(o => o.id);
    const pilarActs = appData.activities.filter(a => pilarObjIds.includes(a.objectiveId));
    
    let avgProgress = 0;
    if (pilarActs.length > 0) {
      avgProgress = pilarActs.reduce((acc, a) => acc + (a.progress || 0), 0) / pilarActs.length;
    }

    return `
      <div class="pillar-card" style="--pillar-color: ${p.color};">
        <div class="pillar-header">
          <span class="pillar-code"><i class="fa-solid ${p.icon}"></i> ${p.code}</span>
          <span class="pillar-weight">Peso: ${p.weight}%</span>
        </div>
        <h4 class="pillar-title">${p.name}</h4>
        <p class="pillar-desc">${p.description}</p>
        <div class="pillar-progress-block">
          <div class="progress-info">
            <span>Ejecución del Plan (${pilarActs.length} actividades)</span>
            <span style="color: ${p.color};">${avgProgress.toFixed(0)}%</span>
          </div>
          <div class="progress-bar-bg">
            <div class="progress-bar-fill" style="width: ${avgProgress}%; background: ${p.color};"></div>
          </div>
        </div>
      </div>
    `;
  }).join("");
}

function renderObjectivesTable() {
  const tbody = document.getElementById("objectivesTableBody");
  if (!tbody) return;

  const countBadge = document.getElementById("objectivesCountBadge");
  if (countBadge) countBadge.textContent = `${appData.objectives.length} Objetivos`;

  tbody.innerHTML = appData.objectives.map(obj => {
    const pilar = appData.pillars.find(p => p.id === obj.pillarId) || { name: 'General', color: '#f59e0b', code: 'PIL' };
    const resp = appData.teamMembers.find(t => t.id === obj.responsibleId) || { name: 'Sin asignar', avatar: 'NA' };
    
    // Cálculo % cumplimiento
    let pct = obj.targetValue > 0 ? (obj.currentValue / obj.targetValue) * 100 : 0;
    // Si la meta es reducir (como costo unitario), la lógica se invierte
    if (obj.unit.includes("COP/kg") || obj.unit.includes("% Desviación")) {
      pct = obj.currentValue > 0 ? (obj.targetValue / obj.currentValue) * 100 : 0;
    }
    pct = Math.min(Math.max(pct, 0), 120);

    const isGood = pct >= 95;
    const isMedium = pct >= 75 && pct < 95;

    return `
      <tr>
        <td><strong style="color: ${pilar.color};">${obj.code}</strong></td>
        <td><span style="font-size: 0.76rem; color: ${pilar.color}; font-weight: 600;">${pilar.name}</span></td>
        <td style="font-weight: 500; color: #fff;">${obj.name}</td>
        <td><span style="color: var(--text-muted); font-size: 0.78rem;">${obj.kpiName}</span></td>
        <td style="text-align: right; font-weight: 600;">${obj.targetValue.toLocaleString()} ${obj.unit}</td>
        <td style="text-align: right; font-weight: 700; color: #fff;">${obj.currentValue.toLocaleString()} ${obj.unit}</td>
        <td>
          <div class="responsible-avatar-badge">
            <div class="avatar-circle">${resp.avatar}</div>
            <span>${resp.name.split(" ")[0]}</span>
          </div>
        </td>
        <td style="text-align: center; color: var(--text-dim); font-size: 0.75rem;">${obj.deadline}</td>
        <td style="text-align: center;">
          <span class="trend-pill ${isGood ? 'positive' : isMedium ? 'neutral' : 'negative'}">
            ${pct.toFixed(0)}%
          </span>
        </td>
      </tr>
    `;
  }).join("");
}

// ==================== MÓDULO 3: CRONOGRAMA & ACTIVIDADES ====================
function renderActivities() {
  const lotFilterVal = document.getElementById("filterLot")?.value || 'all';
  const respFilterVal = document.getElementById("filterResponsible")?.value || 'all';
  const pillarFilterVal = document.getElementById("filterPillar")?.value || 'all';
  const statusFilterVal = document.getElementById("filterStatus")?.value || 'all';

  // Filtrado
  const filteredActivities = appData.activities.filter(act => {
    if (lotFilterVal !== 'all' && act.lotId !== lotFilterVal) return false;
    if (respFilterVal !== 'all' && act.responsibleId !== respFilterVal) return false;
    if (statusFilterVal !== 'all' && act.status !== statusFilterVal) return false;
    if (pillarFilterVal !== 'all') {
      const obj = appData.objectives.find(o => o.id === act.objectiveId);
      if (!obj || obj.pillarId !== pillarFilterVal) return false;
    }
    return true;
  });

  if (activeActivitySubView === 'gantt') {
    renderGanttView(filteredActivities);
  } else if (activeActivitySubView === 'kanban') {
    renderKanbanView(filteredActivities);
  } else {
    renderTableView(filteredActivities);
  }
}

// 1. Render Diagrama de Gantt
function renderGanttView(activities) {
  const headerContainer = document.getElementById("ganttTimelineHeader");
  const rowsContainer = document.getElementById("ganttRowsContainer");
  if (!headerContainer || !rowsContainer) return;

  const totalCols = currentHorizon;
  headerContainer.style.gridTemplateColumns = `repeat(${totalCols}, minmax(38px, 1fr))`;

  // Render cabecera mensual
  headerContainer.innerHTML = appData.months.slice(0, totalCols).map((m, idx) => {
    const isCurrent = idx === appData.farmInfo.currentMonthIndex;
    return `<div class="gantt-month-cell ${isCurrent ? 'current-month' : ''}" title="${m}">${m.split(" ")[0]}<br><span style="font-size: 0.6rem; opacity: 0.7;">'${m.split(" ")[1].slice(2)}</span></div>`;
  }).join("");

  // Base date: 2026-01-01
  const baseDate = new Date(2026, 0, 1).getTime();
  const totalDurationMs = (currentHorizon * 30.416) * 24 * 3600 * 1000;

  rowsContainer.innerHTML = activities.map(act => {
    const resp = appData.teamMembers.find(t => t.id === act.responsibleId) || { name: 'Sin asignar', avatar: 'NA' };
    const obj = appData.objectives.find(o => o.id === act.objectiveId);
    const pilar = obj ? appData.pillars.find(p => p.id === obj.pillarId) : null;
    const barColor = pilar ? pilar.color : '#f59e0b';
    const lot = appData.lots ? appData.lots.find(l => l.id === act.lotId) : null;

    // Cálculo posición Gantt
    const startMs = Math.max(new Date(act.startDate).getTime(), baseDate);
    const endMs = new Date(act.endDate).getTime();
    
    let leftPct = ((startMs - baseDate) / totalDurationMs) * 100;
    let widthPct = ((endMs - startMs) / totalDurationMs) * 100;

    leftPct = Math.max(0, Math.min(leftPct, 98));
    widthPct = Math.max(2, Math.min(widthPct, 100 - leftPct));

    return `
      <div class="gantt-row">
        <div class="gantt-task-info">
          <div class="gantt-task-title" title="${act.title}">
            <span class="activity-code-badge">${act.code}</span> ${act.title}
          </div>
          <div class="gantt-task-meta">
            ${lot ? `<span class="lot-pill" style="display: inline-flex; align-items: center; gap: 4px; background: rgba(16, 185, 129, 0.15); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.35); padding: 1px 6px; border-radius: 4px; font-size: 0.65rem; font-weight: 600;"><i class="fa-solid fa-seedling"></i> ${lot.name} (${lot.crop})</span><span>•</span>` : ''}
            <span class="responsible-avatar-badge">
              <div class="avatar-circle" style="width: 18px; height: 18px; font-size: 0.55rem;">${resp.avatar}</div>
              ${resp.name.split(" ")[0]}
            </span>
            <span>•</span>
            <span>$${act.budget || 0}M COP</span>
            <span>•</span>
            <span class="badge-status ${act.status}">${getStatusLabel(act.status)}</span>
          </div>
        </div>
        <div class="gantt-bar-area">
          <div class="gantt-bar" 
               style="left: ${leftPct}%; width: ${widthPct}%; --bar-color: ${barColor};" 
               onclick="openEditActivityModal('${act.id}')"
               title="${act.title} (${act.startDate} a ${act.endDate}) - Avance: ${act.progress}%">
            <div class="gantt-bar-progress" style="width: ${act.progress}%;"></div>
            <span style="position: relative; z-index: 2; padding-left: 2px;">${act.progress}%</span>
            <span style="position: relative; z-index: 2;"><i class="fa-solid fa-pen" style="font-size: 0.55rem; opacity: 0.6;"></i></span>
          </div>
        </div>
      </div>
    `;
  }).join("");
}

// 2. Render Tablero Kanban
function renderKanbanView(activities) {
  const cols = {
    not_started: document.getElementById("kanbanColNotStarted"),
    in_progress: document.getElementById("kanbanColInProgress"),
    at_risk: document.getElementById("kanbanColAtRisk"),
    completed: document.getElementById("kanbanColCompleted")
  };

  Object.values(cols).forEach(c => { if (c) c.innerHTML = ""; });

  const counts = { not_started: 0, in_progress: 0, at_risk: 0, completed: 0 };

  activities.forEach(act => {
    const status = act.status || 'not_started';
    if (counts[status] !== undefined) counts[status]++;

    const resp = appData.teamMembers.find(t => t.id === act.responsibleId) || { name: 'Sin asignar', avatar: 'NA' };
    const lot = appData.lots ? appData.lots.find(l => l.id === act.lotId) : null;
    const targetCol = cols[status];
    if (!targetCol) return;

    const card = document.createElement("div");
    card.className = "activity-card-kanban";
    card.onclick = () => openEditActivityModal(act.id);
    card.innerHTML = `
      <div class="kanban-card-top">
        <span class="activity-code-badge">${act.code}</span>
        <span style="font-size: 0.7rem; font-weight: 700; color: ${act.progress === 100 ? '#10b981' : '#f59e0b'};">${act.progress}%</span>
      </div>
      ${lot ? `<div style="font-size: 0.68rem; color: #10b981; font-weight: 600; margin: 3px 0;"><i class="fa-solid fa-seedling"></i> ${lot.name} • <span style="color: var(--text-dim);">${lot.crop}</span></div>` : ''}
      <div class="kanban-card-title">${act.title}</div>
      <div class="kanban-card-deliverable">
        <i class="fa-solid fa-flag-checkered" style="color: var(--primary-gold); margin-top: 2px;"></i>
        <span>${act.deliverable || 'Sin entregable'}</span>
      </div>
      <div class="kanban-card-footer">
        <div class="responsible-avatar-badge">
          <div class="avatar-circle">${resp.avatar}</div>
          <span>${resp.name.split(" ")[0]}</span>
        </div>
        <span><i class="fa-solid fa-coins"></i> $${act.budget || 0}M</span>
      </div>
    `;
    targetCol.appendChild(card);
  });

  document.getElementById("countNotStarted").textContent = counts.not_started;
  document.getElementById("countInProgress").textContent = counts.in_progress;
  document.getElementById("countAtRisk").textContent = counts.at_risk;
  document.getElementById("countCompleted").textContent = counts.completed;
}

// 3. Render Lista / Tabla Detallada
function renderTableView(activities) {
  const tbody = document.getElementById("activitiesTableListBody");
  if (!tbody) return;

  tbody.innerHTML = activities.map(act => {
    const resp = appData.teamMembers.find(t => t.id === act.responsibleId) || { name: 'Sin asignar', avatar: 'NA' };
    const lot = appData.lots ? appData.lots.find(l => l.id === act.lotId) : null;
    return `
      <tr>
        <td><strong>${act.code}</strong></td>
        <td>
          <div style="font-weight: 600; color: #fff;">${act.title}</div>
          ${lot ? `<div style="font-size: 0.72rem; color: #10b981; margin-top: 2px;"><i class="fa-solid fa-seedling"></i> ${lot.name} (${lot.crop} - ${lot.type})</div>` : ''}
          <div style="font-size: 0.72rem; color: var(--text-dim);">${act.description || ''}</div>
        </td>
        <td>
          <div class="responsible-avatar-badge">
            <div class="avatar-circle">${resp.avatar}</div>
            <span>${resp.name}</span>
          </div>
        </td>
        <td style="font-size: 0.76rem; color: var(--text-muted);">${act.deliverable || '-'}</td>
        <td style="text-align: center; font-size: 0.75rem;">${act.startDate}</td>
        <td style="text-align: center; font-size: 0.75rem;">${act.endDate}</td>
        <td style="text-align: right; font-weight: 700;">$${act.budget || 0}M</td>
        <td style="text-align: center;">
          <span style="font-weight: 700; color: #fff;">${act.progress}%</span>
        </td>
        <td style="text-align: center;">
          <span class="badge-status ${act.status}">${getStatusLabel(act.status)}</span>
        </td>
        <td style="text-align: center;">
          <button class="btn-secondary" style="padding: 0.2rem 0.5rem; font-size: 0.72rem;" onclick="openEditActivityModal('${act.id}')">
            <i class="fa-solid fa-pen"></i>
          </button>
        </td>
      </tr>
    `;
  }).join("");
}

function getStatusLabel(status) {
  switch (status) {
    case 'completed': return 'Completado';
    case 'in_progress': return 'En Curso';
    case 'at_risk': return 'En Riesgo';
    case 'not_started': return 'No Iniciado';
    default: return status;
  }
}

// ==================== MÓDULO 4: PROYECCIONES FINANCIERAS ====================
function renderFinancialTables() {
  if (activeFinancialSubTab === 'income') {
    renderIncomeStatementTable();
  } else {
    renderCashFlowTable();
  }
}

// 1. Estado de Resultados (P&G)
function renderIncomeStatementTable() {
  const table = document.getElementById("incomeStatementTable");
  if (!table) return;

  const months = appData.months.slice(0, currentHorizon);
  const totalRev = months.map((_, i) => appData.financials.revenues.reduce((s, r) => s + (r.projected[i] || 0), 0));
  const totalCogs = months.map((_, i) => appData.financials.cogs.reduce((s, c) => s + (c.projected[i] || 0), 0));
  const grossProfit = totalRev.map((r, i) => r - totalCogs[i]);
  const grossMargin = totalRev.map((r, i) => r > 0 ? (grossProfit[i] / r) * 100 : 0);

  const totalOpexAdmin = months.map((_, i) => appData.financials.opexAdmin.reduce((s, a) => s + (a.projected[i] || 0), 0));
  const totalOpexSales = months.map((_, i) => appData.financials.opexSales.reduce((s, a) => s + (a.projected[i] || 0), 0));
  const totalOpex = totalOpexAdmin.map((a, i) => a + totalOpexSales[i]);

  const ebitda = grossProfit.map((g, i) => g - totalOpex[i]);
  const ebitdaMargin = totalRev.map((r, i) => r > 0 ? (ebitda[i] / r) * 100 : 0);

  const taxRate = appData.financials.cashConfig.taxRate || 0.15;
  const taxes = ebitda.map(e => e > 0 ? e * taxRate : 0);
  const netIncome = ebitda.map((e, i) => e - taxes[i]);

  // Headers
  let headerHtml = `<thead><tr><th>Rubro Financiero (P&G Proyectado)</th>`;
  months.forEach(m => { headerHtml += `<th>${m}</th>`; });
  headerHtml += `<th class="total-year-col">Total Año 1</th>`;
  if (currentHorizon === 24) {
    headerHtml += `<th class="total-year-col">Total Año 2</th><th class="total-year-col">Total Acumulado</th>`;
  }
  headerHtml += `</tr></thead>`;

  let bodyHtml = `<tbody>`;

  // SECCIÓN 1: INGRESOS
  bodyHtml += `<tr class="section-header-row"><td colspan="${currentHorizon + 4}"><i class="fa-solid fa-arrow-up-right-dots"></i> 1. Ingresos Operacionales</td></tr>`;
  appData.financials.revenues.forEach(r => {
    bodyHtml += buildFinancialRow(r.name, r.projected, false, r.isEcommerce ? 'color: var(--primary-gold);' : '');
  });
  bodyHtml += buildFinancialRow("TOTAL INGRESOS OPERACIONALES", totalRev, true, "color: #10b981; font-size: 0.86rem;");

  // SECCIÓN 2: COSTO DE VENTAS (COGS)
  bodyHtml += `<tr class="section-header-row"><td colspan="${currentHorizon + 4}"><i class="fa-solid fa-boxes-stacked"></i> 2. Costo de Ventas (COGS)</td></tr>`;
  appData.financials.cogs.forEach(c => {
    bodyHtml += buildFinancialRow(c.name, c.projected, false);
  });
  bodyHtml += buildFinancialRow("TOTAL COSTO DE VENTAS", totalCogs, true, "color: #fb7185;");

  // UTILIDAD BRUTA
  bodyHtml += `<tr class="highlight-row">${buildFinancialRowCells("UTILIDAD BRUTA", grossProfit)}</tr>`;
  bodyHtml += buildPercentageRow("MARGEN BRUTO (%)", grossMargin);

  // SECCIÓN 3: GASTOS OPERACIONALES
  bodyHtml += `<tr class="section-header-row"><td colspan="${currentHorizon + 4}"><i class="fa-solid fa-building"></i> 3. Gastos de Administración (OPEX Admin)</td></tr>`;
  appData.financials.opexAdmin.forEach(a => {
    bodyHtml += buildFinancialRow(a.name, a.projected, false);
  });

  bodyHtml += `<tr class="section-header-row"><td colspan="${currentHorizon + 4}"><i class="fa-solid fa-bullhorn"></i> 4. Gastos de Ventas & E-commerce (OPEX Comercial)</td></tr>`;
  appData.financials.opexSales.forEach(s => {
    bodyHtml += buildFinancialRow(s.name, s.projected, false);
  });
  bodyHtml += buildFinancialRow("TOTAL GASTOS OPERACIONALES", totalOpex, true, "color: #60a5fa;");

  // EBITDA
  bodyHtml += `<tr class="highlight-row" style="background: rgba(245, 158, 11, 0.12); color: #fbbf24;">${buildFinancialRowCells("EBITDA (UTILIDAD OPERACIONAL)", ebitda)}</tr>`;
  bodyHtml += buildPercentageRow("MARGEN EBITDA (%)", ebitdaMargin);

  // IMPUESTOS Y UTILIDAD NETA
  bodyHtml += buildFinancialRow("Provisión de Impuestos Estimada", taxes, false, "color: var(--text-dim);");
  bodyHtml += `<tr class="highlight-row">${buildFinancialRowCells("UTILIDAD NETA PROYECTADA", netIncome)}</tr>`;

  bodyHtml += `</tbody>`;
  table.innerHTML = headerHtml + bodyHtml;
}

// 2. Flujo de Caja Proyectado
function renderCashFlowTable() {
  const table = document.getElementById("cashFlowTable");
  if (!table) return;

  const months = appData.months.slice(0, currentHorizon);
  const cashData = calculateCashFlow();

  let headerHtml = `<thead><tr><th>Concepto de Flujo de Caja</th>`;
  months.forEach(m => { headerHtml += `<th>${m}</th>`; });
  headerHtml += `<th class="total-year-col">Año 1</th>`;
  if (currentHorizon === 24) {
    headerHtml += `<th class="total-year-col">Año 2</th><th class="total-year-col">Total</th>`;
  }
  headerHtml += `</tr></thead>`;

  let bodyHtml = `<tbody>`;

  // Saldo Inicial
  bodyHtml += `<tr class="subtotal-row"><td><strong>(+) SALDO INICIAL DE CAJA</strong></td>`;
  months.forEach((_, i) => { bodyHtml += `<td class="num-cell" style="font-weight: 700; color: #06b6d4;">$${cashData.initialBalance[i].toFixed(1)}</td>`; });
  bodyHtml += `<td class="total-year-col">$${cashData.initialBalance[0].toFixed(1)}</td>`;
  if (currentHorizon === 24) {
    bodyHtml += `<td class="total-year-col">$${cashData.initialBalance[12].toFixed(1)}</td><td class="total-year-col">-</td>`;
  }
  bodyHtml += `</tr>`;

  // Entradas operativas
  bodyHtml += `<tr class="section-header-row"><td colspan="${currentHorizon + 4}"><i class="fa-solid fa-arrow-down"></i> Entradas de Efectivo (Ventas E-commerce & Canales)</td></tr>`;
  bodyHtml += buildFinancialRow("Cobros de Clientes y Recaudo Inmediato Web", cashData.cashInflows, false);

  // Salidas operativas
  bodyHtml += `<tr class="section-header-row"><td colspan="${currentHorizon + 4}"><i class="fa-solid fa-arrow-up"></i> Salidas Operativas (Insumos, Jornales y Nómina)</td></tr>`;
  bodyHtml += buildFinancialRow("Pagos Proveedores, Mano de Obra y OPEX", cashData.cashOutflows, false);

  // Flujo Operativo
  bodyHtml += buildFinancialRow("(=) FLUJO OPERATIVO NETO", cashData.operatingFlow, true, "color: #10b981;");

  // CAPEX
  bodyHtml += `<tr class="section-header-row"><td colspan="${currentHorizon + 4}"><i class="fa-solid fa-hammer"></i> Inversiones de Capital (CAPEX Finca & Web)</td></tr>`;
  appData.financials.capex.forEach(cap => {
    bodyHtml += buildFinancialRow(cap.name, cap.projected, false);
  });
  bodyHtml += buildFinancialRow("TOTAL CAPEX (INVERSIONES)", cashData.totalCapex, true, "color: #fb7185;");

  // Deuda
  bodyHtml += buildFinancialRow("Servicio de Deuda / Cuotas Bancarias", appData.financials.cashConfig.debtServiceMonthly, false);

  // Flujo Neto del Período
  bodyHtml += `<tr class="highlight-row" style="background: rgba(59, 130, 246, 0.15); color: #60a5fa;">${buildFinancialRowCells("FLUJO NETO DEL PERÍODO", cashData.netFlow)}</tr>`;

  // Saldo Final
  bodyHtml += `<tr class="highlight-row" style="background: rgba(6, 182, 212, 0.2); color: #22d3ee;">${buildFinancialRowCells("(=) SALDO FINAL DE CAJA Y BANCOS", cashData.finalBalance)}</tr>`;

  bodyHtml += `</tbody>`;
  table.innerHTML = headerHtml + bodyHtml;
}

// Motor de cálculo de Flujo de Caja
function calculateCashFlow() {
  const months = appData.months.slice(0, currentHorizon);
  const initialCashStart = appData.financials.cashConfig.initialCashBalance || 42.0;
  
  const cashInflows = months.map((_, i) => appData.financials.revenues.reduce((s, r) => s + (r.projected[i] || 0), 0));
  const totalCogs = months.map((_, i) => appData.financials.cogs.reduce((s, c) => s + (c.projected[i] || 0), 0));
  const totalOpexAdmin = months.map((_, i) => appData.financials.opexAdmin.reduce((s, a) => s + (a.projected[i] || 0), 0));
  const totalOpexSales = months.map((_, i) => appData.financials.opexSales.reduce((s, a) => s + (a.projected[i] || 0), 0));
  const cashOutflows = totalCogs.map((c, i) => c + totalOpexAdmin[i] + totalOpexSales[i]);

  const operatingFlow = cashInflows.map((cin, i) => cin - cashOutflows[i]);
  const totalCapex = months.map((_, i) => appData.financials.capex.reduce((s, cap) => s + (cap.projected[i] || 0), 0));
  const debt = appData.financials.cashConfig.debtServiceMonthly.slice(0, currentHorizon);

  const netFlow = operatingFlow.map((op, i) => op - totalCapex[i] - (debt[i] || 0));

  const initialBalance = [];
  const finalBalance = [];

  let runningCash = initialCashStart;
  for (let i = 0; i < currentHorizon; i++) {
    initialBalance.push(runningCash);
    runningCash = runningCash + netFlow[i];
    finalBalance.push(runningCash);
  }

  return {
    initialBalance,
    cashInflows,
    cashOutflows,
    operatingFlow,
    totalCapex,
    debt,
    netFlow,
    finalBalance
  };
}

// Helpers para construir filas de tablas
function buildFinancialRow(title, dataArr, isSubtotal = false, customStyle = "") {
  let rowClass = isSubtotal ? "subtotal-row" : "";
  let html = `<tr class="${rowClass}">`;
  html += `<td style="${customStyle}">${isSubtotal ? '<strong>' + title + '</strong>' : title}</td>`;

  const values = dataArr.slice(0, currentHorizon);
  values.forEach(v => {
    html += `<td class="num-cell">$${v.toFixed(1)}</td>`;
  });

  // Totales
  const sumYear1 = values.slice(0, 12).reduce((a, b) => a + b, 0);
  html += `<td class="total-year-col num-cell">$${sumYear1.toFixed(1)}</td>`;

  if (currentHorizon === 24) {
    const sumYear2 = values.slice(12, 24).reduce((a, b) => a + b, 0);
    const sumTotal = sumYear1 + sumYear2;
    html += `<td class="total-year-col num-cell">$${sumYear2.toFixed(1)}</td>`;
    html += `<td class="total-year-col num-cell">$${sumTotal.toFixed(1)}</td>`;
  }

  html += `</tr>`;
  return html;
}

function buildFinancialRowCells(title, dataArr) {
  let html = `<td><strong>${title}</strong></td>`;
  const values = dataArr.slice(0, currentHorizon);
  values.forEach(v => {
    html += `<td class="num-cell" style="font-weight: 700;">$${v.toFixed(1)}</td>`;
  });
  const sumYear1 = values.slice(0, 12).reduce((a, b) => a + b, 0);
  html += `<td class="total-year-col num-cell">$${sumYear1.toFixed(1)}</td>`;

  if (currentHorizon === 24) {
    const sumYear2 = values.slice(12, 24).reduce((a, b) => a + b, 0);
    const sumTotal = sumYear1 + sumYear2;
    html += `<td class="total-year-col num-cell">$${sumYear2.toFixed(1)}</td>`;
    html += `<td class="total-year-col num-cell">$${sumTotal.toFixed(1)}</td>`;
  }
  return html;
}

function buildPercentageRow(title, dataArr) {
  let html = `<tr style="background: rgba(255, 255, 255, 0.02); font-style: italic;">`;
  html += `<td style="color: var(--text-muted);">${title}</td>`;
  const values = dataArr.slice(0, currentHorizon);
  values.forEach(v => {
    html += `<td class="num-cell" style="color: #fbbf24;">${v.toFixed(1)}%</td>`;
  });
  const avgYear1 = values.slice(0, 12).reduce((a, b) => a + b, 0) / 12;
  html += `<td class="total-year-col num-cell" style="color: #fbbf24;">${avgYear1.toFixed(1)}%</td>`;

  if (currentHorizon === 24) {
    const avgYear2 = values.slice(12, 24).reduce((a, b) => a + b, 0) / 12;
    const avgTotal = (avgYear1 + avgYear2) / 2;
    html += `<td class="total-year-col num-cell" style="color: #fbbf24;">${avgYear2.toFixed(1)}%</td>`;
    html += `<td class="total-year-col num-cell" style="color: #fbbf24;">${avgTotal.toFixed(1)}%</td>`;
  }
  html += `</tr>`;
  return html;
}

// ==================== MÓDULO 5: CONTROL REAL VS PROYECCIÓN ====================
function renderControlAnalysis() {
  const select = document.getElementById("controlMonthSelect");
  if (!select) return;
  activeControlMonthIndex = parseInt(select.value) || 0;

  const mName = appData.months[activeControlMonthIndex];
  document.getElementById("controlCurrentMonthLabel").textContent = mName;

  const mIdx = activeControlMonthIndex;

  // Cálculos del mes
  let mRevProj = 0, mRevReal = 0;
  let mCogsProj = 0, mCogsReal = 0;
  let mOpexProj = 0, mOpexReal = 0;

  appData.financials.revenues.forEach(r => {
    mRevProj += (r.projected[mIdx] || 0);
    mRevReal += (r.real[mIdx] !== null ? r.real[mIdx] : r.projected[mIdx]);
  });

  appData.financials.cogs.forEach(c => {
    mCogsProj += (c.projected[mIdx] || 0);
    mCogsReal += (c.real[mIdx] !== null ? c.real[mIdx] : c.projected[mIdx]);
  });

  appData.financials.opexAdmin.forEach(a => {
    mOpexProj += (a.projected[mIdx] || 0);
    mOpexReal += (a.real[mIdx] !== null ? a.real[mIdx] : a.projected[mIdx]);
  });
  appData.financials.opexSales.forEach(s => {
    mOpexProj += (s.projected[mIdx] || 0);
    mOpexReal += (s.real[mIdx] !== null ? s.real[mIdx] : s.projected[mIdx]);
  });

  const mEbitdaProj = (mRevProj - mCogsProj) - mOpexProj;
  const mEbitdaReal = (mRevReal - mCogsReal) - mOpexReal;

  // Actualizar Cards del mes
  updateControlSummaryCard("controlMonthRevenue", "controlRevenueVariance", mRevReal, mRevProj, true);
  updateControlSummaryCard("controlMonthCogs", "controlCogsVariance", mCogsReal, mCogsProj, false);
  updateControlSummaryCard("controlMonthOpex", "controlOpexVariance", mOpexReal, mOpexProj, false);
  updateControlSummaryCard("controlMonthEbitda", "controlEbitdaVariance", mEbitdaReal, mEbitdaProj, true);

  // Renderizar tabla detallada de variaciones
  renderVarianceTable(mIdx);
}

function updateControlSummaryCard(valId, trendId, realVal, projVal, higherIsBetter) {
  document.getElementById(valId).textContent = `$${realVal.toFixed(1)} M`;
  const diff = realVal - projVal;
  const diffPct = projVal !== 0 ? (diff / Math.abs(projVal)) * 100 : 0;

  let isFavorable = higherIsBetter ? diff >= 0 : diff <= 0;
  let pillClass = isFavorable ? 'positive' : Math.abs(diffPct) < 8 ? 'neutral' : 'negative';

  const trendEl = document.getElementById(trendId);
  if (trendEl) {
    trendEl.innerHTML = `
      <span class="trend-pill ${pillClass}">
        ${diff >= 0 ? '+' : ''}${diff.toFixed(1)}M (${diffPct >= 0 ? '+' : ''}${diffPct.toFixed(1)}%)
      </span>
      <span class="kpi-context">Proy: $${projVal.toFixed(1)}M</span>
    `;
  }
}

function renderVarianceTable(mIdx) {
  const tbody = document.getElementById("controlVarianceTableBody");
  if (!tbody) return;

  let html = "";

  // 1. INGRESOS
  html += `<tr class="section-header-row"><td colspan="7"><i class="fa-solid fa-arrow-up-right-dots"></i> Ingresos Operacionales</td></tr>`;
  appData.financials.revenues.forEach(r => {
    html += buildVarianceRow(r.id, "rev", r.name, r.projected[mIdx], r.real[mIdx], true);
  });

  // 2. COSTO DE VENTAS
  html += `<tr class="section-header-row"><td colspan="7"><i class="fa-solid fa-boxes-stacked"></i> Costo de Ventas (COGS)</td></tr>`;
  appData.financials.cogs.forEach(c => {
    html += buildVarianceRow(c.id, "cog", c.name, c.projected[mIdx], c.real[mIdx], false);
  });

  // 3. GASTOS OPEX ADMIN
  html += `<tr class="section-header-row"><td colspan="7"><i class="fa-solid fa-building"></i> Gastos de Administración</td></tr>`;
  appData.financials.opexAdmin.forEach(a => {
    html += buildVarianceRow(a.id, "adm", a.name, a.projected[mIdx], a.real[mIdx], false);
  });

  // 4. GASTOS OPEX VENTAS
  html += `<tr class="section-header-row"><td colspan="7"><i class="fa-solid fa-bullhorn"></i> Gastos de Ventas & Marketing</td></tr>`;
  appData.financials.opexSales.forEach(s => {
    html += buildVarianceRow(s.id, "sal", s.name, s.projected[mIdx], s.real[mIdx], false);
  });

  tbody.innerHTML = html;
}

function buildVarianceRow(itemId, type, name, projected, real, higherIsBetter) {
  const currentReal = (real !== null && real !== undefined) ? real : projected;
  const diff = currentReal - projected;
  const diffPct = projected !== 0 ? (diff / projected) * 100 : 0;

  // Lógica de semáforo
  let trafficClass = "green";
  let statusBadge = "fav";
  let statusText = "Favorable";

  if (higherIsBetter) {
    if (diff >= 0) {
      trafficClass = "green"; statusBadge = "fav"; statusText = "En Meta / +" + diffPct.toFixed(1) + "%";
    } else if (diffPct >= -8) {
      trafficClass = "yellow"; statusBadge = "warning"; statusText = "Alerta Leve (" + diffPct.toFixed(1) + "%)";
    } else {
      trafficClass = "red"; statusBadge = "unfav"; statusText = "Desviación Crítica";
    }
  } else {
    // Para costos: menor es mejor
    if (diff <= 0) {
      trafficClass = "green"; statusBadge = "fav"; statusText = "Ahorro / Favorable";
    } else if (diffPct <= 8) {
      trafficClass = "yellow"; statusBadge = "warning"; statusText = "Sobrecosto Leve (+" + diffPct.toFixed(1) + "%)";
    } else {
      trafficClass = "red"; statusBadge = "unfav"; statusText = "Sobrecosto Crítico";
    }
  }

  return `
    <tr>
      <td style="font-weight: 500;">${name}</td>
      <td class="num-cell" style="color: var(--text-muted);">$${projected.toFixed(1)}M</td>
      <td style="text-align: right;">
        <input type="number" step="0.1" class="editable-real-input" 
               id="inputReal_${type}_${itemId}" 
               value="${currentReal.toFixed(1)}" 
               data-type="${type}" data-id="${itemId}">
      </td>
      <td class="num-cell" style="font-weight: 700; color: ${diff >= 0 ? '#34d399' : '#fb7185'};">
        ${diff >= 0 ? '+' : ''}$${diff.toFixed(1)}M
      </td>
      <td class="num-cell" style="font-weight: 700;">
        ${diffPct >= 0 ? '+' : ''}${diffPct.toFixed(1)}%
      </td>
      <td style="text-align: center;">
        <span class="variance-badge ${statusBadge}">
          <span class="traffic-light ${trafficClass}"></span> ${statusText}
        </span>
      </td>
      <td>
        <input type="text" class="form-input" style="padding: 0.2rem 0.5rem; font-size: 0.74rem;" 
               placeholder="Anotar causa o plan de acción..." value="">
      </td>
    </tr>
  `;
}

// Guardar cifras reales ingresadas en la tabla
function saveRealDataFromInputs() {
  const mIdx = activeControlMonthIndex;
  const inputs = document.querySelectorAll(".editable-real-input");

  inputs.forEach(inp => {
    const type = inp.dataset.type;
    const id = inp.dataset.id;
    const val = parseFloat(inp.value);

    if (isNaN(val)) return;

    if (type === 'rev') {
      const item = appData.financials.revenues.find(r => r.id === id);
      if (item) item.real[mIdx] = val;
    } else if (type === 'cog') {
      const item = appData.financials.cogs.find(c => c.id === id);
      if (item) item.real[mIdx] = val;
    } else if (type === 'adm') {
      const item = appData.financials.opexAdmin.find(a => a.id === id);
      if (item) item.real[mIdx] = val;
    } else if (type === 'sal') {
      const item = appData.financials.opexSales.find(s => s.id === id);
      if (item) item.real[mIdx] = val;
    }
  });

  saveAppData();
  updateDashboardKpis();
  renderDashboardCharts();
  renderControlAnalysis();
  showToast("¡Cifras reales actualizadas y guardadas con éxito!");
}

// ==================== MODALES & CRUD DE ACTIVIDADES Y OBJETIVOS ====================
function openNewActivityModal() {
  document.getElementById("activityModalTitle").textContent = "Registrar Nueva Actividad Estratégica";
  document.getElementById("modalActivityId").value = "";
  document.getElementById("modalActivityTitle").value = "";
  if (document.getElementById("modalActivityLot")) document.getElementById("modalActivityLot").value = "";
  document.getElementById("modalActivityDescription").value = "";
  document.getElementById("modalActivityDeliverable").value = "";
  document.getElementById("modalActivityStartDate").value = "2026-11-01";
  document.getElementById("modalActivityEndDate").value = "2027-02-28";
  document.getElementById("modalActivityBudget").value = "10.0";
  document.getElementById("modalActivityProgress").value = "0";
  document.getElementById("modalActivityStatus").value = "not_started";

  document.getElementById("activityModalOverlay").classList.add("active");
}

function openEditActivityModal(activityId) {
  const act = appData.activities.find(a => a.id === activityId);
  if (!act) return;

  document.getElementById("activityModalTitle").textContent = `Editar Actividad: ${act.code}`;
  document.getElementById("modalActivityId").value = act.id;
  document.getElementById("modalActivityTitle").value = act.title;
  document.getElementById("modalActivityObjective").value = act.objectiveId;
  document.getElementById("modalActivityResponsible").value = act.responsibleId;
  if (document.getElementById("modalActivityLot")) document.getElementById("modalActivityLot").value = act.lotId || "";
  document.getElementById("modalActivityDescription").value = act.description || "";
  document.getElementById("modalActivityDeliverable").value = act.deliverable || "";
  document.getElementById("modalActivityStartDate").value = act.startDate;
  document.getElementById("modalActivityEndDate").value = act.endDate;
  document.getElementById("modalActivityBudget").value = act.budget || 0;
  document.getElementById("modalActivityProgress").value = act.progress || 0;
  document.getElementById("modalActivityStatus").value = act.status || "not_started";

  document.getElementById("activityModalOverlay").classList.add("active");
}

function closeActivityModal() {
  document.getElementById("activityModalOverlay").classList.remove("active");
}

function saveActivityFromModal() {
  const id = document.getElementById("modalActivityId").value;
  const title = document.getElementById("modalActivityTitle").value.trim();
  const objId = document.getElementById("modalActivityObjective").value;
  const respId = document.getElementById("modalActivityResponsible").value;
  const lotId = document.getElementById("modalActivityLot") ? document.getElementById("modalActivityLot").value : null;
  const desc = document.getElementById("modalActivityDescription").value.trim();
  const deliverable = document.getElementById("modalActivityDeliverable").value.trim();
  const startDate = document.getElementById("modalActivityStartDate").value;
  const endDate = document.getElementById("modalActivityEndDate").value;
  const budget = parseFloat(document.getElementById("modalActivityBudget").value) || 0;
  const progress = parseInt(document.getElementById("modalActivityProgress").value) || 0;
  const status = document.getElementById("modalActivityStatus").value;

  if (!title || !startDate || !endDate) {
    alert("Por favor completa el título y las fechas de inicio y fin.");
    return;
  }

  if (id) {
    // Editar
    const act = appData.activities.find(a => a.id === id);
    if (act) {
      act.title = title;
      act.objectiveId = objId;
      act.responsibleId = respId;
      act.lotId = lotId || null;
      act.description = desc;
      act.deliverable = deliverable;
      act.startDate = startDate;
      act.endDate = endDate;
      act.budget = budget;
      act.progress = progress;
      act.status = status;
    }
  } else {
    // Nueva
    const newCode = `ACT-${String(appData.activities.length + 1).padStart(2, '0')}`;
    const newAct = {
      id: "act-" + Date.now(),
      code: newCode,
      title,
      objectiveId: objId,
      responsibleId: respId,
      lotId: lotId || null,
      description: desc,
      deliverable,
      startDate,
      endDate,
      budget,
      progress,
      status
    };
    appData.activities.push(newAct);
  }

  saveAppData();
  closeActivityModal();
  renderActivities();
  updateDashboardKpis();
  renderDashboardCharts();
  renderStrategyPillars();
  showToast("Actividad guardada exitosamente");
}

// Modal Objetivos
function openNewObjectiveModal() {
  document.getElementById("modalObjectiveName").value = "";
  document.getElementById("modalObjectiveKpi").value = "";
  document.getElementById("modalObjectiveUnit").value = "%";
  document.getElementById("modalObjectiveTarget").value = "100";
  document.getElementById("modalObjectiveCurrent").value = "0";
  document.getElementById("modalObjectiveDeadline").value = "Dic 2026";
  document.getElementById("objectiveModalOverlay").classList.add("active");
}

function closeObjectiveModal() {
  document.getElementById("objectiveModalOverlay").classList.remove("active");
}

function saveObjectiveFromModal() {
  const pilarId = document.getElementById("modalObjectivePillar").value;
  const name = document.getElementById("modalObjectiveName").value.trim();
  const kpiName = document.getElementById("modalObjectiveKpi").value.trim();
  const unit = document.getElementById("modalObjectiveUnit").value.trim() || "%";
  const targetValue = parseFloat(document.getElementById("modalObjectiveTarget").value) || 0;
  const currentValue = parseFloat(document.getElementById("modalObjectiveCurrent").value) || 0;
  const responsibleId = document.getElementById("modalObjectiveResponsible").value;
  const deadline = document.getElementById("modalObjectiveDeadline").value.trim() || "2026";

  if (!name || !kpiName) {
    alert("Por favor completa el nombre del objetivo y del KPI.");
    return;
  }

  const pilar = appData.pillars.find(p => p.id === pilarId);
  const pilarCodeNum = pilar ? pilar.code.replace("PIL-0", "") : "1";
  const newObjCode = `OBJ-${pilarCodeNum}.${appData.objectives.length + 1}`;

  const newObj = {
    id: "obj-" + Date.now(),
    pillarId,
    code: newObjCode,
    name,
    kpiName,
    targetValue,
    currentValue,
    unit,
    responsibleId,
    deadline
  };

  appData.objectives.push(newObj);
  saveAppData();
  closeObjectiveModal();
  populateDropdowns();
  renderStrategyPillars();
  renderObjectivesTable();
  showToast("Nuevo objetivo estratégico agregado");
}

// ==================== EXPORTACIÓN & RESPALDO ====================
function exportToExcel() {
  if (typeof XLSX === 'undefined') {
    alert("Cargando librería Excel, por favor intenta en unos segundos.");
    return;
  }

  const wb = XLSX.utils.book_new();

  // 1. Hoja P&G Proyectado
  const months = appData.months.slice(0, currentHorizon);
  const pgData = [
    ["FINCA LA LEONORA - ESTADO DE RESULTADOS PROYECTADO", ...months.map(() => "")],
    ["Cifras en Millones de Pesos Colombianos (COP)"],
    [],
    ["Rubro Financiero", ...months, "Total Año 1", ...(currentHorizon === 24 ? ["Total Año 2", "Total Acumulado"] : [])]
  ];

  // Ingresos
  appData.financials.revenues.forEach(r => {
    const vals = r.projected.slice(0, currentHorizon);
    const sum1 = vals.slice(0, 12).reduce((a, b) => a + b, 0);
    const row = [r.name, ...vals, sum1];
    if (currentHorizon === 24) {
      const sum2 = vals.slice(12, 24).reduce((a, b) => a + b, 0);
      row.push(sum2, sum1 + sum2);
    }
    pgData.push(row);
  });

  // Costos
  pgData.push(["--- COSTO DE VENTAS (COGS) ---"]);
  appData.financials.cogs.forEach(c => {
    const vals = c.projected.slice(0, currentHorizon);
    const sum1 = vals.slice(0, 12).reduce((a, b) => a + b, 0);
    const row = [c.name, ...vals, sum1];
    if (currentHorizon === 24) {
      const sum2 = vals.slice(12, 24).reduce((a, b) => a + b, 0);
      row.push(sum2, sum1 + sum2);
    }
    pgData.push(row);
  });

  const wsPG = XLSX.utils.aoa_to_sheet(pgData);
  XLSX.utils.book_append_sheet(wb, wsPG, "P&G Proyectado");

  // 2. Hoja Cronograma de Actividades
  const actData = [
    ["CRONOGRAMA Y CONTROL DE ACTIVIDADES - FINCA LA LEONORA"],
    [],
    ["Código", "Iniciativa", "Responsable", "Entregable", "Inicio", "Fin", "Presupuesto (Millones COP)", "Avance (%)", "Estado"]
  ];

  appData.activities.forEach(a => {
    const resp = appData.teamMembers.find(t => t.id === a.responsibleId) || { name: 'Sin asignar' };
    actData.push([
      a.code,
      a.title,
      resp.name,
      a.deliverable || "",
      a.startDate,
      a.endDate,
      a.budget || 0,
      a.progress || 0,
      getStatusLabel(a.status)
    ]);
  });

  const wsAct = XLSX.utils.aoa_to_sheet(actData);
  XLSX.utils.book_append_sheet(wb, wsAct, "Cronograma y Actividades");

  // Descarga
  XLSX.writeFile(wb, `Planeacion_Estrategica_Finca_La_Leonora_${new Date().toISOString().slice(0, 10)}.xlsx`);
  showToast("Archivo Excel generado y descargado");
}

function exportBackupJSON() {
  const jsonStr = JSON.stringify(appData, null, 2);
  const blob = new Blob([jsonStr], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Respaldo_Finca_La_Leonora_${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast("Respaldo JSON descargado correctamente");
}

function openImportModal() {
  document.getElementById("importModalOverlay").classList.add("active");
}

function closeImportModal() {
  document.getElementById("importModalOverlay").classList.remove("active");
}

function processImportFile() {
  const fileInput = document.getElementById("importFileInput");
  if (!fileInput.files || fileInput.files.length === 0) {
    alert("Por favor selecciona un archivo JSON válido.");
    return;
  }

  const file = fileInput.files[0];
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const parsed = JSON.parse(e.target.result);
      if (!parsed.farmInfo || !parsed.financials) {
        throw new Error("El archivo no tiene el formato esperado del sistema.");
      }
      appData = parsed;
      saveAppData();
      closeImportModal();
      populateDropdowns();
      renderAll();
      showToast("¡Datos restaurados con éxito desde el archivo!");
    } catch (err) {
      alert("Error al procesar el archivo: " + err.message);
    }
  };
  reader.readAsText(file);
}

function resetToFactoryDefault() {
  if (confirm("¿Estás seguro de restablecer todos los datos al estado de fábrica de Finca La Leonora? Se perderán las modificaciones no respaldadas.")) {
    appData = JSON.parse(JSON.stringify(DEFAULT_APP_DATA));
    saveAppData();
    closeImportModal();
    populateDropdowns();
    renderAll();
    showToast("Sistema restablecido con los datos originales de Finca La Leonora");
  }
}

// Tema Claro / Oscuro
function initTheme() {
  const isLight = localStorage.getItem("FINCA_LEONORA_THEME") === "light";
  if (isLight) {
    document.body.classList.add("light-theme");
    updateThemeIcon(true);
  }
}

function toggleTheme() {
  const isLight = document.body.classList.toggle("light-theme");
  localStorage.setItem("FINCA_LEONORA_THEME", isLight ? "light" : "dark");
  updateThemeIcon(isLight);
}

function updateThemeIcon(isLight) {
  const btn = document.getElementById("themeToggleBtn");
  if (btn) {
    btn.innerHTML = `<i class="fa-solid fa-${isLight ? 'sun' : 'moon'}"></i>`;
  }
}

// Toast Notificaciones
function showToast(message) {
  const container = document.getElementById("toastContainer");
  if (!container) return;

  const toast = document.createElement("div");
  toast.className = "toast";
  toast.innerHTML = `<i class="fa-solid fa-circle-check" style="color: #10b981;"></i> <span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateX(50px)";
    toast.style.transition = "all 0.3s ease";
    setTimeout(() => toast.remove(), 300);
  }, 3200);
}

// ==================== LÓGICA DE LA SUITE ERP UNIFICADA ====================

function switchErpModule(moduleId) {
  // Mapear compatibilidad de vista web -> inventario
  if (moduleId === 'erp-web-view') moduleId = 'erp-inventory-view';
  activeErpModule = moduleId;

  // Barra de píldoras ERP: en el Portal de Aplicaciones (erp-hub-view) la ocultamos para mantener la pantalla 100% limpia
  const suiteBar = document.querySelector('.erp-suite-bar');
  if (suiteBar) {
    suiteBar.style.display = (moduleId === 'erp-hub-view') ? 'none' : 'flex';
  }

  // Actualizar píldoras del selector
  document.querySelectorAll('.erp-suite-pill').forEach(btn => btn.classList.remove('active'));
  const activeBtn = document.querySelector(`.erp-suite-pill[onclick*="${moduleId}"]`);
  if (activeBtn) activeBtn.classList.add('active');

  // Ocultar todas las secciones de módulos
  document.querySelectorAll('.erp-module-section').forEach(sec => sec.style.display = 'none');

  // Mostrar el módulo seleccionado
  const target = document.getElementById(moduleId);
  if (target) {
    target.style.display = 'block';
  }

  // Sub-navbar de Planeación (Dashboard, Estrategia, Gantt, P&G, Control) solo visible en su módulo
  const planSubNav = document.getElementById('planSubNav');
  if (planSubNav) {
    planSubNav.style.display = (moduleId === 'plan-finance-view') ? 'flex' : 'none';
  }

  // Desplazar suavemente a la parte superior de la vista
  window.scrollTo({ top: 0, behavior: 'smooth' });

  // Acciones al cambiar de módulo
  if (moduleId === 'plan-finance-view') {
    switchTab(activeView);
  } else if (moduleId === 'erp-hub-view') {
    // Portal de Aplicaciones
  } else if (moduleId === 'erp-harvest-view') {
    loadErpHarvestData();
  } else if (moduleId === 'erp-ghalocafe-view') {
    loadErpWarehouseAndStoresData();
  }
}

// ==================== GESTIÓN DE APLICACIONES EMBEBIDAS (SUITE ERP) ====================

// 1. AgriControl BI
function reloadAgriIframe() {
  const frame = document.getElementById('agriIframe');
  if (frame) {
    frame.src = frame.src;
    showToast('Recargando AgriControl BI...');
  }
}

function toggleAgriDetails() {
  const cards = document.getElementById('agriCardsContainer');
  const btn = document.getElementById('btnToggleAgriDetails');
  if (cards) {
    const isHidden = (cards.style.display === 'none' || !cards.style.display);
    cards.style.display = isHidden ? 'block' : 'none';
    if (btn) {
      btn.innerHTML = isHidden ? '<i class="fa-solid fa-window-minimize"></i> Ocultar Fichas Lotes' : '<i class="fa-solid fa-table-cells"></i> Fichas de Lotes & Suelo';
    }
  }
}

// 2. Control de Productividad
function reloadHarvestIframe() {
  const frame = document.getElementById('harvestIframe');
  if (frame) {
    frame.src = frame.src;
    showToast('Recargando Control de Productividad...');
  }
}

function updateHarvestIframeUrl(url) {
  if (!url) return;
  const frame = document.getElementById('harvestIframe');
  const link = document.getElementById('harvestExternalLink');
  if (frame) frame.src = url;
  if (link) link.href = url;
  localStorage.setItem('FINCA_HARVEST_URL', url);
  showToast('URL de Control de Productividad actualizada');
}

function toggleHarvestDetails() {
  const container = document.getElementById('harvestDataContainer');
  const btn = document.getElementById('btnToggleHarvestDetails');
  if (container) {
    const isHidden = (container.style.display === 'none' || !container.style.display);
    container.style.display = isHidden ? 'block' : 'none';
    if (btn) {
      btn.innerHTML = isHidden ? '<i class="fa-solid fa-window-minimize"></i> Ocultar Datos Neon' : '<i class="fa-solid fa-database"></i> Datos de Báscula Neon';
    }
  }
}

// 3. Sistema GhaloCafe
function reloadGhaloIframe() {
  const frame = document.getElementById('ghaloIframe');
  if (frame) {
    frame.src = frame.src;
    showToast('Recargando Sistema GhaloCafe...');
  }
}

function updateGhaloIframeUrl(url) {
  if (!url) return;
  const frame = document.getElementById('ghaloIframe');
  const link = document.getElementById('ghaloExternalLink');
  if (frame) frame.src = url;
  if (link) link.href = url;
  localStorage.setItem('FINCA_GHALO_URL', url);
  showToast('URL de Sistema GhaloCafe actualizada');
}

function toggleGhaloDetails() {
  const container = document.getElementById('ghaloDataContainer');
  const btn = document.getElementById('btnToggleGhaloDetails');
  if (container) {
    const isHidden = (container.style.display === 'none' || !container.style.display);
    container.style.display = isHidden ? 'block' : 'none';
    if (btn) {
      btn.innerHTML = isHidden ? '<i class="fa-solid fa-window-minimize"></i> Ocultar Inventario' : '<i class="fa-solid fa-store"></i> Inventario & Bodegas';
    }
  }
}

// 4. GhaloInv (Inventarios & Bodega)
function reloadInvIframe() {
  const frame = document.getElementById('invIframe');
  if (frame) {
    frame.src = frame.src;
    showToast('Recargando GhaloInv Inventarios...');
  }
}

function updateInvIframeUrl(url) {
  if (!url) return;
  const frame = document.getElementById('invIframe');
  const link = document.getElementById('invExternalLink');
  if (frame) frame.src = url;
  if (link) link.href = url;
  localStorage.setItem('FINCA_INV_URL', url);
  showToast('URL de GhaloInv actualizada');
}

function reloadWebIframe() {
  reloadInvIframe();
}

function updateWebIframeUrl(url) {
  updateInvIframeUrl(url);
}

function toggleWebSimulator() {
  const container = document.getElementById('webSimulatorContainer');
  const btn = document.getElementById('btnToggleWebSim');
  if (container) {
    const isHidden = (container.style.display === 'none' || !container.style.display);
    container.style.display = isHidden ? 'block' : 'none';
    if (btn) {
      btn.innerHTML = isHidden ? '<i class="fa-solid fa-window-minimize"></i> Ocultar Vitrina' : '<i class="fa-solid fa-cart-shopping"></i> Vitrina de Productos';
    }
  }
}

function initSavedIframeUrls() {
  // URLs por defecto oficiales
  const defaultHarvestUrl = 'https://control-productividad-app.onrender.com/';
  const defaultGhaloUrl = 'https://sistema-ghalocafe.onrender.com';
  const defaultInvUrl = 'https://ghaloinv-app.onrender.com';

  const harvestUrl = localStorage.getItem('FINCA_HARVEST_URL') || defaultHarvestUrl;
  const harvestInput = document.getElementById('harvestAppUrlInput');
  const harvestFrame = document.getElementById('harvestIframe');
  const harvestLink = document.getElementById('harvestExternalLink');
  if (harvestInput) harvestInput.value = harvestUrl;
  if (harvestFrame && harvestFrame.src !== harvestUrl) harvestFrame.src = harvestUrl;
  if (harvestLink) harvestLink.href = harvestUrl;

  const ghaloUrl = localStorage.getItem('FINCA_GHALO_URL') || defaultGhaloUrl;
  const ghaloInput = document.getElementById('ghaloAppUrlInput');
  const ghaloFrame = document.getElementById('ghaloIframe');
  const ghaloLink = document.getElementById('ghaloExternalLink');
  if (ghaloInput) ghaloInput.value = ghaloUrl;
  if (ghaloFrame && ghaloFrame.src !== ghaloUrl) ghaloFrame.src = ghaloUrl;
  if (ghaloLink) ghaloLink.href = ghaloUrl;

  const invUrl = localStorage.getItem('FINCA_INV_URL') || defaultInvUrl;
  const invInput = document.getElementById('invAppUrlInput');
  const invFrame = document.getElementById('invIframe');
  const invLink = document.getElementById('invExternalLink');
  if (invInput) invInput.value = invUrl;
  if (invFrame && invFrame.src !== invUrl) invFrame.src = invUrl;
  if (invLink) invLink.href = invUrl;
}

// Cargar datos consolidados para el Hub Central
async function loadErpConsolidatedData() {
  try {
    const res = await fetch('/api/erp/consolidated');
    if (!res.ok) return;
    const data = await res.json();
    if (data.harvestStats) {
      const kgEl = document.getElementById('hubKpiHarvestKg');
      if (kgEl && data.harvestStats.total_kilos_cereza) {
        kgEl.textContent = `${Number(data.harvestStats.total_kilos_cereza).toLocaleString()} kg`;
      }
    }
  } catch (e) {
    console.log('Modo local en Hub ERP');
  }
}

// Cargar datos de Cosecha & Recolección (Neon DB con fallback instantáneo)
async function loadErpHarvestData() {
  const defaultStats = { total_recolecciones: 310, total_kilos_cereza: 13296, promedio_pase_kilos: 42.9 };
  const defaultRecoles = [
    { nombre: 'DIEGO CHAVEZ', pases: 62, total_kilos: 3240, promedio_kilos: 52.2 },
    { nombre: 'NORBERTO', pases: 58, total_kilos: 2980, promedio_kilos: 51.4 },
    { nombre: 'SELSO', pases: 54, total_kilos: 2750, promedio_kilos: 50.9 },
    { nombre: 'JAVIER', pases: 49, total_kilos: 2460, promedio_kilos: 50.2 }
  ];
  const defaultRecent = [
    { id: 'cmuwtfv1i0008', fecha: '2026-09-29', recolector: 'DIEGO CHAVEZ', lote: 'Lote Amelia', kilos: 45 },
    { id: 'cmuwte8iq0007', fecha: '2026-09-29', recolector: 'JAVIER', lote: 'Lote Amelia', kilos: 34 },
    { id: 'cmuwtdxcw0006', fecha: '2026-09-29', recolector: 'NORBERTO', lote: 'Lote Manuela', kilos: 42 }
  ];

  function renderHarvestUI(stats, recoles, ultimos) {
    const kgEl = document.getElementById('harvestTotalKg');
    const entriesEl = document.getElementById('harvestTotalEntries');
    const avgEl = document.getElementById('harvestAvgKg');
    if (kgEl) kgEl.textContent = `${Number(stats.total_kilos_cereza).toLocaleString()} kg`;
    if (entriesEl) entriesEl.textContent = `${stats.total_recolecciones} Pases`;
    if (avgEl) avgEl.textContent = `${stats.promedio_pase_kilos} kg`;

    const tbody = document.getElementById('harvestCollectorsTableBody');
    if (tbody && recoles) {
      tbody.innerHTML = recoles.map(r => `
        <tr>
          <td><strong>${r.nombre}</strong></td>
          <td style="text-align: center;">${r.pases}</td>
          <td style="text-align: right; font-weight: 700; color: #10b981;">${Number(r.total_kilos).toLocaleString()} kg</td>
          <td style="text-align: right;">${Number(r.promedio_kilos).toFixed(1)} kg</td>
          <td style="text-align: center;"><span class="trend-pill positive">Al Día</span></td>
        </tr>
      `).join('');
    }

    const recentBody = document.getElementById('harvestRecentEntriesBody');
    if (recentBody && ultimos) {
      recentBody.innerHTML = ultimos.map(rec => `
        <tr>
          <td><code style="font-size: 0.75rem; color: #94a3b8;">${rec.id.slice(0, 10)}...</code></td>
          <td>${rec.fecha}</td>
          <td><strong>${rec.recolector}</strong></td>
          <td><span class="badge-tag" style="background: rgba(16, 185, 129, 0.15); color: #10b981;">${rec.lote}</span></td>
          <td style="text-align: right; font-weight: 700; color: #fff;">${rec.kilos} kg</td>
          <td style="text-align: center;"><span class="badge-status completed">Pesado</span></td>
        </tr>
      `).join('');
    }
  }

  // Render inicial inmediato
  renderHarvestUI(defaultStats, defaultRecoles, defaultRecent);

  // Intentar refrescar desde API en vivo de Neon
  try {
    const res = await fetch('/api/erp/harvest');
    if (!res.ok) return;
    const data = await res.json();
    if (data.stats) {
      renderHarvestUI(data.stats, data.recolectores, data.ultimosRegistros);
    }
  } catch (e) {
    // Operando con dataset local
  }
}

// Cargar datos de Bodega y Tiendas GhaloCafe (con fallback instantáneo)
async function loadErpWarehouseAndStoresData() {
  const defaultStores = [
    { id: 'st-1', name: 'Bodega Principal La Leonora', city: 'Palestina (Caldas)', type: 'Origen & Distribución', stockKilos: 480, manager: 'Mauricio Guzmán' },
    { id: 'st-2', name: 'Punto La Florida', city: 'Manizales', type: 'Tienda Boutique', stockKilos: 145, manager: 'Juanita Hernández' },
    { id: 'st-3', name: 'Punto Villamaría', city: 'Villamaría', type: 'Punto de Venta Directo', stockKilos: 95, manager: 'Distribución Eje' },
    { id: 'st-4', name: 'Punto Dosquebradas', city: 'Dosquebradas / Pereira', type: 'Punto Regional', stockKilos: 120, manager: 'Aliado Cafetero' },
    { id: 'st-5', name: 'Punto Urapanes', city: 'Manizales', type: 'Café & Experiencia', stockKilos: 80, manager: 'Juanita Hernández' }
  ];

  const defaultProducts = [
    { sku: 'GH-M250', name: 'GhaloCafe Real Molido 250g', price: 18500, category: 'Especial' },
    { sku: 'GH-M454', name: 'GhaloCafe Real Molido 454g (Libra)', price: 32000, category: 'Especial' },
    { sku: 'GH-G250', name: 'GhaloCafe Real Grano 250g', price: 18500, category: 'Especial' },
    { sku: 'GH-G454', name: 'GhaloCafe Real Grano 454g (Libra)', price: 32000, category: 'Especial' },
    { sku: 'GH-G2500', name: 'GhaloCafe Real Grano 2.500g Institucional', price: 165000, category: 'Institucional/HORECA' }
  ];

  const defaultShipments = [
    { id: 'cmuwts58g000b', fecha: '2026-10-03', tipo: 'PASILLA', destino: 'VENTA_COOPERATIVA', metodo_beneficio: 'LAVADO', cantidad: 72 },
    { id: 'cmuwtrrw8000a', fecha: '2026-10-03', tipo: 'PERGAMINO_SECO', destino: 'VENTA_COOPERATIVA', metodo_beneficio: 'LAVADO', cantidad: 53 },
    { id: 'cmuvppnnb0004', fecha: '2026-10-02', tipo: 'PERGAMINO_SECO', destino: 'TOSTION', metodo_beneficio: 'FERMENTADO', cantidad: 37 }
  ];

  function renderStoresUI(stores, products, shipments) {
    const storesContainer = document.getElementById('storesGridContainer');
    if (storesContainer && stores) {
      storesContainer.innerHTML = stores.map(st => `
        <div class="store-card">
          <span class="store-card-city"><i class="fa-solid fa-location-dot"></i> ${st.city}</span>
          <h4 class="store-card-name">${st.name}</h4>
          <div style="font-size: 0.72rem; color: var(--text-dim); margin-bottom: 0.5rem;">${st.type} • Encargado: ${st.manager}</div>
          <div style="display: flex; justify-content: space-between; align-items: flex-end; border-top: 1px solid rgba(255, 255, 255, 0.05); padding-top: 0.5rem;">
            <div>
              <div style="font-size: 0.65rem; color: var(--text-muted); text-transform: uppercase;">Stock Disponible</div>
              <div class="store-card-stock">${st.stockKilos} kg</div>
            </div>
            <span class="trend-pill positive"><i class="fa-solid fa-check"></i> Activo</span>
          </div>
        </div>
      `).join('');
    }

    const catalogContainer = document.getElementById('productsCatalogContainer');
    if (catalogContainer && products) {
      catalogContainer.innerHTML = products.map(prod => `
        <div class="product-card-erp">
          <div>
            <span class="product-sku">SKU: ${prod.sku}</span>
            <h4 class="product-name">${prod.name}</h4>
            <span class="badge-tag" style="font-size: 0.65rem; background: rgba(245, 158, 11, 0.15); color: #fbbf24;">${prod.category}</span>
          </div>
          <div style="margin-top: 1rem; display: flex; justify-content: space-between; align-items: center; border-top: 1px solid rgba(255, 255, 255, 0.05); padding-top: 0.75rem;">
            <span class="product-price">$${prod.price.toLocaleString()} COP</span>
            <button class="btn-secondary" style="padding: 0.25rem 0.6rem; font-size: 0.72rem;" onclick="addToCart('${prod.sku}', '${prod.name}', ${prod.price})">
              <i class="fa-solid fa-cart-plus"></i> Pedir
            </button>
          </div>
        </div>
      `).join('');
    }

    const tbody = document.getElementById('warehouseShipmentsBody');
    if (tbody && shipments) {
      tbody.innerHTML = shipments.map(sal => `
        <tr>
          <td><code style="font-size: 0.75rem; color: #94a3b8;">${sal.id.slice(0, 10)}...</code></td>
          <td>${sal.fecha}</td>
          <td><strong>${sal.tipo}</strong></td>
          <td><span class="badge-tag" style="background: ${sal.destino === 'TOSTION' ? 'rgba(245, 158, 11, 0.2)' : 'rgba(16, 185, 129, 0.2)'}; color: ${sal.destino === 'TOSTION' ? '#fbbf24' : '#10b981'};">${sal.destino}</span></td>
          <td>${sal.metodo_beneficio || 'TRADICIONAL'}</td>
          <td style="text-align: right; font-weight: 700; color: #fff;">${sal.cantidad} kg</td>
        </tr>
      `).join('');
    }
  }

  // Render inicial inmediato
  renderStoresUI(defaultStores, defaultProducts, defaultShipments);

  // Intentar refrescar desde API
  try {
    const [whRes, stRes] = await Promise.all([fetch('/api/erp/warehouse'), fetch('/api/erp/stores')]);
    if (whRes.ok && stRes.ok) {
      const whData = await whRes.json();
      const stData = await stRes.json();
      const tostionEl = document.getElementById('ghaloTostionKg');
      const coopEl = document.getElementById('ghaloCoopKg');
      if (tostionEl && whData.stats) tostionEl.textContent = `${Number(whData.stats.kilos_tostion).toLocaleString()} kg`;
      if (coopEl && whData.stats) coopEl.textContent = `${Number(whData.stats.kilos_cooperativa).toLocaleString()} kg`;
      renderStoresUI(stData.stores, stData.products, whData.ultimasSalidas);
    }
  } catch (e) {
    // Operando con dataset local
  }
}

// ==================== CARRITO & TIENDA E-COMMERCE B2C ====================

function addToCart(sku, name, price) {
  const existing = cartItems.find(i => i.sku === sku);
  if (existing) {
    existing.quantity++;
  } else {
    cartItems.push({ sku, name, price, quantity: 1 });
  }
  renderCart();
  showToast(`¡Agregado ${name} al carrito!`);
}

function removeFromCart(sku) {
  cartItems = cartItems.filter(i => i.sku !== sku);
  renderCart();
}

function renderCart() {
  const container = document.getElementById('cartItemsContainer');
  const countBadge = document.getElementById('cartCountBadge');
  const subtotalEl = document.getElementById('cartSubtotal');
  const totalEl = document.getElementById('cartTotal');

  if (!container) return;

  const totalCount = cartItems.reduce((acc, i) => acc + i.quantity, 0);
  const totalAmount = cartItems.reduce((acc, i) => acc + (i.price * i.quantity), 0);

  if (countBadge) countBadge.textContent = `${totalCount} Presentaciones`;
  if (subtotalEl) subtotalEl.textContent = `$${totalAmount.toLocaleString()} COP`;
  if (totalEl) totalEl.textContent = `$${totalAmount.toLocaleString()} COP`;

  if (cartItems.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; color: var(--text-dim); font-size: 0.82rem; padding: 2rem 0;">
        <i class="fa-solid fa-basket-shopping" style="font-size: 2rem; margin-bottom: 0.5rem; opacity: 0.4;"></i><br>
        El carrito está vacío.<br>Agrega presentaciones de GhaloCafe.
      </div>
    `;
    return;
  }

  container.innerHTML = cartItems.map(item => `
    <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.06); border-radius: var(--radius-sm); padding: 0.5rem 0.75rem;">
      <div>
        <div style="font-weight: 600; font-size: 0.8rem; color: #fff;">${item.name}</div>
        <div style="font-size: 0.7rem; color: var(--text-dim);">$${item.price.toLocaleString()} COP &times; ${item.quantity} un.</div>
      </div>
      <div style="display: flex; align-items: center; gap: 0.5rem;">
        <span style="font-weight: 700; color: var(--primary-gold); font-size: 0.85rem;">$${(item.price * item.quantity).toLocaleString()}</span>
        <button style="background: none; border: none; color: #fb7185; cursor: pointer; font-size: 0.8rem;" onclick="removeFromCart('${item.sku}')">
          <i class="fa-solid fa-trash-can"></i>
        </button>
      </div>
    </div>
  `).join('');
}

function simulateCheckout() {
  if (cartItems.length === 0) {
    alert('Tu carrito de compras está vacío. Agrega productos de GhaloCafe antes de finalizar el pedido.');
    return;
  }

  const totalAmount = cartItems.reduce((acc, i) => acc + (i.price * i.quantity), 0);
  alert(`¡Pedido simulado con éxito por valor de $${totalAmount.toLocaleString()} COP!\n\nEste pedido se registra como venta del canal E-Commerce B2C y suma directamente a la meta del 45% del Plan Estratégico de Finca La Leonora.`);

  cartItems = [];
  renderCart();
  showToast('¡Orden e-commerce registrada con éxito!');
}

// ==================== SEGURIDAD & AUTENTICACIÓN ERP ====================
let currentAuthUser = null;

async function checkAuthSession() {
  const token = localStorage.getItem('leonora_erp_token');
  const loginModal = document.getElementById('erp-login-modal');
  const userSessionWrapper = document.getElementById('erpUserSessionWrapper');

  if (!token) {
    if (loginModal) loginModal.style.display = 'flex';
    if (userSessionWrapper) userSessionWrapper.style.display = 'none';
    return false;
  }

  try {
    const res = await fetch('/api/auth/me', {
      headers: {
        'Authorization': 'Bearer ' + token
      }
    });

    if (res.ok) {
      const data = await res.json();
      currentAuthUser = data.user;
      updateUserSessionUI(data.user);
      if (loginModal) loginModal.style.display = 'none';
      return true;
    } else {
      localStorage.removeItem('leonora_erp_token');
      localStorage.removeItem('leonora_erp_user');
      if (loginModal) loginModal.style.display = 'flex';
      if (userSessionWrapper) userSessionWrapper.style.display = 'none';
      return false;
    }
  } catch (err) {
    console.warn('No se pudo verificar token en el servidor, usando cache si existe:', err);
    const savedUser = localStorage.getItem('leonora_erp_user');
    if (savedUser) {
      try {
        currentAuthUser = JSON.parse(savedUser);
        updateUserSessionUI(currentAuthUser);
        if (loginModal) loginModal.style.display = 'none';
        return true;
      } catch (e) {}
    }
    if (loginModal) loginModal.style.display = 'flex';
    return false;
  }
}

function updateUserSessionUI(user) {
  const wrapper = document.getElementById('erpUserSessionWrapper');
  const nameLabel = document.getElementById('userNameLabel');
  const avatarText = document.getElementById('userAvatarText');
  const dropdownFullName = document.getElementById('userDropdownFullName');
  const dropdownRole = document.getElementById('userDropdownRole');
  const dropdownUsername = document.getElementById('userDropdownUsername');

  if (wrapper) wrapper.style.display = 'block';

  if (user) {
    const displayName = user.nombre_completo || user.username || 'Usuario';
    const parts = displayName.trim().split(' ');
    const initials = (parts[0][0] + (parts.length > 1 ? parts[1][0] : '')).toUpperCase();

    if (avatarText) avatarText.textContent = initials;
    if (nameLabel) nameLabel.textContent = parts[0] + (parts.length > 1 ? ' ' + parts[1][0] + '.' : '');
    if (dropdownFullName) dropdownFullName.textContent = displayName;
    if (dropdownRole) dropdownRole.textContent = user.rol === 'admin' ? 'Gerencia General' : 'Operaciones';
    if (dropdownUsername) dropdownUsername.textContent = '@' + user.username;
  }
}

async function handleErpLogin(event) {
  if (event) event.preventDefault();

  const usernameInput = document.getElementById('loginUsername');
  const passwordInput = document.getElementById('loginPassword');
  const alertBox = document.getElementById('loginAlertBox');
  const alertText = document.getElementById('loginAlertText');
  const submitBtn = document.getElementById('btnLoginSubmit');

  const username = usernameInput ? usernameInput.value.trim() : '';
  const password = passwordInput ? passwordInput.value : '';

  if (!username || !password) {
    if (alertBox) {
      alertText.textContent = 'Por favor ingresa usuario y contraseña';
      alertBox.style.display = 'flex';
    }
    return;
  }

  if (alertBox) alertBox.style.display = 'none';
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Validando credenciales...';
  }

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    const data = await res.json();

    if (res.ok && data.success) {
      localStorage.setItem('leonora_erp_token', data.token);
      localStorage.setItem('leonora_erp_user', JSON.stringify(data.user));
      currentAuthUser = data.user;
      updateUserSessionUI(data.user);

      const loginModal = document.getElementById('erp-login-modal');
      if (loginModal) {
        loginModal.style.transition = 'opacity 0.25s ease';
        loginModal.style.opacity = '0';
        setTimeout(() => {
          loginModal.style.display = 'none';
          loginModal.style.opacity = '1';
        }, 250);
      }

      showToast(`¡Bienvenido a la Suite ERP, ${data.user.nombre_completo || data.user.username}!`, 'success');
    } else {
      if (alertBox) {
        alertText.textContent = data.error || 'Usuario o contraseña incorrectos';
        alertBox.style.display = 'flex';
      }
    }
  } catch (err) {
    console.error('Error al iniciar sesión:', err);
    if (alertBox) {
      alertText.textContent = 'Error de conexión con el servidor de autenticación';
      alertBox.style.display = 'flex';
    }
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<i class="fa-solid fa-right-to-bracket"></i> Iniciar Sesión en la Suite';
    }
  }
}

function toggleLoginPasswordVisibility() {
  const passwordInput = document.getElementById('loginPassword');
  const icon = document.getElementById('togglePasswordIcon');
  if (!passwordInput) return;

  if (passwordInput.type === 'password') {
    passwordInput.type = 'text';
    if (icon) {
      icon.classList.remove('fa-eye');
      icon.classList.add('fa-eye-slash');
    }
  } else {
    passwordInput.type = 'password';
    if (icon) {
      icon.classList.remove('fa-eye-slash');
      icon.classList.add('fa-eye');
    }
  }
}

function fillDefaultCredentials() {
  const usernameInput = document.getElementById('loginUsername');
  const passwordInput = document.getElementById('loginPassword');
  if (usernameInput) usernameInput.value = 'admin';
  if (passwordInput) passwordInput.value = 'Leonora2026*';
}

function toggleUserMenu() {
  const menu = document.getElementById('userDropdownMenu');
  if (!menu) return;
  menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
}

document.addEventListener('click', (e) => {
  const wrapper = document.getElementById('erpUserSessionWrapper');
  const menu = document.getElementById('userDropdownMenu');
  if (wrapper && menu && !wrapper.contains(e.target)) {
    menu.style.display = 'none';
  }
});

function openChangePasswordModal() {
  const menu = document.getElementById('userDropdownMenu');
  if (menu) menu.style.display = 'none';
  const modal = document.getElementById('modalChangePassword');
  const alert = document.getElementById('changePasswordAlert');
  if (alert) alert.style.display = 'none';
  if (modal) modal.style.display = 'flex';
}

function closeChangePasswordModal() {
  const modal = document.getElementById('modalChangePassword');
  if (modal) modal.style.display = 'none';
  const form = document.getElementById('formChangePassword');
  if (form) form.reset();
}

async function handleChangePasswordSubmit(event) {
  if (event) event.preventDefault();

  const oldPassword = document.getElementById('inputOldPassword').value;
  const newPassword = document.getElementById('inputNewPassword').value;
  const confirmPassword = document.getElementById('inputConfirmPassword').value;
  const alertBox = document.getElementById('changePasswordAlert');
  const alertText = document.getElementById('changePasswordAlertText');
  const submitBtn = document.getElementById('btnSubmitChangePassword');
  const token = localStorage.getItem('leonora_erp_token');

  if (newPassword !== confirmPassword) {
    if (alertBox) {
      alertText.textContent = 'La confirmación no coincide con la nueva contraseña';
      alertBox.style.display = 'flex';
    }
    return;
  }

  if (newPassword.length < 6) {
    if (alertBox) {
      alertText.textContent = 'La nueva contraseña debe tener al menos 6 caracteres';
      alertBox.style.display = 'flex';
    }
    return;
  }

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Guardando...';
  }

  try {
    const res = await fetch('/api/auth/change-password', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token
      },
      body: JSON.stringify({ oldPassword, newPassword })
    });

    const data = await res.json();
    if (res.ok && data.success) {
      closeChangePasswordModal();
      showToast('¡Contraseña actualizada con éxito!', 'success');
    } else {
      if (alertBox) {
        alertText.textContent = data.error || 'No se pudo actualizar la contraseña';
        alertBox.style.display = 'flex';
      }
    }
  } catch (err) {
    if (alertBox) {
      alertText.textContent = 'Error de conexión al cambiar la contraseña';
      alertBox.style.display = 'flex';
    }
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Guardar Nueva Contraseña';
    }
  }
}

function logoutErp() {
  localStorage.removeItem('leonora_erp_token');
  localStorage.removeItem('leonora_erp_user');
  currentAuthUser = null;

  const userSessionWrapper = document.getElementById('erpUserSessionWrapper');
  if (userSessionWrapper) userSessionWrapper.style.display = 'none';

  const menu = document.getElementById('userDropdownMenu');
  if (menu) menu.style.display = 'none';

  const loginModal = document.getElementById('erp-login-modal');
  if (loginModal) loginModal.style.display = 'flex';

  const passwordInput = document.getElementById('loginPassword');
  if (passwordInput) passwordInput.value = '';

  showToast('Has cerrado sesión de manera segura', 'info');
}

