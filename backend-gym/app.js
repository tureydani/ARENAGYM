const express = require('express');
const cors = require('cors');
require('dotenv').config();
const sequelize = require('./config/database');

// Importar rutas
const administrativosRoutes = require('./routes/administrativos');
const usuariosRoutes = require('./routes/usuarios');
const membresiasRoutes = require('./routes/membresias');
const registroMembresiasRoutes = require('./routes/registroMembresias');
const pagosRoutes = require('./routes/pagos');
const productosRoutes = require('./routes/productos');
const cajasRoutes = require('./routes/cajas');
const ventasRoutes = require('./routes/ventas');
const detalleVentasRoutes = require('./routes/detalleVentas');
const movimientosCajaRoutes = require('./routes/movimientosCaja');

// Importar todos los modelos y sus asociaciones
require('./models/index');

// Crear la aplicación Express
const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Rutas
app.get('/', (req, res) => res.json({ message: 'API Gym funcionando!' }));

app.use('/api/administrativos', administrativosRoutes);
app.use('/api/usuarios', usuariosRoutes);
app.use('/api/membresias', membresiasRoutes);
app.use('/api/registro-membresias', registroMembresiasRoutes);
app.use('/api/pagos', pagosRoutes);
app.use('/api/productos', productosRoutes);
app.use('/api/cajas', cajasRoutes);
app.use('/api/ventas', ventasRoutes);
app.use('/api/detalle-ventas', detalleVentasRoutes);
app.use('/api/movimientos-caja', movimientosCajaRoutes);

// Sincroniza modelos con la BD
sequelize.sync({ force: false })  // ⚠️ force:true borra y crea todo de nuevo
  .then(() => {
    console.log('Base de datos conectada y modelos sincronizados');
    // 🔹 Escuchar en toda la red local para acceso desde móvil
    app.listen(process.env.PORT || 3000, '0.0.0.0', () => {
      console.log(`✅ Servidor corriendo en puerto ${process.env.PORT || 3000}`);
      console.log(`📱 Acceso móvil: http://192.168.2.107:${process.env.PORT || 3000}`);
      console.log(`🖥️  Acceso local: http://localhost:${process.env.PORT || 3000}`);
    });
  })
  .catch(err => console.error('Error al conectar a la base de datos:', err));