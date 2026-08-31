# Sistema de Soft Delete Implementado

## Descripción
Se ha implementado un sistema profesional de eliminación lógica (soft delete) para usuarios, productos y membresías que preserva la integridad de los registros de pagos y ventas.

## Entidades con Soft Delete
- ✅ **Usuarios** (`usuarios` table)
- ✅ **Productos** (`productos` table)  
- ✅ **Membresías** (`membresias` table)
- ✅ **Administrativos** (`administrativos` table)

## Campo Implementado
- **Campo**: `activo` (BOOLEAN)
- **Default**: `true`
- **Índice**: Creado para optimizar consultas

## API Endpoints

### Usuarios
- `GET /usuarios` - Solo usuarios activos
- `GET /usuarios?includeInactive=true` - Todos los usuarios
- `GET /usuarios/inactive` - Solo usuarios inactivos
- `GET /usuarios/:id` - Un usuario (activo o inactivo)
- `DELETE /usuarios/:id` - Soft delete (marcar como inactivo)
- `PUT /usuarios/:id/restore` - Restaurar usuario
- `DELETE /usuarios/:id/force` - Eliminación permanente

### Productos
- `GET /productos` - Solo productos activos
- `GET /productos?includeInactive=true` - Todos los productos
- `GET /productos/inactive` - Solo productos inactivos
- `GET /productos/:id` - Un producto (activo o inactivo)
- `DELETE /productos/:id` - Soft delete (marcar como inactivo)
- `PUT /productos/:id/restore` - Restaurar producto
- `DELETE /productos/:id/force` - Eliminación permanente

### Administrativos
- `GET /administrativos` - Solo administrativos activos
- `GET /administrativos?includeInactive=true` - Todos los administrativos
- `GET /administrativos/inactive` - Solo administrativos inactivos
- `GET /administrativos/:id` - Un administrativo (activo o inactivo)
- `DELETE /administrativos/:id` - Soft delete (marcar como inactivo)
- `PUT /administrativos/:id/restore` - Restaurar administrativo
- `DELETE /administrativos/:id/force` - Eliminación permanente

## Scopes de Sequelize

### Implementados en todos los modelos:
```javascript
defaultScope: {
  where: { activo: true }  // Solo registros activos
},
scopes: {
  withInactive: {},          // Todos los registros
  onlyInactive: {            // Solo registros inactivos
    where: { activo: false }
  }
}
```

## Ventajas del Sistema

### 1. Preservación de Datos
- Los pagos mantienen referencia a usuarios/productos/membresías
- Las ventas conservan la información histórica
- Los reportes financieros permanecen íntegros

### 2. Recuperación de Datos
- Posibilidad de restaurar registros eliminados por error
- Auditoría completa de eliminaciones
- Historial de cambios preservado

### 3. Performance
- Índices optimizados para consultas con filtro `activo`
- Consultas por defecto solo muestran registros activos
- Opción de incluir inactivos cuando sea necesario

## Pasos para Completar la Implementación

### 1. Ejecutar Scripts SQL
```sql
-- Para membresías (ejecutar en PostgreSQL)
\i execute_membresias_soft_delete.sql

-- Para administrativos (ejecutar en PostgreSQL)
\i add_soft_delete_administrativos.sql
```

### 2. Reiniciar Backend
```bash
cd backend-gym
npm restart
```

### 3. Actualizar Frontend (Opcional)
- Agregar indicadores visuales para registros inactivos
- Implementar botones de restauración
- Mostrar filtros activo/inactivo

## Ejemplos de Uso

### Eliminar Lógicamente
```javascript
// DELETE /usuarios/123
// Respuesta: { message: "Usuario eliminado lógicamente", usuario: {...} }
```

### Restaurar
```javascript
// PUT /usuarios/123/restore
// Respuesta: { message: "Usuario restaurado exitosamente", usuario: {...} }
```

### Consultar Incluyendo Inactivos
```javascript
// GET /productos?includeInactive=true
// Retorna todos los productos (activos e inactivos)
```

## Consideraciones Importantes

1. **Eliminación Permanente**: Solo usar `force` cuando esté completamente seguro
2. **Integridad Referencial**: El soft delete preserva las relaciones con pagos y ventas
3. **Performance**: Las consultas por defecto son más rápidas al filtrar solo activos
4. **Auditoría**: Todos los cambios quedan registrados para auditoría

## Estado Actual
- ✅ Modelos actualizados con soft delete
- ✅ Controladores con métodos completos
- ✅ Rutas configuradas
- ✅ Scripts SQL preparados
- ⚠️ Pendiente: Ejecutar script para membresías
- ⚠️ Pendiente: Ejecutar script para administrativos
- ⚠️ Pendiente: Actualizar frontend (opcional)

Este sistema proporciona una solución profesional que mantiene la integridad de los datos financieros mientras permite la gestión flexible de registros maestros.