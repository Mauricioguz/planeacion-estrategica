# Finca La Leonora - Sistema de Planeación Estratégica & Control Financiero

Plataforma interactiva para el seguimiento de la planeación estratégica, proyecciones financieras a 1 y 2 años (Estado de Resultados y Flujo de Caja), control de variaciones "Real vs. Proyección" y cronograma de actividades operativas para **Finca La Leonora**.

---

## 🌟 Características Principales

1. **Cuadro de Mando Ejecutivo (Dashboard)**:
   - Indicadores en tiempo real: Ventas Totales Reales, % Participación E-commerce (Valor Agregado), Margen Bruto %, EBITDA, Saldo de Caja y % Avance del Plan Estratégico.
   - 4 Gráficos interactivos: Comparativo Real vs. Proyección, Mix de Ventas por Canal, Flujo de Caja y Cumplimiento de Actividades por Líder.

2. **Direccionamiento Estratégico**:
   - 4 Pilares estratégicos ponderados:
     - *Rentabilidad y Eficiencia de Costos (25%)*
     - *Posicionamiento & Venta de Mayor Valor Agregado (E-commerce) (35%)*
     - *Manejo Administrativo y Financiero (20%)*
     - *Excelencia Agrícola, Calidad en Origen & Sostenibilidad (20%)*
   - Objetivos estratégicos, metas cuantitativas (KPIs), línea base, plazos y líderes responsables asignados.
   - Posibilidad de crear nuevos objetivos estratégicos.

3. **Cronograma y Control de Actividades**:
   - **Diagrama de Gantt Interactivo**: Visualización temporal de 12 o 24 meses con barras de avance por pilar y alertas.
   - **Tablero Kanban**: Columnas por estado (*No Iniciadas*, *En Curso*, *En Riesgo*, *Completadas*).
   - **Lista Detallada**: Matriz con entregables verificables, presupuestos, fechas y estado.
   - Filtros instantáneos por Responsable, Pilar Estratégico y Estado.
   - Formulario modal para registrar nuevas actividades o editar existentes.

4. **Proyecciones Financieras (P&G y Flujo de Caja a 12 y 24 Meses)**:
   - Selector de horizonte temporal: **1 Año (2026)** o **2 Años (2026 - 2027)**.
   - **Estado de Resultados (P&G)**: Ingresos por canal (E-commerce de café especial tostado, microlotes geisha, canal B2B cafeterías, venta tradicional pergamino seco), Costo de Ventas (insumos, jornales de cosecha, beneficio, tostión, empaque trilaminado y fletes), Margen Bruto %, OPEX Administrativo, OPEX Ventas/Marketing digital, EBITDA, provisión de impuestos y Utilidad Neta.
   - **Flujo de Caja Proyectado**: Saldo inicial, recaudos de contado de e-commerce, cartera tradicional, salidas operativas, inversiones de capital (CAPEX: secadores solares, plataforma e-commerce, maquinaria de tostión), servicio de deuda y saldo final en bancos.

5. **Control de Gestión: Cruce Real vs. Proyección**:
   - Selector del mes de corte a evaluar (ej. Octubre 2026).
   - Celdas con **cifras reales editables** directamente en pantalla con botón para guardar.
   - Cálculo automático de variaciones ($ diferencia y % de variación).
   - Semáforos inteligentes:
     - 🟢 **Verde**: Favorable / En meta.
     - 🟡 **Amarillo**: Desviación moderada (<10%).
     - 🔴 **Rojo**: Desviación crítica.
   - Columna para documentar causas y definir planes de acción correctivos para el comité directivo.

6. **Portabilidad y Respaldo**:
   - **Exportación nativa a Excel (`.xlsx`)**: Descarga automática en 1 clic de 2 hojas de cálculo con el modelo financiero completo y el cronograma.
   - **Respaldo JSON**: Exportación y restauración de copias de seguridad de todo el sistema.
   - **Guardado Automático**: Los datos se conservan en el navegador (`LocalStorage`).

---

## 🚀 Cómo Ejecutar la Aplicación

### Opción A (Recomendada y más sencilla)
Haz doble clic en el archivo `index.html` para abrirlo en cualquier navegador (Google Chrome, Microsoft Edge, Mozilla Firefox, Safari). Funciona de forma autónoma sin necesidad de instalar servidores ni dependencias.

### Opción B (Con servidor local)
Si prefieres servirla vía HTTP:
```bash
python -m http.server 8080
```
Y abre tu navegador en: [http://localhost:8080](http://localhost:8080)

---

## 📁 Estructura de Archivos

- `index.html`: Estructura semántica de la aplicación y modales.
- `styles.css`: Sistema de diseño premium, temas claro/oscuro y componentes visuales.
- `app.js`: Lógica de negocio, controladores de eventos, gráficas y motor de cálculos.
- `data.js`: Datos base iniciales y estructura del plan 2026–2027 de Finca La Leonora.
- `assets/logo.jpg`: Emblema de marca de Finca La Leonora.
