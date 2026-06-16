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
- **Cambios en BD:**
  - Nuevo modelo `Supplier` (id, nombre, contacto, RFC).
  - Nuevo modelo `PurchaseOrder` (vinculado a Supplier y User).
  - Nuevo modelo `PurchaseItem` (vinculado a Product).
- **Estado:** `[ ] Pendiente`

### 4. Sugerencia Inteligente de Compras (Stock Mínimo)
- **Objetivo:** Reporte automático de productos que necesitan reabastecerse.
- **Lógica:** Consulta al modelo `Product` filtrando donde `stock <= stockMinimo`.
- **UI:** Botón para generar un PDF con la lista de faltantes agrupada por categoría.
- **Estado:** `[ ] Pendiente`

### 5. Categorización de Gastos Operativos
- **Objetivo:** Reporte de Utilidad Real.
- **Cambios en BD:**
  - Nuevo modelo `ExpenseCategory` (ej. Nómina, Luz, Papelería interna).
  - Modificar `CashMovement` para incluir un `expenseCategoryId` opcional.
- **UI:** Gráficas de ganancias vs gastos en el Dashboard.
- **Estado:** `[ ] Pendiente`

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
  - Agregar `puntosActuales Int` al modelo `Customer`.
  - Configurar en `Setting` cuántos puntos equivale a $1 MXN.
- **Estado:** `[ ] Pendiente`

---

## 🛠️ Modificaciones Realizadas Previamente (Completado)
- `[x]` Migración exitosa de MySQL a **SQLite** para distribución 1-clic.
- `[x]` Configuración dinámica de la base de datos alojada en el `AppData` de Windows del usuario.
- `[x]` Solución de empaquetado `electron-builder` moviendo dependencias del backend a la raíz.
- `[x]` Integración de `electron-updater` apuntando a GitHub Releases para actualizaciones automáticas OTA.
- `[x]` Manejo de logs de errores en producción mediante `electron-log`.
