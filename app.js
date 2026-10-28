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
let isAppSuiteUnlocked = false;

document.addEventListener("DOMContentLoaded", async () => {
  initTheme();
  // Blindaje de seguridad: la Suite ERP no se inicializa ni se muestra hasta validar credenciales
  const isAuthenticated = await checkAuthSession();
  if (isAuthenticated) {
    unlockAppSuite();
  } else {
    lockAppSuite();
  }
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
      headers: getAuthHeaders(),
      body: JSON.stringify({ mesIndex: activeControlMonthIndex })
    });
    if (res.status === 401) {
      logoutErp();
      return;
    }
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

  const isEmbedded = ['erp-agricontrol-view', 'erp-harvest-view', 'erp-ghalocafe-view', 'erp-inventory-view'].includes(moduleId);

  // Auto-compactar la cabecera cuando se navega dentro de un módulo embebido para ganar espacio vertical
  if (isEmbedded) {
    document.body.classList.add('compact-header-mode');
  } else {
    document.body.classList.remove('compact-header-mode');
  }

  // Controles exclusivos de Planeación Financiera (1-2 Años, Excel, Respaldo, Restaurar)
  const planOnlyControls = document.getElementById('planOnlyHeaderControls');
  if (planOnlyControls) {
    planOnlyControls.style.display = (moduleId === 'plan-finance-view') ? 'inline-flex' : 'none';
  }

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
  } else if (moduleId === 'erp-agricontrol-view') {
    ensureIframeLoaded('agriIframe', '/modules/agri-control-bi/index.html');
  } else if (moduleId === 'erp-harvest-view') {
    ensureIframeLoaded('harvestIframe', 'https://control-productividad-app.onrender.com');
  } else if (moduleId === 'erp-ghalocafe-view') {
    ensureIframeLoaded('ghaloIframe', 'https://sistema-ghalocafe.onrender.com');
  } else if (moduleId === 'erp-inventory-view') {
    ensureIframeLoaded('invIframe', 'https://ghaloinv-app.onrender.com');
  }
}

function ensureIframeLoaded(iframeId, defaultUrl) {
  const frame = document.getElementById(iframeId);
  if (!frame) return;
  const targetSrc = frame.dataset.src || defaultUrl;
  if (!frame.src || frame.src === 'about:blank' || frame.src.endsWith('about:blank')) {
    frame.src = targetSrc;
  }
}

// ==================== MODO PANTALLA COMPLETA / ZEN DE MÓDULOS EMBEBIDOS ====================
function toggleIframeFullscreen(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const isZen = container.classList.toggle('fullscreen-zen');
  const btn = container.querySelector('.btn-fullscreen-toggle');
  if (btn) {
    if (isZen) {
      btn.innerHTML = '<i class="fa-solid fa-compress"></i> <span>Salir (Esc)</span>';
      btn.title = 'Salir del modo pantalla completa (o presiona tecla Esc)';
      showToast('Modo Pantalla Completa activado. Presiona Esc para salir.');
    } else {
      btn.innerHTML = '<i class="fa-solid fa-expand"></i> <span>Maximizar</span>';
      btn.title = 'Maximizar pantalla completa';
    }
  }
}

// Salir del modo pantalla completa al presionar Escape
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    const zenContainers = document.querySelectorAll('.embedded-iframe-container.fullscreen-zen');
    zenContainers.forEach(container => {
      container.classList.remove('fullscreen-zen');
      const btn = container.querySelector('.btn-fullscreen-toggle');
      if (btn) {
        btn.innerHTML = '<i class="fa-solid fa-expand"></i> <span>Maximizar</span>';
        btn.title = 'Maximizar pantalla completa';
      }
    });
  }
});

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
  // URLs oficiales de la suite
  const defaultHarvestUrl = 'https://control-productividad-app.onrender.com';
  const defaultGhaloUrl = 'https://sistema-ghalocafe.onrender.com';
  const defaultInvUrl = 'https://ghaloinv-app.onrender.com';

  let harvestUrl = localStorage.getItem('FINCA_HARVEST_URL') || defaultHarvestUrl;
  if (harvestUrl.startsWith('/modules/control-productividad')) {
    harvestUrl = defaultHarvestUrl;
    localStorage.setItem('FINCA_HARVEST_URL', harvestUrl);
  }
  const harvestInput = document.getElementById('harvestAppUrlInput');
  const harvestFrame = document.getElementById('harvestIframe');
  const harvestLink = document.getElementById('harvestExternalLink');
  if (harvestInput) harvestInput.value = harvestUrl;
  if (harvestFrame) {
    harvestFrame.dataset.src = harvestUrl;
    if (isAppSuiteUnlocked) harvestFrame.src = harvestUrl;
  }
  if (harvestLink) harvestLink.href = harvestUrl;

  let ghaloUrl = localStorage.getItem('FINCA_GHALO_URL') || defaultGhaloUrl;
  if (ghaloUrl.startsWith('/modules/ghalocafe')) {
    ghaloUrl = defaultGhaloUrl;
    localStorage.setItem('FINCA_GHALO_URL', ghaloUrl);
  }
  const ghaloInput = document.getElementById('ghaloAppUrlInput');
  const ghaloFrame = document.getElementById('ghaloIframe');
  const ghaloLink = document.getElementById('ghaloExternalLink');
  if (ghaloInput) ghaloInput.value = ghaloUrl;
  if (ghaloFrame) {
    ghaloFrame.dataset.src = ghaloUrl;
    if (isAppSuiteUnlocked) ghaloFrame.src = ghaloUrl;
  }
  if (ghaloLink) ghaloLink.href = ghaloUrl;

  let invUrl = localStorage.getItem('FINCA_INV_URL') || defaultInvUrl;
  if (invUrl.startsWith('/modules/ghaloinv')) {
    invUrl = defaultInvUrl;
    localStorage.setItem('FINCA_INV_URL', invUrl);
  }
  const invInput = document.getElementById('invAppUrlInput');
  const invFrame = document.getElementById('invIframe');
  const invLink = document.getElementById('invExternalLink');
  if (invInput) invInput.value = invUrl;
  if (invFrame) {
    invFrame.dataset.src = invUrl;
    if (isAppSuiteUnlocked) invFrame.src = invUrl;
  }
  if (invLink) invLink.href = invUrl;
}

