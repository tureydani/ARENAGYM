# Guía de Resolución de Problemas - Soft Delete

## ❌ Problema Reportado
"No logra hacer el eliminado lógico" después de ejecutar el script de base de datos.

## 🔍 Pasos de Diagnóstico

### 1. Verificar que el Backend esté ejecutándose
```powershell
# Abrir terminal en: C:\Users\lenovo\Desktop\Gimnasio\backend-gym
npm start
```

**Salida esperada:**
```
Base de datos conectada y modelos sincronizados
Servidor corriendo en puerto 3000
```

### 2. Verificar que la columna 'activo' existe en la base de datos
Ejecutar en PostgreSQL:
```sql
-- Verificar estructura de la tabla membresias
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'membresias' 
ORDER BY ordinal_position;

-- Debe mostrar la columna 'activo' de tipo 'boolean'
```

### 3. Probar los endpoints manualmente

#### Obtener membresías activas:
```powershell
Invoke-RestMethod -Uri "http://localhost:3000/membresias" -Method Get
```

#### Obtener todas las membresías (incluyendo inactivas):
```powershell
Invoke-RestMethod -Uri "http://localhost:3000/membresias?includeInactive=true" -Method Get
```

#### Eliminar lógicamente una membresía:
```powershell
Invoke-RestMethod -Uri "http://localhost:3000/membresias/1" -Method Delete
```

#### Restaurar una membresía:
```powershell
$body = @{} | ConvertTo-Json
Invoke-RestMethod -Uri "http://localhost:3000/membresias/1/restore" -Method Put -Body $body -ContentType "application/json"
```

## 🔧 Posibles Causas y Soluciones

### Causa 1: Backend no está ejecutándose
**Síntoma:** Error de conexión al hacer requests
**Solución:** 
```powershell
cd C:\Users\lenovo\Desktop\Gimnasio\backend-gym
npm start
```

### Causa 2: La columna 'activo' no se agregó correctamente
**Síntoma:** Error de SQL sobre columna inexistente
**Solución:** Ejecutar en PostgreSQL:
```sql
ALTER TABLE membresias 
ADD COLUMN IF NOT EXISTS activo BOOLEAN DEFAULT true NOT NULL;
```

### Causa 3: Problema en los scopes de Sequelize
**Síntoma:** No filtra correctamente las membresías activas/inactivas
**Solución:** Verificar que el modelo tenga:
```javascript
defaultScope: {
  where: { activo: true }
},
scopes: {
  withInactive: {},
  onlyInactive: {
    where: { activo: false }
  }
}
```

### Causa 4: Error en el controlador
**Síntoma:** Errores 500 al intentar eliminar
**Solución:** Verificar que el controlador use `scope('withInactive')` para buscar registros.

## ✅ Verificación Final

Después de aplicar las correcciones, probar:

1. **Crear una membresía de prueba:**
```powershell
$body = @{
  tipo = "Prueba Soft Delete"
  duracion_dias = 30
  precio = 100.00
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:3000/membresias" -Method Post -Body $body -ContentType "application/json"
```

2. **Eliminar lógicamente:**
```powershell
Invoke-RestMethod -Uri "http://localhost:3000/membresias/[ID]" -Method Delete
```

3. **Verificar que no aparece en consulta normal:**
```powershell
Invoke-RestMethod -Uri "http://localhost:3000/membresias" -Method Get
```

4. **Verificar que aparece con includeInactive:**
```powershell
Invoke-RestMethod -Uri "http://localhost:3000/membresias?includeInactive=true" -Method Get
```

## 🚨 Comandos de Emergencia

Si nada funciona, reiniciar completamente:

```powershell
# 1. Detener el backend (Ctrl+C)
# 2. Limpiar cache de Node
npm cache clean --force

# 3. Reinstalar dependencias
npm install

# 4. Reiniciar
npm start
```

## 📋 Estado Esperado del Sistema

- ✅ Backend corriendo en puerto 3000
- ✅ Columna 'activo' en tabla membresias
- ✅ Modelos con scopes correctos
- ✅ Controladores usando soft delete
- ✅ Rutas configuradas correctamente

¡El soft delete debería funcionar correctamente después de seguir estos pasos!