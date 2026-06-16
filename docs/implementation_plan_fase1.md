# Plan de Implementación: Fase 1 (Cotizaciones y Devoluciones)

Este plan detalla los cambios técnicos necesarios para implementar las Cotizaciones y las Devoluciones Parciales en el sistema Punto Escolar, según el Roadmap previamente definido.

## Open Questions

> [!IMPORTANT]
> **Sobre las Devoluciones de Efectivo:**
> Cuando un cliente devuelve un producto, ¿prefieres que el sistema reste ese dinero automáticamente de las "Ventas en Efectivo" de la caja actual del cajero, o prefieres que se registre como un "Egreso de Caja" bajo el concepto "Devolución Ticket #X"?
> *Recomendación:* Manejarlo como un Egreso es más limpio contablemente, ya que el cajero entregará físicamente el dinero de su caja y queda registro de por qué salió.

## Proposed Changes

### 1. Cambios en la Base de Datos (Prisma)
#### [MODIFY] `backend/prisma/schema.prisma`
- Añadir el campo `cantidadDevuelta Int @default(0)` en el modelo `SaleItem`. Esto nos permitirá saber de un producto vendido cuántos se han regresado, impidiendo que devuelvan más de lo que compraron.
- Ejecutar la migración de Prisma correspondiente.

### 2. Módulo de Cotizaciones
Reemplazaremos el sistema temporal de "Ventas Suspendidas" (que se borraba si se apagaba la computadora) por un sistema persistente de "Cotizaciones" usando el modelo de Ventas.

#### [MODIFY] `backend/routes/sales.js`
- Modificar el endpoint `POST /` para aceptar una bandera `isQuotation`.
  - Si es cotización: Generar folio `COT-YYYYMMDD-XXXX`. No descontar stock. No sumar a la caja registradora. Guardar con `estado: 'COTIZACION'`.
- Reemplazar los endpoints de `suspended` por endpoints `/quotations` que lean, carguen y eliminen estos registros de la base de datos real.

#### [MODIFY] `frontend/src/pages/POS.tsx`
- Cambiar la terminología en la UI de "Suspender" a "Cotizar".
- Actualizar las peticiones fetch para comunicarse con los nuevos endpoints de cotizaciones.

### 3. Módulo de Devoluciones Parciales
Actualmente solo se puede cancelar TODA la venta. Agregaremos la capacidad de devolver productos individuales.

#### [MODIFY] `backend/routes/sales.js`
- Crear un nuevo endpoint `POST /:id/return`.
- Lógica:
  - Recibe los artículos a devolver (`[ { saleItemId, cantidad } ]`).
  - Verifica que la cantidad a devolver no exceda la comprada.
  - Actualiza `cantidadDevuelta` en `SaleItem`.
  - Aumenta el stock del producto devuelto.
  - Registra un movimiento de inventario de entrada por devolución.
  - Registra un Egreso en la caja registradora del cajero actual por el monto devuelto.

#### [MODIFY] Pantalla de Historial de Ventas (Frontend)
- Añadir interfaz para seleccionar qué artículos de un ticket específico se desean devolver.

## Verification Plan
1. Crear una venta normal con 3 artículos.
2. Hacer una devolución parcial de 1 artículo: verificar que el stock regrese y la caja disminuya (o registre egreso).
3. Intentar devolver 3 artículos cuando solo se compraron 2 restantes (debe dar error).
4. Crear una cotización: verificar que el stock NO disminuya.
5. Apagar y encender el backend y verificar que la cotización siga existiendo para ser cargada.