// Cargar datos consolidados para el Hub Central
async function loadErpConsolidatedData() {
  try {
    const res = await fetch('/api/erp/consolidated', { headers: getAuthHeaders() });
    if (res.status === 401) { logoutErp(); return; }
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

// ==================== MÓDULO NATIVO DE CONTROL DE PRODUCTIVIDAD (NEON DB) ====================

let currentLotesList = [];
let currentRecosList = [];

function switchProdTab(tabId) {
  document.querySelectorAll('.prod-subtab-pane').forEach(el => el.style.display = 'none');
  const target = document.getElementById(tabId);
  if (target) target.style.display = 'block';

  const map = {
    'tab-prod-bascula': 'btnTabProdBascula',
    'tab-prod-recolectores': 'btnTabProdRecos',
    'tab-prod-procesos': 'btnTabProdProcesos',
    'tab-prod-bodega': 'btnTabProdBodega'
  };
  Object.keys(map).forEach(k => {
    const btn = document.getElementById(map[k]);
    if (btn) btn.classList.toggle('active', k === tabId);
  });
}

// Cargar datos y poblar formularios y tablas de Productividad desde Neon
async function loadProductividadData() {
  const today = new Date().toISOString().split('T')[0];
  ['inputPesajeFecha', 'lavadoFecha', 'fermFecha', 'bodegaFecha'].forEach(id => {
    const el = document.getElementById(id);
    if (el && !el.value) el.value = today;
  });

  try {
    const res = await fetch('/api/productividad/bootstrap', { headers: getAuthHeaders() });
    if (res.status === 401) { logoutErp(); return; }
    if (!res.ok) throw new Error('Error al cargar datos de productividad');

    const data = await res.json();
    if (!data.success) return;

    currentLotesList = data.lotes || [];
    currentRecosList = data.recolectores || [];

    // 1. Dropdowns de Lotes
    const loteSelects = ['selectPesajeLote', 'lavadoLote', 'fermLote'];
    loteSelects.forEach(selId => {
      const sel = document.getElementById(selId);
      if (sel) {
        sel.innerHTML = '<option value="">-- Seleccionar Lote --</option>' + 
          currentLotesList.map(l => `<option value="${l.id}">${l.nombre}</option>`).join('');
      }
    });

    // 2. Dropdown de Recolectores
    const recoSelect = document.getElementById('selectPesajeRecolector');
    if (recoSelect) {
      recoSelect.innerHTML = '<option value="">-- Seleccionar Recolector --</option>' + 
        currentRecosList.filter(r => r.activo).map(r => `<option value="${r.id}">${r.nombre}</option>`).join('');
    }

    // 3. Render de KPIs de Cosecha
    if (data.harvest && data.harvest.stats) {
      const stats = data.harvest.stats;
      const kgEl = document.getElementById('harvestTotalKg');
      const entriesEl = document.getElementById('harvestTotalEntries');
      const avgEl = document.getElementById('harvestAvgKg');
      const recosEl = document.getElementById('harvestTotalRecosActive');

      if (kgEl) kgEl.textContent = `${Number(stats.total_kilos_cereza).toLocaleString()} kg`;
      if (entriesEl) entriesEl.textContent = `${stats.total_recolecciones} Pases`;
      if (avgEl) avgEl.textContent = `${stats.promedio_pase_kilos} kg`;
      if (recosEl) recosEl.textContent = `${currentRecosList.filter(r => r.activo).length} Operarios`;
    }

    // 4. Render de Últimos Pesajes con botón de eliminar
    const recentBody = document.getElementById('harvestRecentEntriesBody');
    if (recentBody && data.harvest && data.harvest.ultimosRegistros) {
      recentBody.innerHTML = data.harvest.ultimosRegistros.map(rec => `
        <tr>
          <td><span style="font-weight: 500;">${rec.fecha}</span></td>
          <td><strong>${rec.recolector}</strong></td>
          <td><span class="badge-tag" style="background: rgba(16, 185, 129, 0.15); color: #10b981;">${rec.lote}</span></td>
          <td style="text-align: right; font-weight: 700; color: #fff;">${rec.kilos} kg</td>
          <td style="text-align: center;">
            <button class="btn-toolbar-action" style="padding: 0.2rem 0.5rem; color: #ef4444; border-color: rgba(239, 68, 68, 0.3);" onclick="handleEliminarPesaje('${rec.id}', '${rec.kilos}', '${rec.recolector}')" title="Eliminar este pesaje de Neon">
              <i class="fa-solid fa-trash-can"></i>
            </button>
          </td>
        </tr>
      `).join('');
    }

    // 5. Render de Tabla de Rendimiento por Recolector
    const recosBody = document.getElementById('harvestCollectorsTableBody');
    if (recosBody && data.harvest && data.harvest.recolectores) {
      recosBody.innerHTML = data.harvest.recolectores.map(r => `
        <tr>
          <td><strong>${r.nombre}</strong></td>
          <td style="text-align: center;">${r.pases}</td>
          <td style="text-align: right; font-weight: 700; color: #10b981;">${Number(r.total_kilos).toLocaleString()} kg</td>
          <td style="text-align: right;">${Number(r.promedio_kilos).toFixed(1)} kg</td>
          <td style="text-align: center;"><span class="trend-pill positive">Activo</span></td>
        </tr>
      `).join('');
    }

    // 6. Render de Barras de Kilos por Lote
    const lotsContainer = document.getElementById('harvestLotsBarsContainer');
    if (lotsContainer && data.harvest && data.harvest.kilosPorLote) {
      const lotes = data.harvest.kilosPorLote;
      const totalKilos = lotes.reduce((acc, curr) => acc + Number(curr.total_kilos || 0), 0) || 1;
      const colors = ['#10b981', '#059669', '#d97706', '#b45309', '#3b82f6', '#8b5cf6'];
      lotsContainer.innerHTML = lotes.map((l, idx) => {
        const pct = ((Number(l.total_kilos) / totalKilos) * 100).toFixed(1);
        const color = colors[idx % colors.length];
        return `
          <div>
            <div style="display: flex; justify-content: space-between; font-size: 0.82rem; margin-bottom: 0.35rem;">
              <span><strong>🌱 ${l.lote_nombre}</strong></span>
              <strong style="color: ${color};">${Number(l.total_kilos).toLocaleString()} kg (${pct}%)</strong>
            </div>
            <div class="progress-bar-bg"><div class="progress-bar-fill" style="width: ${pct}%; background: ${color};"></div></div>
          </div>
        `;
      }).join('');
    }

    // 7. Render de Historial de Procesos de Beneficio
    const procesosBody = document.getElementById('tablaHistorialProcesosBody');
    if (procesosBody) {
      const allProcesos = [
        ...(data.procesosLavado || []).map(p => ({ ...p, tipoDesc: 'Lavado Tradicional', cereza: p.pesoCerezaProcesada, seco: p.pesoCafeSeco })),
        ...(data.procesosFermentacion || []).map(p => ({ ...p, tipoDesc: `Fermentación (${p.diasFermentacion}d)`, cereza: p.pesoCerezaTotal, seco: p.pesoCafeSeco }))
      ].sort((a, b) => new Date(b.fecha) - new Date(a.fecha)).slice(0, 15);

      if (allProcesos.length === 0) {
        procesosBody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--text-muted); padding: 1.5rem;">No hay registros de beneficio aún.</td></tr>';
      } else {
        procesosBody.innerHTML = allProcesos.map(p => {
          const factor = (p.seco && p.seco > 0) ? ((p.cereza / p.seco) * 12.5).toFixed(1) : 'En secado';
          return `
            <tr>
              <td>${p.fecha}</td>
              <td><span class="badge-tag" style="background: rgba(6, 182, 212, 0.15); color: #06b6d4;">${p.tipoDesc}</span></td>
              <td><strong>${p.lote || 'General'}</strong></td>
              <td style="text-align: right; font-weight: 600;">${Number(p.cereza).toLocaleString()} kg</td>
              <td style="text-align: right; color: #10b981; font-weight: 700;">${p.seco ? Number(p.seco).toLocaleString() + ' kg' : 'Pendiente'}</td>
              <td style="text-align: center;"><code style="color: #f59e0b;">${factor}</code></td>
            </tr>
          `;
        }).join('');
      }
    }

    // 8. Render de Historial de Bodega
    const bodegaBody = document.getElementById('tablaHistorialBodegaBody');
    if (bodegaBody) {
      const salidas = data.salidasBodega || [];
      if (salidas.length === 0) {
        bodegaBody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--text-muted); padding: 1.5rem;">No hay despachos de bodega registrados.</td></tr>';
      } else {
        bodegaBody.innerHTML = salidas.map(s => `
          <tr>
            <td>${s.fecha}</td>
            <td><span class="badge-tag" style="background: rgba(245, 158, 11, 0.15); color: #f59e0b;">${s.tipo}</span></td>
            <td><strong>${s.destino}</strong></td>
            <td style="text-align: right; font-weight: 700; color: #10b981;">${Number(s.cantidad).toLocaleString()} kg</td>
            <td style="color: var(--text-muted); font-size: 0.8rem;">${s.notas || '-'}</td>
          </tr>
        `).join('');
      }
    }

  } catch (err) {
    console.error('Error cargando datos de productividad:', err);
    showToast('Aviso: Cargando datos locales de productividad', 'warning');
  }
}

