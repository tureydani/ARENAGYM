# 🏋️ Sistema de Gestión de Gimnasio

## 📋 Descripción del Proyecto

Sistema completo de gestión para gimnasios desarrollado con tecnologías modernas. Incluye manejo de usuarios, membresías, pagos, ventas, control de stock y caja con funcionalidades avanzadas como soft delete y notificaciones en tiempo real.

## 🚀 Características Principales

### ✅ **Gestión Integral**
- **Usuarios:** Registro, edición y gestión con soft delete
- **Membresías:** Control de tipos, fechas y renovaciones
- **Pagos:** Registro rápido con integración automática a caja
- **Ventas:** Sistema completo con control de stock
- **Productos:** Gestión de inventario con alertas automáticas
- **Cajas:** Control financiero con movimientos automáticos

### ✅ **Funcionalidades Avanzadas Recientes**
- **Resta Automática en Caja:** Al eliminar pagos/ventas se resta automáticamente del saldo
- **Notificaciones Detalladas:** El navegador muestra impacto exacto en caja y stock
- **Manejo de Usuarios Inactivos:** Eliminación de pagos/ventas vinculados a usuarios eliminados
- **Transacciones Seguras:** Rollback automático en caso de errores

### ✅ **Sistema de Soft Delete**
- Eliminación lógica en todas las tablas
- Preservación de historiales y relaciones
- Restauración de registros eliminados
- Filtros automáticos para mostrar solo registros activos

## 🛠️ Tecnologías Utilizadas

### Backend
- **Node.js** con Express
- **Sequelize** ORM con PostgreSQL
- **Soft Delete** completo
- **Triggers** de base de datos para automatización

### Frontend
- **Next.js 15.5.4** con Turbopack
- **React 19.1.0**
- **TailwindCSS** para estilos
- **SweetAlert2** para notificaciones

### Base de Datos
- **PostgreSQL** con triggers automáticos
- **Índices optimizados** para rendimiento
- **Constraints y validaciones** a nivel de BD

## 🚀 Instalación y Configuración

### Prerrequisitos
- Node.js 18+ 
- PostgreSQL 12+
- npm o yarn

### Pasos de Instalación

```bash
# 1. Clonar el repositorio
git clone <url-del-repo-nuevo>
cd Gimnasio/frontend-gym

# 2. Instalar dependencias
npm install

# 3. Configurar Base de Datos (Postgres en Supabase u otro proveedor)
# Ejecutar el script DB__Gimnasio.txt en PostgreSQL

# 4. Variables de Entorno
# Crear archivo .env.local en frontend-gym con:
DB_NAME=postgres
DB_USER=tu_usuario
DB_PASS=tu_password
DB_HOST=tu_host
DB_PORT=5432
DB_SSL=true
```

### Ejecución

```bash
cd frontend-gym
npm run dev   # http://localhost:3001 (frontend + API routes en /api/*)
```

## 📁 Estructura del Proyecto

```
Gimnasio/
├── frontend-gym/           # Aplicación Next.js (frontend + API, un solo proyecto)
│   └── src/
│       ├── app/
│       │   ├── api/        # Rutas de API (antes backend-gym, ahora Next.js Route Handlers)
│       │   └── dashboard/  # Páginas de la aplicación
│       ├── components/     # Componentes reutilizables
│       ├── lib/db/         # Sequelize: conexión y modelos
│       └── styles/         # Estilos CSS/Tailwind
├── documentacion/          # Documentación completa
│   ├── principal/          # Docs principales
│   ├── correcciones/       # Historial de correcciones
│   ├── funcionalidades/    # Documentación de features
│   └── guias/              # Guías de uso
└── *.sql                   # Scripts de base de datos
```

## 🎯 Funcionalidades por Módulo

### 👥 **Gestión de Usuarios**
- Registro con validaciones
- Búsqueda y filtros avanzados
- Eliminación suave (soft delete)
- Historial de actividad

### 🏷️ **Membresías**
- Tipos de membresía configurables
- Control de fechas de vencimiento
- Renovaciones automáticas
- Reportes de membresías activas

### 💰 **Sistema de Pagos**
- Registro rápido con autocompletado
- **NUEVO:** Resta automática de caja al eliminar
- **NUEVO:** Notificaciones con impacto en saldo
- Búsqueda avanzada por cliente/fecha
- Exportación a PDF/Excel

### 🛒 **Ventas y Productos**
- Control de stock automático
- **NUEVO:** Restauración de stock al eliminar ventas
- **NUEVO:** Notificaciones detalladas de cambios
- Alertas de stock bajo
- Historial de movimientos

### 💼 **Control de Caja**
- Movimientos automáticos por pagos/ventas
- **NUEVO:** Resta automática al eliminar transacciones
- Balance en tiempo real
- Reportes financieros

## 🔧 APIs Principales

### Endpoints de Pagos
```
GET    /api/pagos              # Listar pagos
POST   /api/pagos              # Crear pago
DELETE /api/pagos/:id          # Eliminar pago (con resta automática)
```

### Endpoints de Ventas
```
GET    /api/ventas             # Listar ventas  
POST   /api/ventas             # Crear venta
DELETE /api/ventas/:id         # Eliminar venta (con restauración de stock)
```

## 🔒 Funciones de Seguridad

- Validaciones en frontend y backend
- Transacciones de base de datos para consistencia
- Manejo de errores con rollback automático
- Logs de actividad para auditoría

## 📊 Reportes y Exportaciones

- **Pagos:** PDF y Excel con filtros por fecha
- **Ventas:** Reportes detallados con productos
- **Stock:** Inventario actual y movimientos
- **Caja:** Balance y movimientos financieros

## 🐛 Resolución de Problemas

### Problemas Comunes
1. **Error 404 al eliminar pagos:** Resuelto con `Usuario.scope('withInactive')`
2. **Duplicación de registros:** Triggers optimizados
3. **Inconsistencias de caja:** Transacciones atómicas implementadas

### Logs de Errores
```bash
# Backend logs
cd backend-gym
npm run logs

# Frontend logs  
cd frontend-gym
npm run build
```

## 🎨 Capturas de Pantalla

- Dashboard principal con navegación intuitiva
- Tablas de datos con búsqueda y filtros
- Formularios con validaciones en tiempo real
- Notificaciones detalladas de cambios en sistema

## 📞 Contacto y Soporte

- **Desarrollador:** Daniel Quenta Escobar
- **Proyecto:** Sistema de Gestión de Gimnasio  
- **Repositorio:** [gimnasio](https://github.com/danielquentaescobar/gimnasio)
- **Fecha:** Octubre 2025
- **Versión:** 1.0.0 Final

## 📝 Changelog Reciente

### v1.0.0 - Octubre 2025
- ✅ Implementada resta automática en caja al eliminar pagos/ventas
- ✅ Agregadas notificaciones detalladas en navegador
- ✅ Solucionado problema de pagos huérfanos (usuarios inactivos)
- ✅ Mejoradas transacciones con rollback automático
- ✅ Optimizada restauración de stock en eliminación de ventas

## 📄 Licencia

Este proyecto está desarrollado para uso académico y profesional. Todos los derechos reservados.

---

*Sistema completo y funcional listo para entorno de producción.*