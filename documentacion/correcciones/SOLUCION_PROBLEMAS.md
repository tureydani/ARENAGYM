# 🚨 SOLUCIÓN DE PROBLEMAS COMUNES

## ❌ **ERRORES FRONTEND**

### **Error: "Cannot read properties of undefined (reading 'map')"**
```javascript
// ❌ Problema:
{paginatedItems.map((producto) => (...))}

// ✅ Solución:
const paginatedItems = Array.isArray(paginatedData) ? paginatedData : [];
{paginatedItems.map((producto) => (...))}
```

**Causa**: El hook `usePagination` devuelve `paginatedData`, no `paginatedItems`

### **Error: "productos.filter is not a function"**
```javascript
// ❌ Problema:
const { paginatedItems } = usePagination(productos.filter(...));

// ✅ Solución:
const productosArray = Array.isArray(productos) ? productos : [];
const { paginatedData } = usePagination(productosArray.filter(...));
```

**Causa**: API puede devolver `null` o `undefined` en lugar de array

### **Error: "Export doesn't exist in target module"**
```javascript
// ❌ Problema:
import { Button } from './ui/Button';

// ✅ Solución:
import Button from './ui/Button';
```

**Causa**: Componentes UI usan `export default`, no named exports

### **Error: "api is not a function"**
```javascript
// ❌ Problema:
import { api } from '../utils/api';

// ✅ Solución:
import api from '../utils/api';
```

**Causa**: API utility usa `export default`

---

## ❌ **ERRORES BACKEND**

### **Error: "Cannot find module '../models'"**
```javascript
// ❌ Problema:
const { Producto } = require('../models');

// ✅ Solución:
const { Producto } = require('../models/index');
```

**Causa**: Ruta incorrecta al archivo de índice de modelos

### **Error: "Producto is not defined"**
```javascript
// ❌ Problema en models/index.js:
// No se exporta el modelo

// ✅ Solución:
module.exports = {
  Usuario,
  Administrativo,
  Membresia,
  RegistroMembresia,
  Pago,
  Producto,    // ← Asegurar que esté incluido
  Caja,
  Venta,
  DetalleVenta,
  MovimientoCaja
};
```

### **Error: "Table doesn't exist"**
```bash
# ❌ Problema:
# Tablas no creadas en la base de datos

# ✅ Solución:
# 1. Ejecutar script SQL completo
# 2. O usar Sequelize sync:
sequelize.sync({ force: false, alter: true })
```

---

## ❌ **ERRORES DE CONEXIÓN**

### **Error: "ECONNREFUSED localhost:3000"**
```bash
# ❌ Problema:
# Backend no está ejecutándose

# ✅ Solución:
cd backend-gym
node app.js
# Verificar: "Servidor corriendo en puerto 3000"
```

### **Error: "CORS Policy"**
```javascript
// ❌ Problema:
// CORS no configurado

// ✅ Solución en app.js:
const cors = require('cors');
app.use(cors());
```

---

## ❌ **ERRORES DE PAGINACIÓN**

### **Error: Hook usePagination no devuelve datos**
```javascript
// ❌ Problema:
const { paginatedItems } = usePagination(data);

// ✅ Solución:
const { 
  paginatedData,     // ← Nombre correcto
  currentPage,
  totalPages,
  nextPage,          // ← No goToNextPage
  prevPage           // ← No goToPreviousPage
} = usePagination(data);
```

---

## ❌ **ERRORES DE VALIDACIÓN**

### **Error: "Validation error"**
```javascript
// ❌ Problema:
// Datos inválidos enviados al backend

// ✅ Solución frontend:
if (!formData.nombre.trim() || !formData.precio.trim()) {
  alert('Campos obligatorios faltantes');
  return;
}

// ✅ Solución backend:
if (!nombre || !precio) {
  return res.status(400).json({ 
    error: 'Los campos nombre y precio son obligatorios' 
  });
}
```

---

## 🔧 **COMANDOS DE DIAGNÓSTICO**

### **Verificar Backend**
```bash
# Probar API manualmente:
curl http://localhost:3000/api/productos
curl http://localhost:3000/api/cajas

# Ver logs del servidor:
# Revisar terminal donde corre `node app.js`
```

### **Verificar Frontend**
```bash
# Ver consola del navegador:
# F12 → Console
# Buscar errores en rojo

# Verificar Network tab:
# F12 → Network → Ver requests a API
```

### **Verificar Base de Datos**
```sql
-- Conectar a PostgreSQL y verificar:
\l                              -- Listar bases de datos
\c nombre_base_datos           -- Conectar a BD
\dt                            -- Listar tablas
SELECT * FROM productos LIMIT 5;  -- Verificar datos
SELECT * FROM cajas LIMIT 5;      -- Verificar datos
```

---

## ✅ **CHECKLIST DE SOLUCIÓN**

### **Cuando algo no funciona:**

1. **Backend** ✅
   - [ ] Servidor iniciado en puerto 3000
   - [ ] Modelos sincronizados en consola
   - [ ] Rutas configuradas en app.js
   - [ ] Base de datos conectada

2. **Frontend** ✅
   - [ ] Servidor iniciado en puerto 3001
   - [ ] Sin errores en consola del navegador
   - [ ] Imports correctos (default vs named)
   - [ ] Arrays validados antes de usar .map()

3. **API** ✅
   - [ ] URLs correctas (localhost:3000/api/...)
   - [ ] CORS configurado
   - [ ] Métodos HTTP correctos (GET, POST, PUT, DELETE)
   - [ ] Datos en formato JSON

4. **Datos** ✅
   - [ ] Tablas creadas en BD
   - [ ] Datos de prueba insertados
   - [ ] Validaciones cumplidas
   - [ ] Relaciones funcionando

---

## 🎯 **PASOS DE RECUPERACIÓN RÁPIDA**

Si todo falla, seguir estos pasos en orden:

1. **Reiniciar Backend:**
   ```bash
   Ctrl+C  # Detener servidor
   cd backend-gym
   node app.js  # Reiniciar
   ```

2. **Reiniciar Frontend:**
   ```bash
   Ctrl+C  # Detener servidor
   cd frontend-gym
   npm run dev  # Reiniciar
   ```

3. **Limpiar Cache:**
   ```bash
   # Frontend:
   rm -rf .next
   npm run dev
   
   # Navegador:
   Ctrl+Shift+R  # Hard refresh
   ```

4. **Verificar Conexiones:**
   - Backend: http://localhost:3000/api/productos
   - Frontend: http://localhost:3001/dashboard

---

**Última actualización**: 8 de octubre de 2025
**Estado**: Todos los errores conocidos resueltos ✅