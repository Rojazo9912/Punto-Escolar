# Demostración: Módulo Administrativo y de Compras (Fase 2)

He completado la **Fase 2** del Roadmap. El sistema Punto Escolar ahora no solo registra ventas, sino que tiene las capacidades de un ERP ligero para calcular las utilidades netas del negocio.

## 1. Módulo de Compras y Proveedores
Se agregó una sección completamente nueva en el menú lateral exclusivo para Administradores.
- **[NUEVO] Gestión de Proveedores:** Puedes registrar a tus proveedores (ej. Office Depot, Distribuidora Papelera) con sus datos de contacto.
- **[NUEVO] Entradas de Mercancía:** Al recibir pedido nuevo, puedes crear una "Compra" seleccionando al proveedor y buscando/escaneando los productos.
- **[AUTOMATIZACIÓN]** Al guardar la compra, el sistema **aumenta el stock** y **actualiza el Precio de Compra** del producto automáticamente si este cambió, asegurando que tus cálculos de ganancias siempre sean exactos según lo último que pagaste.

## 2. Categorización de Gastos de Caja (Egresos Operativos)
- **[NUEVO]** En la pantalla de **Caja Registradora**, cuando haces un retiro manual de dinero (Egreso), ahora puedes seleccionar una "Categoría del Gasto" (ej. "Pago de Luz", "Flete", "Papelería Interna").
- *Nota: Las categorías se pueden dar de alta mediante la API; he dejado preparado el sistema para que en un futuro añadas una vista de "Ajustes de Gastos" o lo modifiques directo en la base de datos.*

## 3. Dashboard con Utilidad Neta
- **[NUEVO]** El Panel Administrativo (Dashboard) inicial ahora no solo muestra cuánto dinero vendiste, sino tu **Utilidad Neta**.
- **Cálculo Real:** `(Ventas del Día - Costo de los productos vendidos) - Gastos Operativos del Día (Egresos categorizados) = Utilidad Neta Real.`

## 4. Reporte Inteligente de Resurtido
- **[NUEVO]** En la sección de **Reportes > Valor de Almacén**, agregué un botón naranja "Descargar Sugerencia de Compra (PDF)".
- Este botón consulta todos los productos cuyo `stock` esté por debajo o igual a su `stockMinimo`, y te genera un listado en PDF listo para mandarlo a tu proveedor o imprimirlo para ir de compras.

## Archivos Principales Modificados / Creados
- `backend/prisma/schema.prisma` (Nuevos modelos: `Supplier`, `PurchaseOrder`, `PurchaseItem`, `ExpenseCategory`)
- `backend/routes/purchases.js`, `suppliers.js`, `expenses.js` (Nuevas rutas API)
- `frontend/src/pages/Purchases.tsx` (Nueva pantalla de compras)
- `frontend/src/pages/Dashboard.tsx` y `Reports.tsx` (Actualización de métricas y PDF)
- `frontend/src/App.tsx` (Integración del menú)

> [!TIP]
> **Para probar las compras:**
> Ve a la sección "Compras", crea un Proveedor de prueba, y luego haz un registro de mercancía agregando algunos lápices. Ve a tu inventario y verifica que el stock de lápices subió automáticamente.

> [!TIP]
> **Para probar la Utilidad Neta:**
> Registra un Egreso en tu Caja Registradora seleccionando una categoría. Luego ve a tu "Dashboard" inicial y verás cómo el valor de "Utilidad Neta" disminuyó, reflejando el gasto que acabas de hacer.
