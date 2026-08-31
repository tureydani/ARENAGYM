# Funcionalidad de Eliminación Lógica (Soft Delete)

## Implementación de Soft Delete para Usuarios y Productos

**Fecha de implementación:** 9 de octubre de 2025

### 📋 Resumen

Se ha implementado eliminación lógica (soft delete) para las entidades **Usuarios** y **Productos** para mantener la integridad del historial de ventas y el control de cajas, evitando la pérdida de datos críticos.

### 🔧 Cambios en la Base de Datos

#### Nuevas Columnas Agregadas:

1. **Tabla `usuarios`:**
   - `activo BOOLEAN NOT NULL DEFAULT TRUE`

2. **Tabla `productos`:**
   - `activo BOOLEAN NOT NULL DEFAULT TRUE`

#### Script de Migración:
```sql
-- Ejecutar el archivo: add_soft_delete_columns.sql
```

### 🎯 Comportamiento por Defecto

- **Consultas normales:** Solo muestran registros con `activo = TRUE`
- **Eliminación:** Cambia `activo` a `FALSE` en lugar de eliminar físicamente
- **Integridad:** Se preservan todos los registros históricos

### 📊 Nuevos Endpoints API

#### **Usuarios** (`/api/usuarios`)

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| `GET` | `/` | Usuarios activos (por defecto) |
| `GET` | `/?includeInactive=true` | Todos los usuarios (activos e inactivos) |
| `GET` | `/inactive` | Solo usuarios inactivos |
| `DELETE` | `/:id` | Eliminación lógica (soft delete) |
| `PATCH` | `/:id/restore` | Restaurar usuario eliminado |
| `DELETE` | `/:id/force` | Eliminación permanente |

#### **Productos** (`/api/productos`)

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| `GET` | `/` | Productos activos (por defecto) |
| `GET` | `/?includeInactive=true` | Todos los productos (activos e inactivos) |
| `GET` | `/inactive` | Solo productos inactivos |
| `DELETE` | `/:id` | Eliminación lógica (soft delete) |
| `PATCH` | `/:id/restore` | Restaurar producto eliminado |
| `DELETE` | `/:id/force` | Eliminación permanente |

### 🔍 Scopes de Sequelize

#### Para Usuarios y Productos:

- **`defaultScope`:** Solo registros activos (`activo: true`)
- **`withInactive`:** Todos los registros (activos e inactivos)
- **`onlyInactive`:** Solo registros inactivos (`activo: false`)

### 💡 Ejemplos de Uso

#### Eliminación Lógica:
```javascript
// Eliminar usuario lógicamente
DELETE /api/usuarios/123
// Respuesta: { message: "Usuario eliminado lógicamente", usuario: {...} }

// Eliminar producto lógicamente  
DELETE /api/productos/456
// Respuesta: { message: "Producto eliminado lógicamente", producto: {...} }
```

#### Restauración:
```javascript
// Restaurar usuario
PATCH /api/usuarios/123/restore
// Respuesta: { message: "Usuario restaurado exitosamente", usuario: {...} }

// Restaurar producto
PATCH /api/productos/456/restore  
// Respuesta: { message: "Producto restaurado exitosamente", producto: {...} }
```

#### Consultas con Inactivos:
```javascript
// Obtener todos los usuarios (incluyendo inactivos)
GET /api/usuarios?includeInactive=true

// Obtener solo usuarios inactivos
GET /api/usuarios/inactive
```

### ⚠️ Validaciones Implementadas

1. **Duplicados:** Solo valida unicidad en registros activos
2. **Stock:** Solo considera productos activos para inventario
3. **Estado:** Valida que el registro esté en el estado correcto antes de eliminar/restaurar

### 🛡️ Beneficios del Soft Delete

✅ **Conservación de historial de ventas**
✅ **Mantenimiento de integridad referencial**
✅ **Posibilidad de restaurar datos eliminados accidentalmente**
✅ **Auditoría completa de cambios**
✅ **Control de cajas sin pérdida de información**

### 🔄 Impacto en Funcionalidades Existentes

#### Ventas Rápidas:
- Solo muestra productos activos
- Validaciones de stock solo en productos activos
- Autocompletado de usuarios solo incluye usuarios activos

#### Reportes:
- Filtros automáticos para mostrar solo datos activos
- Opción para incluir datos históricos cuando sea necesario

### 🚨 Casos de Uso

#### Cuándo usar Eliminación Lógica:
- ✅ Usuario ya no es cliente activo
- ✅ Producto descontinuado
- ✅ Limpieza de catálogo

#### Cuándo usar Eliminación Permanente:
- ⚠️ Solo para datos de prueba
- ⚠️ Cumplimiento de normativas de privacidad
- ⚠️ **PRECAUCIÓN:** Puede romper integridad referencial

### 📝 Notas de Implementación

1. **Modelos Sequelize:** Actualizados con scopes para filtrado automático
2. **Controladores:** Incluyen validaciones de estado antes de operaciones
3. **Rutas:** Nuevos endpoints específicos para gestión de soft delete
4. **Base de Datos:** Índices agregados para optimizar consultas con filtro `activo`

### 🔧 Configuración Adicional

Para aplicar los cambios en la base de datos existente:

```bash
# Ejecutar el script SQL
psql -d nombre_base_datos -f add_soft_delete_columns.sql
```

### 📞 Soporte

Para dudas o problemas con la implementación de soft delete, revisar los logs del servidor o contactar al equipo de desarrollo.

---

**Implementado por:** Sistema de Gestión de Gimnasio  
**Versión:** 2.0 - Soft Delete Edition