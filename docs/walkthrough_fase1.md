# Demostración: Cotizaciones y Devoluciones Parciales (Fase 1)

He implementado con éxito todas las características requeridas para la **Fase 1**, mejorando la robustez del sistema y añadiendo funcionalidades críticas para la operativa diaria del negocio.

## 1. Cotizaciones Persistentes
El antiguo sistema de "Ventas Suspendidas" que se borraba al apagar la computadora fue sustituido por completo.
- **[NUEVO]** Ahora, en la pantalla de Punto de Venta (POS), presionar `F3: Cotización` guarda un ticket formal con el prefijo `COT-YYYYMMDD-XXXX`.
- **[NUEVO]** Las cotizaciones se guardan directamente en la base de datos (SQLite), por lo que sobrevivirán a reinicios, cortes de luz y actualizaciones.
- **[SEGURIDAD]** Generar una cotización **NO** descuenta artículos del stock ni requiere que el cajero tenga su caja abierta.

## 2. Devoluciones Parciales y Reintegros de Efectivo
Antes el sistema solo permitía la cancelación de un ticket completo (TODO o NADA). Ahora se implementaron las devoluciones parciales precisas.
- **[NUEVO]** En la pestaña de **Reportes > Resumen de Ventas**, cada venta completada ahora tiene un botón rojo de **"Devolver"**.
- **[NUEVO]** Al hacer clic, se abre una ventana modal interactiva donde puedes elegir con botones (+ / -) la cantidad exacta a devolver de *cada producto individual* del ticket.
- **[SEGURIDAD]** El sistema impide matemáticamente devolver más artículos de los que originalmente se compraron en ese ticket.
- **[AUTOMATIZACIÓN]** Al procesar la devolución:
  1. El stock del artículo devuelto regresa automáticamente al inventario.
  2. Se registra un movimiento de entrada al almacén por concepto de "Devolución".
  3. Se genera un **Egreso de Caja** (salida de efectivo) en la caja registradora activa del cajero, restando el dinero devuelto del "Efectivo Físico Esperado" para que no le falte dinero en el corte de caja.

## Archivos Modificados
- `backend/prisma/schema.prisma` (Añadido campo `cantidadDevuelta` a los items vendidos)
- `backend/routes/sales.js` (Lógica central del backend reescrita)
- `frontend/src/pages/POS.tsx` (Flujo de cotizaciones)
- `frontend/src/pages/Reports.tsx` (Botones de devolución modal)

> [!TIP]
> **Para probar las Cotizaciones:**
> Ve al Punto de Venta, agrega varios productos y haz clic en "F3: Cotización". Luego cierra el programa, vuélvelo a abrir y dale al botón de "Cotizaciones" (el ícono de la carpeta); tu cotización seguirá ahí, lista para cobrarse.

> [!TIP]
> **Para probar las Devoluciones:**
> Crea una venta normal de 3 libretas. Ve a la pantalla de "Reportes y Analíticas", busca esa venta en la tabla y presiona "Devolver". Elige devolver 1 libreta. Al ir al "Control de Caja" verás registrado el retiro automático de dinero por esa libreta.
