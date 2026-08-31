# MIGRACIÓN BASE DE DATOS - GIMNASIO CONTROL TOTAL

## 📝 RESUMEN
Se ha actualizado completamente el esquema de la base de datos para un control total del gimnasio, incluyendo nuevas funcionalidades como productos, ventas, control de caja y seguimiento administrativo mejorado.

## 🔄 MODELOS ACTUALIZADOS

### 1. Modelos Existentes Modificados:
- **administrativos**: Agregado seguimiento de fecha de contratación
- **usuarios**: Agregada relación con administrativo que registra
- **registro_membresias**: Agregada relación con administrativo
- **pagos**: Agregada relación con administrativo que registra el pago

### 2. Nuevos Modelos Creados:
- **productos**: Catálogo de productos del gimnasio
- **cajas**: Control de cajas registradoras
- **ventas**: Registro de ventas de productos
- **detalle_ventas**: Detalles de cada venta
- **movimientos_caja**: Movimientos de ingreso/egreso de caja

## 🗃️ ESTRUCTURA COMPLETA

```
┌─ administrativos (usuarios del sistema)
├─ usuarios (clientes)
├─ membresias (tipos de membresías)
├─ registro_membresias (membresías activas)
├─ pagos (pagos de membresías)
├─ productos (artículos en venta)
├─ cajas (puntos de venta)
├─ ventas (transacciones)
├─ detalle_ventas (items por venta)
└─ movimientos_caja (control financiero)
```

## 🔗 RELACIONES PRINCIPALES

1. **Usuarios → Administrativos**: Todo usuario es registrado por un admin
2. **Registro Membresías → Admin**: Todo registro tiene un admin responsable
3. **Pagos → Admin**: Todo pago es procesado por un admin
4. **Ventas → Admin**: Toda venta es realizada por un admin
5. **Ventas → Caja**: Toda venta está asociada a una caja
6. **Movimientos → Caja**: Todos los movimientos afectan una caja

## 🔧 ARCHIVOS DE CÓDIGO ACTUALIZADOS

### Backend Models (10 archivos):
- ✅ `backend-gym/models/administrativo.js` - Actualizado
- ✅ `backend-gym/models/usuario.js` - Actualizado
- ✅ `backend-gym/models/membresia.js` - Existente
- ✅ `backend-gym/models/registroMembresia.js` - Actualizado
- ✅ `backend-gym/models/pago.js` - Actualizado
- ✅ `backend-gym/models/producto.js` - Nuevo
- ✅ `backend-gym/models/caja.js` - Nuevo
- ✅ `backend-gym/models/venta.js` - Nuevo
- ✅ `backend-gym/models/detalleVenta.js` - Nuevo
- ✅ `backend-gym/models/movimientoCaja.js` - Nuevo

### Archivo de Asociaciones:
- ✅ `backend-gym/models/index.js` - Creado con todas las relaciones

## 🚀 PRÓXIMOS PASOS RECOMENDADOS

### 1. Controllers (Pendientes de crear):
```
backend-gym/controllers/
├─ productosController.js
├─ cajasController.js  
├─ ventasController.js
└─ movimientosCajaController.js
```

### 2. Routes (Pendientes de crear):
```
backend-gym/routes/
├─ productos.js
├─ cajas.js
├─ ventas.js
└─ movimientosCaja.js
```

### 3. Frontend Components (Pendientes):
```
frontend-gym/src/components/
├─ TablaProductos.jsx
├─ TablaCajas.jsx
├─ TablaVentas.jsx
├─ TablaMovimientos.jsx
├─ FormularioVenta.jsx
└─ ControlCaja.jsx
```

## 💾 MIGRACIÓN DE DATOS

### Opción 1: Base de Datos Nueva
1. Ejecutar script completo `DB__Gimnasio.txt`
2. Usar datos de prueba incluidos
3. Configurar las nuevas funcionalidades

### Opción 2: Migración desde Datos Existentes
```sql
-- 1. Agregar columnas a tablas existentes
ALTER TABLE registro_membresias ADD COLUMN id_admin INT;
ALTER TABLE pagos ADD COLUMN id_admin INT;

-- 2. Crear nuevas tablas (productos, cajas, ventas, etc.)
-- Ver archivo DB__Gimnasio.txt

-- 3. Actualizar foreign keys
ALTER TABLE registro_membresias 
ADD CONSTRAINT fk_reg_admin 
FOREIGN KEY (id_admin) REFERENCES administrativos(id_admin);
```

## ⚠️ CONSIDERACIONES IMPORTANTES

1. **Backup**: Siempre hacer backup antes de migrar
2. **Testing**: Probar todas las relaciones después de la migración
3. **Sequelize Sync**: Usar `{ force: false, alter: true }` en desarrollo
4. **Producción**: Crear migraciones individuales para producción

## 📊 NUEVAS FUNCIONALIDADES DISPONIBLES

### Gestión de Productos:
- Catálogo de productos con stock
- Control de precios
- Descripción detallada

### Control de Ventas:
- Registro de ventas por cliente
- Detalle de productos vendidos
- Total automático calculado

### Control de Caja:
- Múltiples cajas registradoras
- Saldo inicial y actual
- Estado abierto/cerrado

### Movimientos Financieros:
- Ingresos por ventas y pagos
- Egresos por desembolsos
- Seguimiento de origen
- Referencia a transacciones

## 🔍 VALIDACIONES IMPLEMENTADAS

1. **Fechas**: Automáticas con `DEFAULT CURRENT_DATE`
2. **Estados**: Check constraints para valores válidos
3. **Subtotales**: Campos calculados automáticamente
4. **Foreign Keys**: Integridad referencial completa

---

**Última actualización**: Diciembre 2024
**Estado**: Modelos implementados ✅ | Controllers pendientes ⏳ | Frontend pendiente ⏳