// Controladores de eventos de formulario
async function handleGuardarPesaje(event) {
  event.preventDefault();
  const fecha = document.getElementById('inputPesajeFecha').value;
  const recolectorId = document.getElementById('selectPesajeRecolector').value;
  const loteId = document.getElementById('selectPesajeLote').value;
  const pesoCereza = document.getElementById('inputPesajeKilos').value;

  if (!recolectorId || !loteId || !pesoCereza) {
    showToast('Por favor completa todos los campos del pesaje', 'error');
    return;
  }

  const btn = document.getElementById('btnSubmitPesaje');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Guardando...';
  }

  try {
    const res = await fetch('/api/productividad/recoleccion', {
      method: 'POST',
      headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ fecha, recolectorId, loteId, pesoCereza })
    });

    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Error al guardar pesaje');

    showToast(`✅ Pesaje de ${pesoCereza} kg guardado en Neon!`, 'success');
    document.getElementById('inputPesajeKilos').value = '';
    await loadProductividadData();
  } catch (err) {
    showToast(`Error: ${err.message}`, 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> <span>Guardar Pesaje</span>';
    }
  }
}

async function handleEliminarPesaje(id, kilos, recolector) {
  if (!confirm(`¿Eliminar pesaje de ${kilos} kg de ${recolector}? Esta acción borrará el registro de Neon.`)) {
    return;
  }

  try {
    const res = await fetch(`/api/productividad/recoleccion/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Error al eliminar');

    showToast('Pesaje eliminado de Neon', 'info');
    await loadProductividadData();
  } catch (err) {
    showToast(`Error: ${err.message}`, 'error');
  }
}

async function handleGuardarRecolector(event) {
  event.preventDefault();
  const nombre = document.getElementById('inputRecoNombre').value;
  const documento = document.getElementById('inputRecoDoc').value;

  try {
    const res = await fetch('/api/productividad/recolector', {
      method: 'POST',
      headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre, documento, activo: true })
    });

    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Error al crear recolector');

    showToast(`✅ Recolector ${nombre.toUpperCase()} guardado en Neon!`, 'success');
    document.getElementById('inputRecoNombre').value = '';
    document.getElementById('inputRecoDoc').value = '';
    await loadProductividadData();
  } catch (err) {
    showToast(`Error: ${err.message}`, 'error');
  }
}

async function handleGuardarLavado(event) {
  event.preventDefault();
  const payload = {
    fecha: document.getElementById('lavadoFecha').value,
    loteId: document.getElementById('lavadoLote').value,
    pesoCerezaProcesada: document.getElementById('lavadoCereza').value,
    pesoCafeMojado: document.getElementById('lavadoMojado').value,
    pesoCafeSeco: document.getElementById('lavadoSeco').value,
    pesoPasillaSeca: document.getElementById('lavadoPasillaSeca').value
  };

  try {
    const res = await fetch('/api/productividad/lavado', {
      method: 'POST',
      headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Error al guardar');

    showToast('✅ Proceso de Lavado guardado en Neon!', 'success');
    document.getElementById('formProcesoLavado').reset();
    await loadProductividadData();
  } catch (err) {
    showToast(`Error: ${err.message}`, 'error');
  }
}

async function handleGuardarFermentacion(event) {
  event.preventDefault();
  const payload = {
    fecha: document.getElementById('fermFecha').value,
    loteId: document.getElementById('fermLote').value,
    pesoCerezaTotal: document.getElementById('fermCerezaTotal').value,
    diasFermentacion: document.getElementById('fermDias').value,
    pesoCafeSeco: document.getElementById('fermCafeSeco').value,
    pesoFlotesSegunda: document.getElementById('fermFlotes').value
  };

  try {
    const res = await fetch('/api/productividad/fermentacion', {
      method: 'POST',
      headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Error al guardar');

    showToast('✅ Proceso de Fermentación guardado en Neon!', 'success');
    document.getElementById('formProcesoFermentacion').reset();
    await loadProductividadData();
  } catch (err) {
    showToast(`Error: ${err.message}`, 'error');
  }
}

async function handleGuardarSalidaBodega(event) {
  event.preventDefault();
  const payload = {
    fecha: document.getElementById('bodegaFecha').value,
    cantidad: document.getElementById('bodegaCantidad').value,
    tipo: document.getElementById('bodegaTipo').value,
    destino: document.getElementById('bodegaDestino').value,
    notas: document.getElementById('bodegaNotas').value
  };

  try {
    const res = await fetch('/api/productividad/bodega', {
      method: 'POST',
      headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Error al guardar');

    showToast('✅ Salida de Bodega registrada en Neon!', 'success');
    document.getElementById('formSalidaBodega').reset();
    await loadProductividadData();
  } catch (err) {
    showToast(`Error: ${err.message}`, 'error');
  }
}

// ==================== MÓDULO NATIVO GHALOCAFE COMERCIAL ====================
let ghaloCafeData = {
  stats: {},
  ingresos: [],
  egresos: [],
  tiendas: []
};
let ghaloProductsCache = [];

function switchGhaloTab(tabId) {
  document.querySelectorAll('.ghalo-subtab-pane').forEach(el => el.style.display = 'none');
  const target = document.getElementById(tabId);
  if (target) target.style.display = 'block';

  const map = {
    'tab-ghalo-ventas': 'btnTabGhaloVentas',
    'tab-ghalo-egresos': 'btnTabGhaloEgresos',
    'tab-ghalo-tiendas': 'btnTabGhaloTiendas',
    'tab-ghalo-balance': 'btnTabGhaloBalance'
  };
  Object.keys(map).forEach(k => {
    const btn = document.getElementById(map[k]);
    if (btn) btn.classList.toggle('active', k === tabId);
  });
}

async function loadGhaloCafeData() {
  const today = new Date().toISOString().split('T')[0];
  const ventaFecha = document.getElementById('inputVentaFecha');
  const egresoFecha = document.getElementById('inputEgresoFecha');
  if (ventaFecha && !ventaFecha.value) ventaFecha.value = today;
  if (egresoFecha && !egresoFecha.value) egresoFecha.value = today;

  try {
    const [ghaloRes, invRes, whRes] = await Promise.all([
      fetch('/api/ghalocafe/bootstrap'),
      fetch('/api/ghaloinv/bootstrap'),
      fetch('/api/erp/warehouse').catch(() => null)
    ]);

    if (ghaloRes.ok) {
      ghaloCafeData = await ghaloRes.json();
    }

    if (invRes.ok) {
      const invData = await invRes.json();
      ghaloProductsCache = invData.products || [];
    }

    // Actualizar KPIs de Ventas
    const s = ghaloCafeData.stats || {};
    const kpiIng = document.getElementById('kpiGhaloTotalIngresos');
    const kpiVentasCount = document.getElementById('kpiGhaloVentasCount');
    const kpiUtil = document.getElementById('kpiGhaloUtilidad');
    const kpiMargen = document.getElementById('kpiGhaloMargen');
    const kpiEgr = document.getElementById('kpiGhaloTotalEgresos');
    const kpiEgrCount = document.getElementById('kpiGhaloEgresosCount');
    const badgeVentas = document.getElementById('badgeVentasCount');
    const badgeEgresos = document.getElementById('badgeEgresosCount');

    if (kpiIng) kpiIng.textContent = `$${Number(s.totalIngresos || 0).toLocaleString()} COP`;
    if (kpiVentasCount) kpiVentasCount.textContent = `${s.totalVentasCount || 0} ventas registradas`;
    if (kpiUtil) kpiUtil.textContent = `$${Number(s.utilidadComercial || 0).toLocaleString()} COP`;
    if (kpiMargen) kpiMargen.textContent = `${s.margenOperativo || 0}% margen`;
    if (kpiEgr) kpiEgr.textContent = `$${Number(s.totalEgresos || 0).toLocaleString()} COP`;
    if (kpiEgrCount) kpiEgrCount.textContent = `${s.totalEgresosCount || 0} gastos registrados`;
    if (badgeVentas) badgeVentas.textContent = `${(ghaloCafeData.ingresos || []).length} registros`;
    if (badgeEgresos) badgeEgresos.textContent = `${(ghaloCafeData.egresos || []).length} registros`;

    // Balance Tab KPIs
    const balIng = document.getElementById('balGhaloIngresos');
    const balEgr = document.getElementById('balGhaloEgresos');
    const balUtil = document.getElementById('balGhaloUtilidad');
    const balMarg = document.getElementById('balGhaloMargenPct');
    if (balIng) balIng.textContent = `$${Number(s.totalIngresos || 0).toLocaleString()} COP`;
    if (balEgr) balEgr.textContent = `$${Number(s.totalEgresos || 0).toLocaleString()} COP`;
    if (balUtil) balUtil.textContent = `$${Number(s.utilidadComercial || 0).toLocaleString()} COP`;
    if (balMarg) balMarg.textContent = `Margen Operativo: ${s.margenOperativo || 0}%`;

    // Dropdown de productos en formulario de ventas
    const selProd = document.getElementById('selectVentaProducto');
    if (selProd) {
      if (ghaloProductsCache.length > 0) {
        selProd.innerHTML = '<option value="">Seleccione producto...</option>' +
          ghaloProductsCache.map(p => `<option value="${p.name}" data-price="${p.price}">${p.name} - $${Number(p.price).toLocaleString()} COP</option>`).join('');
      } else {
        selProd.innerHTML = `
          <option value="">Seleccione producto...</option>
          <option value="GhaloCafe Molido 454g" data-price="32000">GhaloCafe Molido 454g (Libra) - $32.000</option>
          <option value="GhaloCafe Grano 454g" data-price="32000">GhaloCafe Grano 454g (Libra) - $32.000</option>
          <option value="GhaloCafe Molido 250g" data-price="18500">GhaloCafe Molido 250g - $18.500</option>
          <option value="GhaloCafe Grano 250g" data-price="18500">GhaloCafe Grano 250g - $18.500</option>
          <option value="GhaloCafe Grano 2500g" data-price="165000">GhaloCafe Grano 2.500g Institucional - $165.000</option>
        `;
      }
    }

    // Tabla de Ventas
    const tbodyVentas = document.getElementById('tablaVentasBody');
    if (tbodyVentas) {
      const items = ghaloCafeData.ingresos || [];
      if (items.length === 0) {
        tbodyVentas.innerHTML = `<tr><td colspan="10" style="text-align: center; color: var(--text-dim); padding: 2rem;">No hay ventas registradas aún. Registra una con el formulario superior.</td></tr>`;
      } else {
        tbodyVentas.innerHTML = items.map(v => `
          <tr>
            <td><code>#${v.id}</code></td>
            <td>${v.fecha}</td>
            <td><strong>${v.cliente}</strong></td>
            <td>${v.producto}</td>
            <td style="text-align: center; font-weight: 700;">${v.cantidad}</td>
            <td style="text-align: right;">$${Number(v.precio_unitario).toLocaleString()}</td>
            <td style="text-align: right; font-weight: 700; color: #10b981;">$${Number(v.total).toLocaleString()}</td>
            <td><span class="badge-tag">${v.canal || 'Tienda'}</span></td>
            <td><span style="font-size: 0.8rem; color: var(--text-muted);">${v.notas || '-'}</span></td>
            <td style="text-align: center;">
              <button class="btn-secondary" style="padding: 0.2rem 0.5rem; color: #ef4444; border-color: rgba(239, 68, 68, 0.3);" onclick="handleEliminarVenta(${v.id})" title="Eliminar Venta">
                <i class="fa-solid fa-trash-can"></i>
              </button>
            </td>
          </tr>
        `).join('');
      }
    }

    // Tabla de Egresos
    const tbodyEgresos = document.getElementById('tablaEgresosBody');
    if (tbodyEgresos) {
      const items = ghaloCafeData.egresos || [];
      if (items.length === 0) {
        tbodyEgresos.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--text-dim); padding: 2rem;">No hay egresos registrados aún. Registra uno con el formulario superior.</td></tr>`;
      } else {
        tbodyEgresos.innerHTML = items.map(e => `
          <tr>
            <td><code>#${e.id}</code></td>
            <td>${e.fecha}</td>
            <td><span class="badge-tag" style="background: rgba(239, 68, 68, 0.15); color: #ef4444;">${e.categoria}</span></td>
            <td><strong>${e.descripcion}</strong></td>
            <td style="text-align: right; font-weight: 700; color: #ef4444;">$${Number(e.monto).toLocaleString()}</td>
            <td><code>${e.soporte || '-'}</code></td>
            <td><span style="font-size: 0.8rem; color: var(--text-muted);">${e.notas || '-'}</span></td>
            <td style="text-align: center;">
              <button class="btn-secondary" style="padding: 0.2rem 0.5rem; color: #ef4444; border-color: rgba(239, 68, 68, 0.3);" onclick="handleEliminarEgreso(${e.id})" title="Eliminar Egreso">
                <i class="fa-solid fa-trash-can"></i>
              </button>
            </td>
          </tr>
        `).join('');
      }
    }

    // Tiendas & Puntos de Venta
    const storesGrid = document.getElementById('storesGridContainerUnified');
    if (storesGrid) {
      const tiendas = ghaloCafeData.tiendas || [];
      if (tiendas.length === 0) {
        storesGrid.innerHTML = `<div style="color: var(--text-dim);">Cargando puntos de venta...</div>`;
      } else {
        storesGrid.innerHTML = tiendas.map(t => `
          <div class="store-card" style="border-left: 4px solid var(--primary-gold);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.25rem;">
              <span class="store-card-city"><i class="fa-solid fa-location-dot"></i> ${t.location || 'Eje Cafetero'}</span>
              <span class="badge-tag" style="background: rgba(245, 158, 11, 0.15); color: #f59e0b;">${t.type || 'Punto de Venta'}</span>
            </div>
            <h4 class="store-card-name" style="margin: 0.25rem 0 0.5rem 0;">${t.name}</h4>
            <div style="display: flex; justify-content: space-between; align-items: flex-end; border-top: 1px solid rgba(255, 255, 255, 0.05); padding-top: 0.5rem;">
              <div>
                <div style="font-size: 0.7rem; color: var(--text-muted); text-transform: uppercase;">Stock Terminado</div>
                <div class="store-card-stock" style="font-size: 1.2rem; font-weight: 700; color: #fff;">${Number(t.stock_unidades || 0).toLocaleString()} uds <span style="font-size: 0.8rem; color: var(--primary-gold);">(${t.stock_kilos || 0} kg)</span></div>
              </div>
              <span class="trend-pill positive"><i class="fa-solid fa-check"></i> Activo</span>
            </div>
          </div>
        `).join('');
      }
    }

    // Salidas de Bodega Pergamino
    if (whRes && whRes.ok) {
      const whData = await whRes.json();
      const tbodySal = document.getElementById('tablaSalidasBodegaUnified');
      if (tbodySal && whData.ultimasSalidas) {
        tbodySal.innerHTML = whData.ultimasSalidas.map(sal => `
          <tr>
            <td><code>${(sal.id || '').slice(0, 10)}...</code></td>
            <td>${sal.fecha}</td>
            <td><strong>${sal.tipo}</strong></td>
            <td><span class="badge-tag" style="background: ${sal.destino === 'TOSTION' ? 'rgba(245, 158, 11, 0.2)' : 'rgba(16, 185, 129, 0.2)'}; color: ${sal.destino === 'TOSTION' ? '#fbbf24' : '#10b981'};">${sal.destino}</span></td>
            <td>${sal.metodo_beneficio || 'TRADICIONAL'}</td>
            <td style="text-align: right; font-weight: 700; color: #fff;">${sal.cantidad} kg</td>
          </tr>
        `).join('');
      }
    }

  } catch (err) {
    console.error('Error cargando datos de GhaloCafe:', err);
  }
}

