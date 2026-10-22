// data.js - Datos Iniciales y Estructura Maestra para Finca La Leonora
const DEFAULT_APP_DATA = {
  farmInfo: {
    name: "Finca La Leonora",
    tagline: "Especialidad, Valor Agregado & Sostenibilidad",
    location: "Cordillera Central, Colombia - 1.750 msnm",
    currency: "COP",
    currencySymbol: "$",
    currencyScale: 1000000, // Cifras expresadas en millones
    currencyUnitLabel: "Millones COP",
    planPeriod: "2026 - 2027",
    projectionMonths: 24,
    currentMonthIndex: 9 // Mes actual de seguimiento (Octubre 2026 = índice 9)
  },

  months: [
    "Ene 2026", "Feb 2026", "Mar 2026", "Abr 2026", "May 2026", "Jun 2026",
    "Jul 2026", "Ago 2026", "Sep 2026", "Oct 2026", "Nov 2026", "Dic 2026",
    "Ene 2027", "Feb 2027", "Mar 2027", "Abr 2027", "May 2027", "Jun 2027",
    "Jul 2027", "Ago 2027", "Sep 2027", "Oct 2027", "Nov 2027", "Dic 2027"
  ],

  teamMembers: [
    { id: "tm-1", name: "Carlos Mendoza", role: "Gerente General & Estrategia", avatar: "CM" },
    { id: "tm-2", name: "Ing. Andrés Gómez", role: "Líder de Producción & Calidad", avatar: "AG" },
    { id: "tm-3", name: "Valentina Morales", role: "Directora Comercial & E-commerce", avatar: "VM" },
    { id: "tm-4", name: "Luisa Restrepo", role: "Líder Administrativa & Financiera", avatar: "LR" },
    { id: "tm-5", name: "Mateo Díaz", role: "Agrónomo & Operaciones de Campo", avatar: "MD" }
  ],

  pillars: [
    {
      id: "pil-1",
      code: "PIL-01",
      name: "Rentabilidad y Eficiencia de Costos",
      description: "Maximizar el margen neto mediante costeo unitario riguroso, reducción de mermas y optimización en insumos y recolección.",
      color: "#059669",
      icon: "fa-arrow-trend-up",
      weight: 25
    },
    {
      id: "pil-2",
      code: "PIL-02",
      name: "Posicionamiento & Venta de Mayor Valor Agregado (E-commerce)",
      description: "Transformar la venta de café verde a café tostado de especialidad con marca propia, potenciando la tienda online directa al consumidor (B2C) y cafeterías boutique (B2B).",
      color: "#d97706",
      icon: "fa-bag-shopping",
      weight: 35
    },
    {
      id: "pil-3",
      code: "PIL-03",
      name: "Manejo Administrativo y Financiero",
      description: "Asegurar disciplina de caja, control presupuestal estricto, gestión eficiente de compras e inventarios y reportes mensuales directivos.",
      color: "#2563eb",
      icon: "fa-scale-balanced",
      weight: 20
    },
    {
      id: "pil-4",
      code: "PIL-04",
      name: "Excelencia Agrícola, Calidad en Origen & Sostenibilidad",
      description: "Estandarizar procesos de cosecha selectiva y beneficio fermentativo diferenciado (Honey, Natural, Lavado doble) y certificaciones de finca.",
      color: "#7c3aed",
      icon: "fa-leaf",
      weight: 20
    }
  ],

  objectives: [
    {
      id: "obj-1",
      pillarId: "pil-1",
      code: "OBJ-1.1",
      name: "Alcanzar un Margen Bruto consolidado superior al 52%",
      kpiName: "Margen Bruto (%)",
      targetValue: 52,
      currentValue: 49.5,
      unit: "%",
      responsibleId: "tm-4",
      deadline: "Dic 2026"
    },
    {
      id: "obj-2",
      pillarId: "pil-1",
      code: "OBJ-1.2",
      name: "Reducir costo de producción por kg de café pergamino en 8%",
      kpiName: "Costo unitario por kg",
      targetValue: 13500,
      currentValue: 14700,
      unit: "COP/kg",
      responsibleId: "tm-2",
      deadline: "Nov 2026"
    },
    {
      id: "obj-3",
      pillarId: "pil-2",
      code: "OBJ-2.1",
      name: "Lograr que el canal E-commerce represente el 45% de los ingresos totales a Dic 2027",
      kpiName: "Participación E-commerce (%)",
      targetValue: 45,
      currentValue: 28,
      unit: "%",
      responsibleId: "tm-3",
      deadline: "Dic 2027"
    },
    {
      id: "obj-4",
      pillarId: "pil-2",
      code: "OBJ-2.2",
      name: "Alcanzar 1.200 pedidos mensuales recurrentes en la tienda digital",
      kpiName: "Pedidos E-commerce / mes",
      targetValue: 1200,
      currentValue: 580,
      unit: "pedidos",
      responsibleId: "tm-3",
      deadline: "Ago 2027"
    },
    {
      id: "obj-5",
      pillarId: "pil-3",
      code: "OBJ-3.1",
      name: "Mantener un Runway mínimo de liquidez de 3.5 meses de gastos operacionales",
      kpiName: "Meses de Reserva de Caja",
      targetValue: 3.5,
      currentValue: 3.1,
      unit: "meses",
      responsibleId: "tm-4",
      deadline: "Continuo"
    },
    {
      id: "obj-6",
      pillarId: "pil-3",
      code: "OBJ-3.2",
      name: "Implementar comité mensual de cruce presupuestal Real vs. Proyectado con variaciones < 5%",
      kpiName: "Desviación Presupuestal Máxima",
      targetValue: 5,
      currentValue: 6.8,
      unit: "%",
      responsibleId: "tm-1",
      deadline: "Mensual"
    },
    {
      id: "obj-7",
      pillarId: "pil-4",
      code: "OBJ-4.1",
      name: "Asegurar que el 70% del café cosechado clasifique con puntaje SCA > 85 puntos",
      kpiName: "Café Calidad Especial SCA 85+",
      targetValue: 70,
      currentValue: 62,
      unit: "%",
      responsibleId: "tm-2",
      deadline: "Dic 2026"
    }
  ],

  activities: [
    {
      id: "act-1",
      objectiveId: "obj-3",
      code: "ACT-01",
      title: "Rediseño UX/UI de la tienda E-commerce y lanzamiento de Club de Suscripciones",
      description: "Optimizar embudo de conversión, pasarela de pago Wompi y sistema de membresías mensuales de café tostado a domicilio.",
      responsibleId: "tm-3",
      startDate: "2026-02-01",
      endDate: "2026-04-30",
      budget: 18.5,
      progress: 100,
      status: "completed",
      deliverable: "Sitio web renovado con suscripción activa y tasa de conversión > 2.8%"
    },
    {
      id: "act-2",
      objectiveId: "obj-3",
      code: "ACT-02",
      title: "Desarrollo de nuevo empaque premium trilaminado con válvula y código QR de trazabilidad",
      description: "Diseño de identidad visual de bolsa 340g y 500g con storytelling del lote, variedad Geisha/Castillo y fecha de tueste.",
      responsibleId: "tm-3",
      startDate: "2026-03-15",
      endDate: "2026-05-30",
      budget: 14.0,
      progress: 100,
      status: "completed",
      deliverable: "15.000 bolsas impresas listas en bodega con sellado hermético"
    },
    {
      id: "act-3",
      objectiveId: "obj-4",
      code: "ACT-03",
      title: "Estrategia de Adquisición Digital & Pauta en Meta Ads y Google Ads",
      description: "Campañas de tráfico y conversión a tienda virtual dirigidas a consumidores de café gourmet en Bogotá, Medellín y Cali.",
      responsibleId: "tm-3",
      startDate: "2026-05-01",
      endDate: "2026-12-31",
      budget: 32.0,
      progress: 75,
      status: "in_progress",
      deliverable: "ROAS promedio sostenido > 3.8x y 600 nuevos clientes captados/mes"
    },
    {
      id: "act-4",
      objectiveId: "obj-1",
      code: "ACT-04",
      title: "Alianza estratégica de maquila de tostión certificada y control de curvas",
      description: "Negociar tarifa por volumen de tostión y curvas estandarizadas para perfiles Honey y Lavado con laboratorio de cata.",
      responsibleId: "tm-2",
      startDate: "2026-03-01",
      endDate: "2026-05-15",
      budget: 6.5,
      progress: 100,
      status: "completed",
      deliverable: "Acuerdo firmado con ahorro del 12% por kg tostado y curvas estables"
    },
    {
      id: "act-5",
      objectiveId: "obj-2",
      code: "ACT-05",
      title: "Plan de fertilización orgánica-mineral y análisis de suelos por lote",
      description: "Muestreo de nutrientes en 8 lotes productivos para aplicar dosis exacta y reducir sobrecostos en fertilizantes químicos.",
      responsibleId: "tm-5",
      startDate: "2026-04-01",
      endDate: "2026-07-30",
      budget: 15.0,
      progress: 90,
      status: "in_progress",
      deliverable: "Mapa nutricional y ahorro proyectado del 10% en plan de abono 2026-2027"
    },
    {
      id: "act-6",
      objectiveId: "obj-7",
      code: "ACT-06",
      title: "Montaje de marquesinas solares parabólicas y tanques de fermentación anaeróbica",
      description: "Ampliación de capacidad de secado lento bajo sombra y fermentaciones controladas de 48 a 72 horas para microlotes.",
      responsibleId: "tm-2",
      startDate: "2026-06-01",
      endDate: "2026-09-30",
      budget: 45.0,
      progress: 85,
      status: "in_progress",
      deliverable: "4 nuevas marquesinas operativas y sensores de brix/temperatura instalados"
    },
    {
      id: "act-7",
      objectiveId: "obj-5",
      code: "ACT-07",
      title: "Estandarización de política de pagos a proveedores y gestión de tesorería",
      description: "Negociación de plazos a 30 y 45 días con proveedores de agroinsumos y unificación de flujo de cobro e-commerce diario.",
      responsibleId: "tm-4",
      startDate: "2026-07-01",
      endDate: "2026-09-15",
      budget: 3.0,
      progress: 100,
      status: "completed",
      deliverable: "Política de tesorería aprobada con días de rotación de cartera < 12 días"
    },
    {
      id: "act-8",
      objectiveId: "obj-6",
      code: "ACT-08",
      title: "Implementación del software de costeo agrícola por lote y tablero presupuestal",
      description: "Registro digital de jornales de recolección selectiva y consumos de insumos para cruce mensual Real vs Presupuestado.",
      responsibleId: "tm-4",
      startDate: "2026-08-01",
      endDate: "2026-11-30",
      budget: 12.0,
      progress: 70,
      status: "in_progress",
      deliverable: "Dashboard operativo en tiempo real y cierres contables al día 5 de cada mes"
    },
    {
      id: "act-9",
      objectiveId: "obj-4",
      code: "ACT-09",
      title: "Campaña Comercial Corporativa B2B de Regalos Navideños de Café Especial",
      description: "Prospección a 80 empresas en Bogotá y Medellín con kits personalizados de café de origen Finca La Leonora.",
      responsibleId: "tm-3",
      startDate: "2026-09-15",
      endDate: "2026-12-15",
      budget: 10.0,
      progress: 45,
      status: "in_progress",
      deliverable: "Venta confirmada de 1.500 cajas de regalo corporativas"
    },
    {
      id: "act-10",
      objectiveId: "obj-7",
      code: "ACT-10",
      title: "Auditoría preliminar para Certificación Rainforest Alliance & Prácticas Sostenibles",
      description: "Revisión de manejo de aguas mieles, conservación de fuentes hídricas y bienestar laboral de recolectores.",
      responsibleId: "tm-5",
      startDate: "2026-10-01",
      endDate: "2027-02-28",
      budget: 16.0,
      progress: 20,
      status: "in_progress",
      deliverable: "Plan de cierre de brechas y fecha programada de auditoría final"
    },
    {
      id: "act-11",
      objectiveId: "obj-3",
      code: "ACT-11",
      title: "Expansión Internacional E-commerce B2C a Estados Unidos (Cross-border)",
      description: "Habilitación de envíos directos con DHL Express y registro FDA para venta online a clientes en EE. UU.",
      responsibleId: "tm-3",
      startDate: "2027-01-15",
      endDate: "2027-06-30",
      budget: 28.0,
      progress: 0,
      status: "not_started",
      deliverable: "Tienda habilitada en USD con envíos puerta a puerta en 4 días hábiles"
    },
    {
      id: "act-12",
      objectiveId: "obj-1",
      code: "ACT-12",
      title: "Instalación de Mini-planta propia de Tostión y Empaque al Vacío",
      description: "Adquisición de tostadora de 5 kg de tambor, selladora de nitrógeno y laboratorio de perfilación en finca.",
      responsibleId: "tm-2",
      startDate: "2027-03-01",
      endDate: "2027-08-30",
      budget: 65.0,
      progress: 0,
      status: "not_started",
      deliverable: "Planta propia operando con reducción del 40% en costos de maquila externa"
    }
  ],

  // Estructura de Proyección Financiera (Cifras en Millones de COP para 24 Meses)
  financials: {
    revenues: [
      {
        id: "rev-1",
        name: "E-commerce - Café Tostado Selección Origen (Bolsa 340g)",
        category: "Valor Agregado (E-commerce)",
        isEcommerce: true,
        projected: [
          14.5, 16.2, 18.0, 20.5, 23.0, 25.5, 28.0, 31.0, 34.0, 37.5, 42.0, 52.0,
          45.0, 48.0, 52.0, 56.0, 60.0, 65.0, 70.0, 75.0, 80.0, 86.0, 95.0, 115.0
        ],
        real: [
          15.2, 16.8, 17.5, 21.2, 24.1, 26.8, 29.5, 33.2, 35.8, 38.0, null, null,
          null, null, null, null, null, null, null, null, null, null, null, null
        ]
      },
      {
        id: "rev-2",
        name: "E-commerce - Microlotes Geisha / Exóticos & Suscripciones",
        category: "Valor Agregado (E-commerce)",
        isEcommerce: true,
        projected: [
          6.0,  7.5,  8.5,  10.0, 11.5, 13.0, 15.0, 17.0, 19.5, 22.0, 26.0, 35.0,
          28.0, 30.0, 33.0, 36.0, 40.0, 44.0, 48.0, 52.0, 57.0, 62.0, 70.0, 85.0
        ],
        real: [
          5.8,  8.0,  9.2,  10.8, 12.0, 14.2, 16.5, 18.2, 20.1, 23.5, null, null,
          null, null, null, null, null, null, null, null, null, null, null, null
        ]
      },
      {
        id: "rev-3",
        name: "Canal B2B Cafeterías Especializadas / Tiendas Aliadas",
        category: "Canal Institucional B2B",
        isEcommerce: false,
        projected: [
          12.0, 12.0, 14.0, 15.0, 16.0, 17.0, 18.0, 19.0, 20.0, 22.0, 24.0, 28.0,
          25.0, 26.0, 27.0, 29.0, 30.0, 32.0, 34.0, 35.0, 37.0, 39.0, 42.0, 48.0
        ],
        real: [
          11.5, 12.5, 13.8, 14.2, 16.5, 17.8, 17.2, 19.8, 21.0, 21.5, null, null,
          null, null, null, null, null, null, null, null, null, null, null, null
        ]
      },
      {
        id: "rev-4",
        name: "Venta Café Pergamino Seco Tradicional (Excedentes Cosecha)",
        category: "Canal Mayorista Tradicional",
        isEcommerce: false,
        projected: [
          28.0, 25.0, 35.0, 45.0, 38.0, 22.0, 18.0, 20.0, 32.0, 50.0, 58.0, 42.0,
          24.0, 22.0, 30.0, 38.0, 32.0, 20.0, 16.0, 18.0, 28.0, 44.0, 50.0, 36.0
        ],
        real: [
          29.5, 26.0, 33.0, 48.5, 36.2, 21.0, 19.2, 18.5, 30.5, 47.0, null, null,
          null, null, null, null, null, null, null, null, null, null, null, null
        ]
      },
      {
        id: "rev-5",
        name: "Kits Corporativos & Experiencias de Cata en Finca",
        category: "Experiencias & Otros",
        isEcommerce: false,
        projected: [
          2.0,  2.0,  3.0,  3.5,  4.0,  4.5,  5.0,  5.5,  6.0,  8.0, 15.0, 25.0,
          6.0,  6.0,  7.0,  8.0,  9.0, 10.0, 11.0, 12.0, 14.0, 18.0, 25.0, 38.0
        ],
        real: [
          1.8,  2.2,  3.1,  3.0,  4.5,  5.0,  4.8,  6.0,  7.2,  8.5, null, null,
          null, null, null, null, null, null, null, null, null, null, null, null
        ]
      }
    ],

    cogs: [
      {
        id: "cog-1",
        name: "Insumos Agrícolas, Fertilizantes y Manejo de Plagas",
        category: "Costos de Campo",
        projected: [
          7.5,  7.0,  9.0, 11.0,  9.5,  6.5,  5.5,  6.0,  8.5, 12.0, 13.5, 10.0,
          7.0,  6.5,  8.5, 10.0,  9.0,  6.0,  5.2,  5.8,  8.0, 11.0, 12.5,  9.2
        ],
        real: [
          7.2,  6.8,  9.4, 10.5,  9.1,  6.2,  5.8,  5.9,  8.2, 11.5, null, null,
          null, null, null, null, null, null, null, null, null, null, null, null
        ]
      },
      {
        id: "cog-2",
        name: "Mano de Obra Directa (Jornales de Recolección Selectiva)",
        category: "Costos de Campo",
        projected: [
          12.0, 10.0, 15.0, 20.0, 16.0,  9.0,  7.5,  8.5, 14.0, 22.0, 25.0, 18.0,
          11.0,  9.5, 13.5, 18.0, 15.0,  8.5,  7.0,  8.0, 13.0, 20.0, 23.0, 16.5
        ],
        real: [
          12.8, 10.5, 14.2, 21.5, 15.5,  8.8,  7.8,  8.1, 13.5, 21.0, null, null,
          null, null, null, null, null, null, null, null, null, null, null, null
        ]
      },
      {
        id: "cog-3",
        name: "Procesamiento en Beneficio Húmedo y Secado Lento",
        category: "Beneficio & Calidad",
        projected: [
          3.5,  3.0,  4.2,  5.5,  4.5,  2.8,  2.5,  2.8,  4.0,  6.0,  7.0,  5.0,
          3.2,  2.8,  4.0,  5.0,  4.2,  2.5,  2.2,  2.5,  3.8,  5.5,  6.5,  4.8
        ],
        real: [
          3.4,  2.9,  4.0,  5.2,  4.3,  2.7,  2.6,  2.9,  4.2,  5.8, null, null,
          null, null, null, null, null, null, null, null, null, null, null, null
        ]
      },
      {
        id: "cog-4",
        name: "Maquila de Tostión, Molienda y Catación Certificada",
        category: "Transformación & Valor Agregado",
        projected: [
          2.5,  2.8,  3.2,  3.8,  4.3,  4.8,  5.3,  6.0,  6.6,  7.5,  8.5, 11.0,
          9.0,  9.5, 10.5, 11.5, 12.5, 13.5, 14.5, 15.5, 17.0, 18.5, 20.5, 25.0
        ],
        real: [
          2.6,  3.0,  3.3,  4.0,  4.5,  5.1,  5.7,  6.4,  7.0,  7.8, null, null,
          null, null, null, null, null, null, null, null, null, null, null, null
        ]
      },
      {
        id: "cog-5",
        name: "Empaques Especiales con Válvula, Etiquetas y Cajas",
        category: "Transformación & Valor Agregado",
        projected: [
          1.8,  2.0,  2.3,  2.7,  3.0,  3.4,  3.8,  4.2,  4.8,  5.4,  6.2,  8.0,
          6.5,  7.0,  7.5,  8.2,  9.0,  9.8, 10.5, 11.2, 12.0, 13.2, 15.0, 18.0
        ],
        real: [
          1.9,  2.1,  2.4,  2.8,  3.2,  3.6,  4.0,  4.5,  5.0,  5.7, null, null,
          null, null, null, null, null, null, null, null, null, null, null, null
        ]
      },
      {
        id: "cog-6",
        name: "Logística de Despacho & Fletes E-commerce Directos",
        category: "Logística de Entrega",
        projected: [
          1.5,  1.7,  1.9,  2.3,  2.6,  2.9,  3.2,  3.6,  4.0,  4.5,  5.2,  6.8,
          5.5,  6.0,  6.5,  7.0,  7.7,  8.4,  9.0,  9.8, 10.5, 11.5, 13.0, 16.0
        ],
        real: [
          1.6,  1.8,  2.0,  2.4,  2.8,  3.1,  3.5,  3.9,  4.3,  4.7, null, null,
          null, null, null, null, null, null, null, null, null, null, null, null
        ]
      }
    ],

    opexAdmin: [
      {
        id: "adm-1",
        name: "Nómina Administrativa (Gerencia, Contaduría y Asistente)",
        projected: [
          8.5, 8.5, 8.5, 8.5, 8.5, 8.5, 8.5, 8.5, 8.5, 8.5, 8.5, 12.5,
          9.2, 9.2, 9.2, 9.2, 9.2, 9.2, 9.2, 9.2, 9.2, 9.2, 9.2, 13.8
        ],
        real: [
          8.5, 8.5, 8.5, 8.5, 8.5, 8.5, 8.5, 8.5, 8.5, 8.5, null, null,
          null, null, null, null, null, null, null, null, null, null, null, null
        ]
      },
      {
        id: "adm-2",
        name: "Servicios Públicos, Comunicaciones e Internet Satelital Finca",
        projected: [
          1.2, 1.2, 1.2, 1.3, 1.3, 1.3, 1.3, 1.4, 1.4, 1.4, 1.5, 1.5,
          1.5, 1.5, 1.5, 1.6, 1.6, 1.6, 1.6, 1.7, 1.7, 1.7, 1.8, 1.8
        ],
        real: [
          1.1, 1.3, 1.2, 1.2, 1.4, 1.3, 1.4, 1.3, 1.5, 1.4, null, null,
          null, null, null, null, null, null, null, null, null, null, null, null
        ]
      },
      {
        id: "adm-3",
        name: "Mantenimiento General de Instalaciones y Vías Internas",
        projected: [
          1.5, 1.5, 2.0, 1.5, 1.5, 2.0, 1.5, 1.5, 2.0, 1.5, 1.5, 2.5,
          1.8, 1.8, 2.2, 1.8, 1.8, 2.2, 1.8, 1.8, 2.2, 1.8, 1.8, 2.8
        ],
        real: [
          1.4, 1.6, 2.2, 1.3, 1.7, 1.9, 1.6, 1.4, 2.1, 1.8, null, null,
          null, null, null, null, null, null, null, null, null, null, null, null
        ]
      },
      {
        id: "adm-4",
        name: "Software de Gestión, Hosting, Dominio y Plataforma E-commerce",
        projected: [
          0.8, 0.8, 0.8, 0.9, 0.9, 0.9, 0.9, 1.0, 1.0, 1.0, 1.1, 1.1,
          1.2, 1.2, 1.2, 1.2, 1.3, 1.3, 1.3, 1.4, 1.4, 1.4, 1.5, 1.5
        ],
        real: [
          0.8, 0.8, 0.8, 0.9, 0.9, 0.9, 0.9, 1.0, 1.0, 1.0, null, null,
          null, null, null, null, null, null, null, null, null, null, null, null
        ]
      }
    ],

    opexSales: [
      {
        id: "sal-1",
        name: "Pauta Digital E-commerce (Meta Ads, Google Ads)",
        projected: [
          2.5, 3.0, 3.5, 4.0, 4.5, 5.0, 5.5, 6.0, 6.5, 7.5, 9.0, 12.0,
          8.0, 8.5, 9.0, 10.0, 10.5, 11.5, 12.5, 13.5, 15.0, 17.0, 20.0, 25.0
        ],
        real: [
          2.6, 3.1, 3.4, 4.2, 4.6, 5.3, 5.7, 6.2, 6.8, 7.6, null, null,
          null, null, null, null, null, null, null, null, null, null, null, null
        ]
      },
      {
        id: "sal-2",
        name: "Creación de Contenido, Fotografía & Community Management",
        projected: [
          1.8, 1.8, 1.8, 2.0, 2.0, 2.0, 2.0, 2.2, 2.2, 2.2, 2.5, 2.5,
          2.5, 2.5, 2.5, 2.8, 2.8, 2.8, 2.8, 3.0, 3.0, 3.0, 3.5, 3.5
        ],
        real: [
          1.8, 1.8, 1.8, 2.0, 2.0, 2.0, 2.0, 2.2, 2.2, 2.2, null, null,
          null, null, null, null, null, null, null, null, null, null, null, null
        ]
      },
      {
        id: "sal-3",
        name: "Comisiones Pasarela de Pago Online & Transacciones Web",
        projected: [
          0.7, 0.8, 0.9, 1.0, 1.2, 1.3, 1.5, 1.7, 1.9, 2.1, 2.4, 3.1,
          2.6, 2.7, 3.0, 3.2, 3.5, 3.8, 4.1, 4.4, 4.8, 5.2, 5.8, 7.0
        ],
        real: [
          0.7, 0.8, 0.9, 1.1, 1.2, 1.4, 1.6, 1.8, 2.0, 2.1, null, null,
          null, null, null, null, null, null, null, null, null, null, null, null
        ]
      }
    ],

    capex: [
      {
        id: "cap-1",
        name: "Construcción de Marquesinas Solares & Tanques Fermentación",
        projected: [
          0, 0, 0, 0, 0, 15.0, 15.0, 15.0, 0, 0, 0, 0,
          0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0
        ],
        real: [
          0, 0, 0, 0, 0, 16.0, 15.0, 14.5, 0, 0, null, null,
          null, null, null, null, null, null, null, null, null, null, null, null
        ]
      },
      {
        id: "cap-2",
        name: "Desarrollo Tecnológico E-commerce & App de Suscripción",
        projected: [
          0, 6.0, 6.5, 6.0, 0, 0, 0, 0, 0, 0, 0, 0,
          0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0
        ],
        real: [
          0, 6.0, 6.5, 6.0, 0, 0, 0, 0, 0, 0, null, null,
          null, null, null, null, null, null, null, null, null, null, null, null
        ]
      },
      {
        id: "cap-3",
        name: "Maquinaria de Tostión Propia y Laboratorio de Calidad en Finca",
        projected: [
          0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
          0, 0, 20.0, 25.0, 20.0, 0, 0, 0, 0, 0, 0, 0
        ],
        real: [
          0, 0, 0, 0, 0, 0, 0, 0, 0, 0, null, null,
          null, null, null, null, null, null, null, null, null, null, null, null
        ]
      }
    ],

    cashConfig: {
      initialCashBalance: 42.0,
      debtServiceMonthly: [
        2.5, 2.5, 2.5, 2.5, 2.5, 2.5, 2.5, 2.5, 2.5, 2.5, 2.5, 2.5,
        2.2, 2.2, 2.2, 2.2, 2.2, 2.2, 2.2, 2.2, 2.2, 2.2, 2.2, 2.2
      ],
      taxRate: 0.15
    }
  }
};
