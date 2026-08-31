# 🎯 GUÍA DE USO - NUEVAS FUNCIONALIDADES

## 📋 ACCESO AL SISTEMA COMPLETO

### 1. **Inicio de Sesión**
- Ir a: `http://localhost:3001`
- Usuario: `cgomez` / Contraseña: `1234`
- Usuario: `mfernandez` / Contraseña: `abcd`

### 2. **Dashboard Principal**
- URL: `http://localhost:3001/dashboard`
- **Tabs básicos** (siempre visibles):
  - 👥 **Clientes**: Gestión de usuarios
  - 📋 **Registros**: Inscripciones de membresías
  - 💰 **Pagos**: Control financiero

### 3. **Activar Paneles Administrativos**
🔑 **Hacer clic en el LOGO "ARENA GYM"** (esquina superior izquierda)

Se activarán **4 tabs adicionales**:
- 🎯 **Membresías** 
- 👨‍💼 **Administrativos**
- 📦 **Productos** ✨ (NUEVO)
- 💳 **Cajas** ✨ (NUEVO)

---

## 📦 GESTIÓN DE PRODUCTOS

### **Funcionalidades:**
- ✅ **Crear productos** con nombre, descripción, precio y stock
- ✅ **Editar información** y actualizar precios
- ✅ **Control de stock** visual por colores:
  - 🟢 Verde: Stock alto (>10 unidades)
  - 🟡 Amarillo: Stock bajo (1-10 unidades)  
  - 🔴 Rojo: Sin stock (0 unidades)
- ✅ **Búsqueda** por nombre o descripción
- ✅ **Exportar a CSV** con todos los datos
- ✅ **Paginación** automática (8 productos por página)

### **Cómo usar:**
1. **Ir al tab "Productos"** (panel administrativo)
2. **Crear producto**: Botón "➕ Nuevo Producto"
   - Nombre* (obligatorio)
   - Descripción (opcional)
   - Precio* (obligatorio)
   - Stock inicial (opcional, default: 0)
3. **Editar**: Botón "✏️ Editar" en cualquier fila
4. **Eliminar**: Botón "🗑️ Eliminar" (con confirmación)
5. **Exportar**: Botón "📊 Exportar CSV"

### **Validaciones:**
- Precio no puede ser negativo
- Stock no puede ser negativo
- Nombre es obligatorio
- No se puede eliminar si tiene ventas asociadas

---

## 💳 CONTROL DE CAJAS

### **Funcionalidades:**
- ✅ **Crear cajas registradoras** con descripción y saldo inicial
- ✅ **Abrir/Cerrar cajas** según operaciones
- ✅ **Control de saldos**:
  - Saldo inicial (fijo al crear)
  - Saldo actual (se actualiza con transacciones)
- ✅ **Resumen financiero** en tiempo real
- ✅ **Estados visuales**:
  - 🟢 Verde: Caja abierta (operativa)
  - 🔴 Rojo: Caja cerrada
- ✅ **Exportar datos** a CSV

### **Cómo usar:**
1. **Ir al tab "Cajas"** (panel administrativo)
2. **Crear caja**: Botón "➕ Nueva Caja"
   - Descripción* (obligatorio)
   - Saldo inicial (opcional, default: 0)
   - Estado: Abierta/Cerrada
3. **Editar**: Botón "✏️ Editar"
   - Solo descripción y estado
   - El saldo inicial NO se puede cambiar
4. **Cambiar estado**: Botón "🔒 Cerrar" / "🔓 Abrir"
5. **Eliminar**: Botón "🗑️ Eliminar" (solo si no tiene transacciones)

### **Información mostrada:**
- **Total cajas** y cuántas están abiertas
- **Saldo total** de todas las cajas
- **Fecha de apertura** de cada caja
- **Estados** en tiempo real

---

## 🔧 FUNCIONALIDADES TÉCNICAS

### **APIs Disponibles:**

#### **Productos:**
```
GET    /api/productos           - Listar todos
GET    /api/productos/:id       - Obtener por ID
POST   /api/productos           - Crear nuevo
PUT    /api/productos/:id       - Actualizar
DELETE /api/productos/:id       - Eliminar
PATCH  /api/productos/:id/stock - Actualizar stock
```

#### **Cajas:**
```
GET    /api/cajas              - Listar todas
GET    /api/cajas/resumen      - Resumen financiero
GET    /api/cajas/:id          - Obtener por ID
GET    /api/cajas/:id/movimientos - Movimientos de la caja
POST   /api/cajas              - Crear nueva
PUT    /api/cajas/:id          - Actualizar
PATCH  /api/cajas/:id/toggle   - Cambiar estado
DELETE /api/cajas/:id          - Eliminar
```

### **Base de Datos:**

#### **Tabla productos:**
```sql
- id_producto (PK, SERIAL)
- nombre (VARCHAR, NOT NULL)
- descripcion (TEXT, opcional)  
- precio (DECIMAL, NOT NULL)
- stock (INT, DEFAULT 0)
```

#### **Tabla cajas:**
```sql
- id_caja (PK, SERIAL)
- descripcion (VARCHAR)
- fecha_apertura (DATE, DEFAULT NOW)
- saldo_inicial (DECIMAL, DEFAULT 0)
- saldo_actual (DECIMAL, DEFAULT 0)
- abierta (BOOLEAN, DEFAULT TRUE)
```

---

## ⚠️ NOTAS IMPORTANTES

### **Seguridad:**
- Solo **administrativos** pueden acceder a estos paneles
- Confirmaciones para **acciones destructivas**
- **Validaciones** en frontend y backend

### **Limitaciones:**
- **Saldo inicial** de cajas no se puede modificar después de crear
- **Productos con ventas** no se pueden eliminar
- **Cajas con transacciones** no se pueden eliminar

### **Próximas funcionalidades:**
- 🛒 **Módulo de Ventas**: Registrar ventas de productos
- 📊 **Reportes**: Gráficos de ventas y movimientos
- 🔔 **Alertas**: Notificaciones de stock bajo
- 💹 **Dashboard financiero**: Resumen de ingresos/egresos

---

## 🚀 ESTADO ACTUAL

✅ **Completado:**
- Base de datos con 10 modelos sincronizados
- Frontend con 2 nuevos componentes
- Backend con APIs completas
- Validaciones y seguridad
- Exportación de datos
- Interfaz intuitiva

🎯 **Sistema listo para producción** con gestión completa de:
- Usuarios y membresías
- Productos e inventario  
- Cajas y control financiero
- Administradores del sistema

---

**Última actualización**: 8 de octubre de 2025  
**Versión**: 2.0.0 - Sistema Completo