function autoFillPrecioVenta() {
  const sel = document.getElementById('selectVentaProducto');
  const priceInput = document.getElementById('inputVentaPrecio');
  if (sel && priceInput) {
    const opt = sel.options[sel.selectedIndex];
    const price = opt ? opt.getAttribute('data-price') : null;
    if (price) priceInput.value = price;
    calcularTotalVenta();
  }
}

function calcularTotalVenta() {
  const cant = parseFloat(document.getElementById('inputVentaCantidad')?.value || 0);
  const prec = parseFloat(document.getElementById('inputVentaPrecio')?.value || 0);
  const preview = document.getElementById('ventaTotalPreview');
  if (preview) {
    if (cant > 0 && prec > 0) {
      preview.textContent = `Total Venta: $${(cant * prec).toLocaleString()} COP`;
    } else {
      preview.textContent = '';
    }
  }
}

async function handleGuardarVenta(e) {
  e.preventDefault();
  const fecha = document.getElementById('inputVentaFecha').value;
  const cliente = document.getElementById('inputVentaCliente').value;
  const producto = document.getElementById('selectVentaProducto').value;
  const cantidad = document.getElementById('inputVentaCantidad').value;
  const precio_unitario = document.getElementById('inputVentaPrecio').value;
  const canal = document.getElementById('selectVentaCanal').value;
  const notas = document.getElementById('inputVentaNotas').value;

  const btn = document.getElementById('btnSubmitVenta');
  if (btn) btn.disabled = true;

  try {
    const res = await fetch('/api/ghalocafe/ingresos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fecha, cliente, producto, cantidad, precio_unitario, canal, notas })
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Error al guardar venta');

    showToast('☕ ¡Venta guardada con éxito en Neon DB!', 'success');
    document.getElementById('inputVentaCliente').value = '';
    document.getElementById('inputVentaCantidad').value = '';
    document.getElementById('inputVentaNotas').value = '';
    document.getElementById('ventaTotalPreview').textContent = '';
    await loadGhaloCafeData();
  } catch (err) {
    showToast(`Error: ${err.message}`, 'error');
  } finally {
    if (btn) btn.disabled = false;
  }
}

async function handleEliminarVenta(id) {
  if (!confirm(`¿Eliminar la venta #${id} de Neon DB?`)) return;
  try {
    const res = await fetch(`/api/ghalocafe/ingresos/${id}`, { method: 'DELETE' });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Error al eliminar');

    showToast('Venta eliminada de Neon DB', 'info');
    await loadGhaloCafeData();
  } catch (err) {
    showToast(`Error: ${err.message}`, 'error');
  }
}

async function handleGuardarEgreso(e) {
  e.preventDefault();
  const fecha = document.getElementById('inputEgresoFecha').value;
  const categoria = document.getElementById('selectEgresoCategoria').value;
  const descripcion = document.getElementById('inputEgresoDesc').value;
  const monto = document.getElementById('inputEgresoMonto').value;
  const soporte = document.getElementById('inputEgresoSoporte').value;
  const notas = document.getElementById('inputEgresoNotas').value;

  const btn = document.getElementById('btnSubmitEgreso');
  if (btn) btn.disabled = true;

  try {
    const res = await fetch('/api/ghalocafe/egresos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fecha, categoria, descripcion, monto, soporte, notas })
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Error al registrar egreso');

    showToast('💸 ¡Egreso registrado con éxito en Neon DB!', 'success');
    document.getElementById('inputEgresoDesc').value = '';
    document.getElementById('inputEgresoMonto').value = '';
    document.getElementById('inputEgresoSoporte').value = '';
    document.getElementById('inputEgresoNotas').value = '';
    await loadGhaloCafeData();
  } catch (err) {
    showToast(`Error: ${err.message}`, 'error');
  } finally {
    if (btn) btn.disabled = false;
  }
}

async function handleEliminarEgreso(id) {
  if (!confirm(`¿Eliminar el egreso #${id} de Neon DB?`)) return;
  try {
    const res = await fetch(`/api/ghalocafe/egresos/${id}`, { method: 'DELETE' });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Error al eliminar');

    showToast('Egreso eliminado de Neon DB', 'info');
    await loadGhaloCafeData();
  } catch (err) {
    showToast(`Error: ${err.message}`, 'error');
  }
}

// Fallback compatibility
function loadErpWarehouseAndStoresData() {
  return loadGhaloCafeData();
}

// ==================== MÓDULO NATIVO GHALOINV (INVENTARIOS & BODEGAS) ====================
let ghaloInvData = {
  stats: {},
  products: [],
  warehouses: [],
  balances: [],
  recentDocuments: []
};

function switchInvTab(tabId) {
  document.querySelectorAll('.inv-subtab-pane').forEach(el => el.style.display = 'none');
  const target = document.getElementById(tabId);
  if (target) target.style.display = 'block';

  const map = {
    'tab-inv-stock': 'btnTabInvStock',
    'tab-inv-movimientos': 'btnTabInvMovs',
    'tab-inv-productos': 'btnTabInvProds',
    'tab-inv-bodegas': 'btnTabInvBodegas'
  };
  Object.keys(map).forEach(k => {
    const btn = document.getElementById(map[k]);
    if (btn) btn.classList.toggle('active', k === tabId);
  });
}

async function loadGhaloInvData() {
  const today = new Date().toISOString().split('T')[0];
  const movFecha = document.getElementById('inputMovFecha');
  if (movFecha && !movFecha.value) movFecha.value = today;

  try {
    const res = await fetch('/api/ghaloinv/bootstrap');
    if (!res.ok) throw new Error('Error al conectar con API de inventarios');
    ghaloInvData = await res.json();

    // Actualizar KPIs de Inventario
    const s = ghaloInvData.stats || {};
    const kpiUds = document.getElementById('kpiInvTotalUnidades');
    const kpiKg = document.getElementById('kpiInvTotalKilos');
    const kpiVal = document.getElementById('kpiInvValoracion');
    const kpiSkus = document.getElementById('kpiInvSkusCount');
    const kpiBods = document.getElementById('kpiInvBodegasCount');

    if (kpiUds) kpiUds.textContent = `${Number(s.totalUnidades || 0).toLocaleString()} uds`;
    if (kpiKg) kpiKg.textContent = `${s.totalKilos || 0} kg café empacado`;
    if (kpiVal) kpiVal.textContent = `$${Number(s.valorInventario || 0).toLocaleString()} COP`;
    if (kpiSkus) kpiSkus.textContent = `${s.totalProductos || 0} SKUs activos`;
    if (kpiBods) kpiBods.textContent = `${s.totalBodegas || 0} bodegas`;

    // Dropdowns
    const filBod = document.getElementById('filterInvBodega');
    const selOrigen = document.getElementById('selectMovOrigen');
    const selDestino = document.getElementById('selectMovDestino');
    const selProd = document.getElementById('selectMovProducto');

    const whs = ghaloInvData.warehouses || [];
    const prods = ghaloInvData.products || [];

    if (filBod) {
      const currentVal = filBod.value;
      filBod.innerHTML = '<option value="ALL">Todas las Bodegas</option>' +
        whs.map(w => `<option value="${w.id}">${w.name} (${w.location})</option>`).join('');
      if (currentVal) filBod.value = currentVal;
    }

    if (selOrigen) {
      selOrigen.innerHTML = whs.map(w => `<option value="${w.id}">${w.name}</option>`).join('');
    }
    if (selDestino) {
      selDestino.innerHTML = whs.map(w => `<option value="${w.id}">${w.name}</option>`).join('');
    }
    if (selProd) {
      selProd.innerHTML = prods.map(p => `<option value="${p.id}" data-cost="${p.cost_standard}">${p.sku} - ${p.name} (${p.presentation_g}g)</option>`).join('');
    }

    // Renderizar Tablas
    renderInvStockTable();
    renderInvDocsTable();
    renderInvProductsTable();
    renderInvWarehousesTable();

  } catch (err) {
    console.error('Error cargando datos de GhaloInv:', err);
  }
}

function renderInvStockTable() {
  const filBod = document.getElementById('filterInvBodega');
  const selectedBodega = filBod ? filBod.value : 'ALL';
  const tbody = document.getElementById('tablaInvBalancesBody');
  if (!tbody) return;

  let balances = ghaloInvData.balances || [];
  if (selectedBodega !== 'ALL') {
    balances = balances.filter(b => String(b.warehouse_id) === String(selectedBodega));
  }

  if (balances.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--text-dim); padding: 2rem;">No hay existencias registradas con este filtro.</td></tr>`;
    return;
  }

  tbody.innerHTML = balances.map(b => {
    const qty = parseFloat(b.qty_on_hand || 0);
    const kilos = ((qty * (b.presentation_g || 454)) / 1000).toFixed(1);
    const totalVal = Math.round(qty * parseFloat(b.price || 0));
    return `
      <tr>
        <td><strong>${b.warehouse_name}</strong></td>
        <td><code>${b.sku}</code></td>
        <td>${b.product_name}</td>
        <td>${b.presentation_g}g</td>
        <td style="text-align: right; font-weight: 700; color: ${qty <= 10 ? '#ef4444' : '#fff'};">${qty.toLocaleString()} uds</td>
        <td style="text-align: right; font-weight: 600; color: var(--primary-gold);">${kilos} kg</td>
        <td style="text-align: right;">$${Number(b.price || 0).toLocaleString()}</td>
        <td style="text-align: right; font-weight: 700; color: #10b981;">$${totalVal.toLocaleString()}</td>
      </tr>
    `;
  }).join('');
}

function renderInvDocsTable() {
  const tbody = document.getElementById('tablaInvDocsBody');
  if (!tbody) return;

  const docs = ghaloInvData.recentDocuments || [];
  if (docs.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-dim); padding: 2rem;">No hay movimientos de inventario registrados aún.</td></tr>`;
    return;
  }

  tbody.innerHTML = docs.map(d => `
    <tr>
      <td><code>${d.document_number}</code></td>
      <td>${d.date}</td>
      <td><span class="badge-tag" style="background: ${d.doc_type === 'ENTRADA' ? 'rgba(16, 185, 129, 0.2)' : d.doc_type === 'TRASLADO' ? 'rgba(6, 182, 212, 0.2)' : 'rgba(239, 68, 68, 0.2)'}; color: ${d.doc_type === 'ENTRADA' ? '#10b981' : d.doc_type === 'TRASLADO' ? '#06b6d4' : '#ef4444'};">${d.doc_type}</span></td>
      <td>${d.warehouse_from || '-'}</td>
      <td>${d.warehouse_to || '-'}</td>
      <td style="text-align: center; font-weight: 700;">${d.total_qty}</td>
      <td><span style="font-size: 0.8rem; color: var(--text-muted);">${d.notes || '-'}</span></td>
    </tr>
  `).join('');
}

