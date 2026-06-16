# Roadmap del Sistema: Punto Escolar (POS Papelerías)

Este documento contiene la hoja de ruta técnica y funcional del sistema, estructurando las características faltantes necesarias para convertirlo en un software Premium de Punto de Venta.
Sirve como **Documento de Especificación (PRD)** para dar contexto a futuros desarrolladores o asistentes de IA.

---

## 🎯 Fase 1: Operaciones Críticas del Día a Día (Cajeros)

### 1. Sistema de Cotizaciones / Presupuestos
- **Objetivo:** Permitir guardar un carrito de compras temporal sin afectar el inventario ni registrar un ingreso.
- **Cambios en BD:**
  - Agregar estado `"COTIZACION"` en el campo `estado` del modelo `Sale`.
  - Agregar fecha de vencimiento de cotización (opcional).
- **Backend:**
  - Modificar el controlador de ventas para no descontar `stock` de los productos si el estado es `COTIZACION`.
- **Frontend:**
  - Botón "Guardar como Cotización" en el POS.
  - Pantalla para listar y cargar cotizaciones para convertirlas en ventas reales.
- **Estado:** `[x] Completado`

### 2. Devoluciones y Cambios Físicos
- **Objetivo:** Manejar artículos regresados después de una venta completada.
- **Cambios en BD:**
  - Nuevo modelo `Return` o `CreditNote` vinculado a un `SaleItem`.
  - Registrar si fue devolución de dinero o cambio por otro artículo.
- **Backend/Frontend:**
  - Interfaz en el historial de tickets para seleccionar un artículo y marcarlo como devuelto.
  - Reintegrar el producto al `stock`.
  - Registrar un `CashMovement` de EGRESO si se devuelve efectivo.
- **Estado:** `[x] Completado`

---

## 🚀 Fase 2: Control Administrativo y Proveedores (Dueños)

### 3. Gestión de Proveedores y Compras
- **Objetivo:** Registrar de dónde viene la mercancía y controlar cuentas por pagar.
- **Implementación:**
  - Modelos `Supplier`, `PurchaseOrder`, `PurchaseItem` en la BD.
  - Backend: rutas `GET/POST /api/suppliers`, `GET/POST /api/purchases`.
  - Frontend: página `Purchases.tsx` con tabs de historial de compras y gestión de proveedores.
  - Al registrar una compra se incrementa el `stock` del producto y se crea un `InventoryMovement` de ENTRADA.
- **Estado:** `[x] Completado`

### 4. Sugerencia Inteligente de Compras (Stock Mínimo)
- **Objetivo:** Reporte automático de productos que necesitan reabastecerse.
- **Implementación:**
  - Backend: `GET /api/products/low-stock` (raw SQL: `stock <= stock_minimo`).
  - Backend: `GET /api/reports/inventory/pdf` genera PDF de faltantes agrupados por categoría.
  - Frontend: pestaña "Sugerencia de Resurtido" en `Purchases.tsx` con tabla de faltantes, badges de urgencia y botón para descargar PDF.
  - Bug corregido en `dashboard.js`: el conteo de `stockBajoAlertas` usaba una comparación de campo-a-campo inválida en SQLite; ahora usa `$queryRaw`.
- **Estado:** `[x] Completado`

### 5. Categorización de Gastos Operativos
- **Objetivo:** Reporte de Utilidad Real.
- **Implementación:**
  - Modelo `ExpenseCategory` en la BD con relación a `CashMovement`.
  - Backend: `GET/POST /api/expenses/categories`.
  - Frontend (Caja): al registrar un EGRESO manual se puede asignar una categoría opcional.
  - Frontend (Dashboard): gráficas de ventas de los últimos 7 días (BarChart) y gastos del mes por categoría (PieChart) usando Recharts.
  - Dashboard ya muestra `utilidadNeta` = ganancia bruta del día − egresos categorizados.
- **Estado:** `[x] Completado`

---

## 💎 Fase 3: Funciones Premium y Fidelización

### 6. Generador e Impresión de Códigos de Barras
- **Objetivo:** Etiquetar artículos sueltos.
- **Lógica:** Usar librería (ej. `bwip-js` o `react-barcode`) para convertir el campo `sku` o `codigoBarras` en una imagen.
- **UI:** Pantalla para seleccionar productos, cantidad de etiquetas, y formato de papel PDF (ej. hojas carta con 30 etiquetas adhesivas).
- **Estado:** `[ ] Pendiente`

### 7. Monedero Electrónico (Puntos)
- **Objetivo:** Fidelización del cliente.
- **Cambios en BD:**
  - Agregar `puntosActuales Int @default(0)` al modelo `Customer`.
  - Configurar en `Setting` cuántos puntos equivale a $1 MXN (ej. `puntosPorPeso`).
- **Backend:**
  - Al completar una venta, acumular puntos en el cliente según el total.
  - Endpoint para consultar y canjear puntos en el POS.
- **Frontend:**
  - Mostrar puntos acumulados del cliente en el POS al seleccionarlo.
  - Opción de redimir puntos como descuento en la venta actual.
- **Estado:** `[ ] Pendiente`

---

## 🛠️ Modificaciones Realizadas Previamente (Completado)
- `[x]` Migración exitosa de MySQL a **SQLite** para distribución 1-clic.
- `[x]` Configuración dinámica de la base de datos alojada en el `AppData` de Windows del usuario.
- `[x]` Solución de empaquetado `electron-builder` moviendo dependencias del backend a la raíz.
- `[x]` Integración de `electron-updater` apuntando a GitHub Releases para actualizaciones automáticas OTA.
- `[x]` Manejo de logs de errores en producción mediante `electron-log`.
