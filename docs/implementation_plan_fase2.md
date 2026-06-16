# Plan de Implementación: Fase 2 (Proveedores, Compras y Gastos)

Este documento detalla la estrategia técnica para implementar el Módulo Administrativo (Fase 2). Con esto, el sistema pasará de ser un simple registrador de ventas a un **ERP ligero**, permitiendo calcular las verdaderas ganancias del negocio descontando los gastos operativos y el costo de la mercancía.

## Open Questions

> [!IMPORTANT]
> **Sobre el Registro de Compras de Mercancía:**
> Cuando registres que le compraste a un proveedor (ej. Office Depot), el sistema aumentará el inventario. ¿Quieres que ese gasto se reste automáticamente del efectivo de tu Caja Registradora actual, o prefieres manejar las compras independientemente de la caja diaria (pagándolas con transferencias del banco del negocio)?
> *Recomendación:* Mantenerlo independiente (como Cuentas por Pagar o simplemente registro de costo) para no descontrolar el efectivo físico que manejan los cajeros.

## Proposed Changes

### 1. Cambios en la Base de Datos (Prisma)
Se añadirán las siguientes estructuras a `schema.prisma`:
#### [MODIFY] `backend/prisma/schema.prisma`
- **Módulo de Proveedores y Compras:**
  - `Supplier` (id, nombre, contacto, rfc).
  - `PurchaseOrder` (id, folio, fecha, supplierId, total, estado).
  - `PurchaseItem` (vincula la compra con un `Product`, cantidad, costoUnitario).
- **Módulo de Gastos Operativos:**
  - `ExpenseCategory` (id, nombre, descripcion). Ej: Nómina, Renta, Servicios.
  - Modificar `CashMovement` (o crear `Expense`) para enlazarlo con `expenseCategoryId`. 
  - (Optaremos por modificar `CashMovement` para poder categorizar los "Egresos" que sacan de la caja, y tal vez crear una tabla `GeneralExpense` para gastos que no salen del cajón).

### 2. Módulo de Proveedores y Compras (Backend + Frontend)
#### [NEW] `backend/routes/purchases.js` y `backend/routes/suppliers.js`
- Endpoints CRUD para Proveedores.
- Endpoints para generar una Orden de Compra:
  - Al completarse, aumentará automáticamente el `stock` de los productos.
  - Actualizará el `precioCompra` del producto si el proveedor lo vendió más caro/barato.
  
#### [NEW] `frontend/src/pages/Purchases.tsx`
- Pantalla para registrar la llegada de nueva mercancía escaneando los códigos de barras e indicando el costo.

### 3. Sugerencia Inteligente de Compras
#### [MODIFY] `frontend/src/pages/Reports.tsx`
- En la pestaña de Valor de Almacén, ya tenemos los artículos "Agotados" y "Próximos a Agotarse".
- Se agregará un botón "Generar PDF de Sugerencia de Compra" que exportará un listado listo para enviárselo al proveedor.

### 4. Categorización de Gastos (Dashboard)
#### [NEW] `backend/routes/expenses.js`
- Permitirá dar de alta categorías de gastos fijos.
#### [MODIFY] `frontend/src/pages/CashRegister.tsx`
- Al registrar un "Egreso", permitirá seleccionar el concepto (ej. "Pago de Luz", "Flete").
#### [MODIFY] `frontend/src/pages/Dashboard.tsx`
- Mostrará un panel que confronte "Ganancia Bruta (Ventas)" vs "Gastos Operativos" para mostrar la **Utilidad Neta Real**.

## Verification Plan
1. Crear un Proveedor de prueba.
2. Registrar una Compra de mercancía y verificar que el stock y el costo del producto se actualicen solos.
3. Generar el PDF de sugerencia de stock y revisar su diseño.
4. Crear una categoría de gasto (ej. Internet), registrar un egreso en caja por ese concepto, y verificar que en el Dashboard disminuya la Utilidad Neta.