function renderInvProductsTable() {
  const tbody = document.getElementById('tablaInvProductsBody');
  if (!tbody) return;

  const prods = ghaloInvData.products || [];
  if (prods.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--text-dim); padding: 2rem;">No hay productos configurados en Neon DB.</td></tr>`;
    return;
  }

  tbody.innerHTML = prods.map(p => `
    <tr>
      <td><code>#${p.id}</code></td>
      <td><strong>${p.sku}</strong></td>
      <td>${p.name}</td>
      <td><span class="badge-tag">${p.type}</span></td>
      <td style="text-align: center;">${p.presentation_g}g (${p.packaging_unit || 'Bolsa'})</td>
      <td style="text-align: right;">$${Number(p.cost_standard || 0).toLocaleString()}</td>
      <td style="text-align: right; font-weight: 700; color: var(--primary-gold);">$${Number(p.price || 0).toLocaleString()}</td>
      <td style="text-align: center;"><span class="trend-pill positive">Activo</span></td>
    </tr>
  `).join('');
}

function renderInvWarehousesTable() {
  const tbody = document.getElementById('tablaInvWarehousesBody');
  if (!tbody) return;

  const whs = ghaloInvData.warehouses || [];
  if (whs.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-dim); padding: 2rem;">No hay bodegas registradas.</td></tr>`;
    return;
  }

  tbody.innerHTML = whs.map(w => `
    <tr>
      <td><code>#${w.id}</code></td>
      <td><strong>${w.name}</strong></td>
      <td>${w.location || 'Eje Cafetero'}</td>
      <td><span class="badge-tag">${w.type}</span></td>
      <td style="text-align: center;"><span class="trend-pill positive">Operativa</span></td>
    </tr>
  `).join('');
}

function handleTipoMovimientoChange() {
  const tipo = document.getElementById('selectMovTipo')?.value;
  const grpOrigen = document.getElementById('groupMovOrigen');
  const grpDestino = document.getElementById('groupMovDestino');

  if (tipo === 'ENTRADA') {
    if (grpOrigen) grpOrigen.style.display = 'none';
    if (grpDestino) grpDestino.style.display = 'block';
  } else if (tipo === 'SALIDA') {
    if (grpOrigen) grpOrigen.style.display = 'block';
    if (grpDestino) grpDestino.style.display = 'none';
  } else { // TRASLADO
    if (grpOrigen) grpOrigen.style.display = 'block';
    if (grpDestino) grpDestino.style.display = 'block';
  }
}

async function handleGuardarMovimiento(e) {
  e.preventDefault();
  const date = document.getElementById('inputMovFecha').value;
  const doc_type = document.getElementById('selectMovTipo').value;
  const warehouse_from_id = document.getElementById('selectMovOrigen').value;
  const warehouse_to_id = document.getElementById('selectMovDestino').value;
  const product_id = parseInt(document.getElementById('selectMovProducto').value);
  const qty = parseFloat(document.getElementById('inputMovCantidad').value);
  const notes = document.getElementById('inputMovNotas').value;

  if (doc_type === 'TRASLADO' && warehouse_from_id === warehouse_to_id) {
    showToast('En un traslado, la bodega de origen y destino deben ser distintas', 'error');
    return;
  }

  const btn = document.getElementById('btnSubmitMovimiento');
  if (btn) btn.disabled = true;

  try {
    const payload = {
      doc_type,
      warehouse_from_id: doc_type !== 'ENTRADA' ? parseInt(warehouse_from_id) : null,
      warehouse_to_id: doc_type !== 'SALIDA' ? parseInt(warehouse_to_id) : null,
      date,
      notes,
      items: [{ product_id, qty }]
    };

    const res = await fetch('/api/ghaloinv/documents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Error al aplicar movimiento');

    showToast(`📦 ¡${result.message || 'Movimiento aplicado en Neon DB'}!`, 'success');
    document.getElementById('inputMovCantidad').value = '';
    document.getElementById('inputMovNotas').value = '';
    await loadGhaloInvData();
    // También refrescar GhaloCafe para que se actualicen los stocks
    await loadGhaloCafeData();
  } catch (err) {
    showToast(`Error: ${err.message}`, 'error');
  } finally {
    if (btn) btn.disabled = false;
  }
}

async function handleGuardarProducto(e) {
  e.preventDefault();
  const sku = document.getElementById('inputProdSku').value;
  const name = document.getElementById('inputProdNombre').value;
  const type = document.getElementById('selectProdTipo').value;
  const presentation_g = document.getElementById('inputProdGramos').value;
  const price = document.getElementById('inputProdPrecio').value;
  const cost_standard = document.getElementById('inputProdCosto').value;

  const btn = document.getElementById('btnSubmitProducto');
  if (btn) btn.disabled = true;

  try {
    const res = await fetch('/api/ghaloinv/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sku, name, type, presentation_g, price, cost_standard })
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Error al crear producto');

    showToast(`🏷️ ¡Producto ${sku} creado en Neon DB!`, 'success');
    document.getElementById('formRegistroProducto').reset();
    await loadGhaloInvData();
    await loadGhaloCafeData();
  } catch (err) {
    showToast(`Error: ${err.message}`, 'error');
  } finally {
    if (btn) btn.disabled = false;
  }
}

async function handleGuardarBodega(e) {
  e.preventDefault();
  const name = document.getElementById('inputBodegaNombre').value;
  const location = document.getElementById('inputBodegaUbicacion').value;
  const type = document.getElementById('selectBodegaTipo').value;

  const btn = document.getElementById('btnSubmitBodega');
  if (btn) btn.disabled = true;

  try {
    const res = await fetch('/api/ghaloinv/warehouses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, location, type })
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Error al crear bodega');

    showToast(`🏬 ¡Bodega ${name} creada en Neon DB!`, 'success');
    document.getElementById('formRegistroBodega').reset();
    await loadGhaloInvData();
    await loadGhaloCafeData();
  } catch (err) {
    showToast(`Error: ${err.message}`, 'error');
  } finally {
    if (btn) btn.disabled = false;
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

function getStoredAuthToken() {
  return sessionStorage.getItem('leonora_erp_token') || localStorage.getItem('leonora_erp_token');
}

function getStoredAuthUser() {
  const userStr = sessionStorage.getItem('leonora_erp_user') || localStorage.getItem('leonora_erp_user');
  if (!userStr) return null;
  try {
    return JSON.parse(userStr);
  } catch (e) {
    return null;
  }
}

function clearStoredAuth() {
  localStorage.removeItem('leonora_erp_token');
  localStorage.removeItem('leonora_erp_user');
  sessionStorage.removeItem('leonora_erp_token');
  sessionStorage.removeItem('leonora_erp_user');
}

function getAuthHeaders(extra = {}) {
  const token = getStoredAuthToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': 'Bearer ' + token } : {}),
    ...extra
  };
}

function unlockAppSuite() {
  isAppSuiteUnlocked = true;
  document.body.classList.remove('not-authenticated');
  document.body.classList.add('authenticated');

  const root = document.getElementById('erp-app-root');
  if (root) root.style.display = 'block';

  const loginModal = document.getElementById('erp-login-modal');
  if (loginModal) loginModal.style.display = 'none';

  // Cargar y precalentar de forma segura los iframes oficiales originales
  const iframes = [
    { id: 'agriIframe', defaultUrl: '/modules/agri-control-bi/index.html' },
    { id: 'harvestIframe', defaultUrl: 'https://control-productividad-app.onrender.com' },
    { id: 'ghaloIframe', defaultUrl: 'https://sistema-ghalocafe.onrender.com' },
    { id: 'invIframe', defaultUrl: 'https://ghaloinv-app.onrender.com' }
  ];

  iframes.forEach(item => {
    const frame = document.getElementById(item.id);
    if (frame) {
      const targetSrc = frame.dataset.src || item.defaultUrl;
      if (!frame.src || frame.src === 'about:blank' || frame.src.endsWith('about:blank')) {
        frame.src = targetSrc;
      }
    }
  });

  initAppData();
  setupEventListeners();
  populateDropdowns();
  renderAll();
  checkBackendStatus();
  switchErpModule('erp-hub-view');
  initSavedIframeUrls();
  prewarmAllModules(true);
}

function lockAppSuite() {
  isAppSuiteUnlocked = false;
  document.body.classList.remove('authenticated');
  document.body.classList.add('not-authenticated');

  const root = document.getElementById('erp-app-root');
  if (root) root.style.display = 'none';

  const loginModal = document.getElementById('erp-login-modal');
  if (loginModal) {
    loginModal.style.display = 'flex';
    loginModal.style.opacity = '1';
  }

  // Descargar iframes por seguridad absoluta
  ['agriIframe', 'harvestIframe', 'ghaloIframe', 'invIframe'].forEach(id => {
    const frame = document.getElementById(id);
    if (frame) frame.src = 'about:blank';
  });
}

async function checkAuthSession() {
  const token = getStoredAuthToken();
  const userSessionWrapper = document.getElementById('erpUserSessionWrapper');

  if (!token) {
    lockAppSuite();
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
      return true;
    } else {
      clearStoredAuth();
      lockAppSuite();
      if (userSessionWrapper) userSessionWrapper.style.display = 'none';
      return false;
    }
  } catch (err) {
    console.warn('Verificación offline de sesión:', err);
    try {
      const parts = token.split('.');
      if (parts.length === 3) {
        const payload = JSON.parse(atob(parts[1]));
        if (payload.exp && payload.exp > Math.floor(Date.now() / 1000)) {
          currentAuthUser = payload;
          updateUserSessionUI(payload);
          return true;
        }
      }
    } catch (e) {}
    clearStoredAuth();
    lockAppSuite();
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
      clearStoredAuth();
      const rememberCheck = document.getElementById('rememberSessionCheck');
      const remember = rememberCheck ? rememberCheck.checked : false;

      if (remember) {
        localStorage.setItem('leonora_erp_token', data.token);
        localStorage.setItem('leonora_erp_user', JSON.stringify(data.user));
      } else {
        sessionStorage.setItem('leonora_erp_token', data.token);
        sessionStorage.setItem('leonora_erp_user', JSON.stringify(data.user));
      }

      currentAuthUser = data.user;
      updateUserSessionUI(data.user);
      unlockAppSuite();
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
  clearStoredAuth();
  currentAuthUser = null;

  const userSessionWrapper = document.getElementById('erpUserSessionWrapper');
  if (userSessionWrapper) userSessionWrapper.style.display = 'none';

  const menu = document.getElementById('userDropdownMenu');
  if (menu) menu.style.display = 'none';

  lockAppSuite();

  const passwordInput = document.getElementById('loginPassword');
  if (passwordInput) passwordInput.value = '';

  showToast('Has cerrado sesión de manera segura. La plataforma está bloqueada.', 'info');
}

// ==================== PRE-WARMING & WAKE-UP DE MÓDULOS EN LA NUBE ====================

let isPrewarmingActive = false;
let prewarmPollInterval = null;

async function prewarmAllModules(silent = true) {
  if (isPrewarmingActive) return;
  isPrewarmingActive = true;

  const globalStatus = document.getElementById('prewarmGlobalStatus');
  const btn = document.getElementById('btnPrewarmAll');

  if (globalStatus) {
    globalStatus.innerHTML = '<i class="fa-solid fa-spinner fa-spin" style="color: #f59e0b;"></i> Verificando servidores en la nube...';
  }

  const badges = {
    'mod-agri': document.getElementById('badge-status-mod-agri'),
    'mod-prod': document.getElementById('badge-status-mod-prod'),
    'mod-ghalo': document.getElementById('badge-status-mod-ghalo'),
    'mod-inv': document.getElementById('badge-status-mod-inv')
  };

  try {
    const res = await fetch('/api/erp/prewarm');
    if (res.ok) {
      const data = await res.json();
      let allOnline = true;

      data.results.forEach(item => {
        const badge = badges[item.id];
        if (!badge) return;

        if (item.status === 'online') {
          badge.className = 'app-launcher-status live';
          const durText = item.durationMs < 1000 ? '<1s' : (Math.round(item.durationMs / 100) / 10) + 's';
          badge.innerHTML = `<i class="fa-solid fa-circle" style="font-size: 0.45rem;"></i> En Línea (${durText})`;
          badge.title = `Servidor activo y respondiendo (${item.url})`;
        } else {
          allOnline = false;
          badge.className = 'app-launcher-status waking';
          badge.innerHTML = `<i class="fa-solid fa-spinner fa-spin" style="font-size: 0.45rem;"></i> Despertando...`;
          badge.title = `Servidor reactivándose en Render (${item.message || 'encendiéndose'})`;
        }
      });

      if (globalStatus) {
        if (allOnline) {
          globalStatus.innerHTML = '<i class="fa-solid fa-circle-check" style="color: #10b981;"></i> Todos los Módulos Activos (0s espera)';
          if (btn) {
            btn.innerHTML = '<i class="fa-solid fa-bolt" style="color: #10b981;"></i> Módulos Calientes';
          }
          if (prewarmPollInterval) {
            clearTimeout(prewarmPollInterval);
            prewarmPollInterval = null;
          }
        } else {
          globalStatus.innerHTML = '<i class="fa-solid fa-clock-rotate-left" style="color: #f59e0b;"></i> Reactivando servidores dormidos en Render...';
          if (!prewarmPollInterval) {
            prewarmPollInterval = setTimeout(() => {
              prewarmPollInterval = null;
              isPrewarmingActive = false;
              prewarmAllModules(true);
            }, 8000);
          }
        }
      }
    }
  } catch (err) {
    console.warn('Prewarm API no disponible:', err.message);
    if (globalStatus) {
      globalStatus.innerHTML = '<i class="fa-solid fa-cloud" style="color: var(--text-muted);"></i> Conexión Directa Neon DB';
    }
  } finally {
    isPrewarmingActive = false;
  }
}

async function triggerManualPrewarm(btn) {
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Despertando...';
  }
  showToast('⚡ Enviando pulso de arranque a todas las aplicaciones en la nube...', 'info');
  await prewarmAllModules(false);
  setTimeout(() => {
    if (btn) btn.disabled = false;
  }, 3000);
}


