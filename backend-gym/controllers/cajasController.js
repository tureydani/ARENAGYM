const { Caja, MovimientoCaja, Administrativo } = require('../models/index');

const CajasController = {
  // Obtener todas las cajas
  async getAll(req, res) {
    try {
      const cajas = await Caja.findAll({
        order: [['id_caja', 'ASC']]
      });
      res.json(cajas);
    } catch (error) {
      console.error('Error al obtener cajas:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  },

  // Obtener una caja por ID
  async getById(req, res) {
    try {
      const { id } = req.params;
      const caja = await Caja.findByPk(id, {
        include: [{
          model: MovimientoCaja,
          as: 'movimientos',
          include: [{
            model: Administrativo,
            as: 'administrativo',
            attributes: ['nombre', 'apellido']
          }]
        }]
      });
      
      if (!caja) {
        return res.status(404).json({ error: 'Caja no encontrada' });
      }
      
      res.json(caja);
    } catch (error) {
      console.error('Error al obtener caja:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  },

  // Crear nueva caja
  async create(req, res) {
    try {
      const { descripcion, saldo_inicial, abierta } = req.body;

      // Validaciones
      if (!descripcion || descripcion.trim() === '') {
        return res.status(400).json({ 
          error: 'La descripción es obligatoria' 
        });
      }

      const saldoInicial = saldo_inicial ? parseFloat(saldo_inicial) : 0;
      
      if (saldoInicial < 0) {
        return res.status(400).json({ 
          error: 'El saldo inicial no puede ser negativo' 
        });
      }

      const caja = await Caja.create({
        descripcion: descripcion.trim(),
        saldo_inicial: saldoInicial,
        saldo_actual: saldoInicial, // El saldo actual empieza igual al inicial
        abierta: abierta !== undefined ? abierta : true,
        fecha_apertura: new Date()
      });

      res.status(201).json(caja);
    } catch (error) {
      console.error('Error al crear caja:', error);
      
      if (error.name === 'SequelizeValidationError') {
        return res.status(400).json({ 
          error: 'Datos de caja inválidos',
          details: error.errors.map(e => e.message)
        });
      }
      
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  },

  // Actualizar caja
  async update(req, res) {
    try {
      const { id } = req.params;
      const { descripcion, abierta } = req.body;

      const caja = await Caja.findByPk(id);
      if (!caja) {
        return res.status(404).json({ error: 'Caja no encontrada' });
      }

      // Actualizar solo los campos permitidos (no saldo_inicial ni saldo_actual)
      const updateData = {};
      if (descripcion !== undefined) updateData.descripcion = descripcion.trim();
      if (abierta !== undefined) updateData.abierta = abierta;

      await caja.update(updateData);
      
      res.json(caja);
    } catch (error) {
      console.error('Error al actualizar caja:', error);
      
      if (error.name === 'SequelizeValidationError') {
        return res.status(400).json({ 
          error: 'Datos de caja inválidos',
          details: error.errors.map(e => e.message)
        });
      }
      
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  },

  // Eliminar caja
  async delete(req, res) {
    try {
      const { id } = req.params;

      const caja = await Caja.findByPk(id);
      if (!caja) {
        return res.status(404).json({ error: 'Caja no encontrada' });
      }

      // Verificar si tiene movimientos asociados
      const movimientos = await MovimientoCaja.count({
        where: { id_caja: id }
      });

      if (movimientos > 0) {
        return res.status(400).json({ 
          error: 'No se puede eliminar la caja porque tiene movimientos asociados' 
        });
      }

      await caja.destroy();
      res.json({ message: 'Caja eliminada correctamente' });
    } catch (error) {
      console.error('Error al eliminar caja:', error);
      
      if (error.name === 'SequelizeForeignKeyConstraintError') {
        return res.status(400).json({ 
          error: 'No se puede eliminar la caja porque tiene transacciones asociadas' 
        });
      }
      
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  },

  // Obtener movimientos de una caja
  async getMovimientos(req, res) {
    try {
      const { id } = req.params;
      
      const caja = await Caja.findByPk(id);
      if (!caja) {
        return res.status(404).json({ error: 'Caja no encontrada' });
      }

      const movimientos = await MovimientoCaja.findAll({
        where: { id_caja: id },
        include: [{
          model: Administrativo,
          as: 'administrativo',
          attributes: ['nombre', 'apellido']
        }],
        order: [['fecha_movimiento', 'DESC'], ['id_movimiento', 'DESC']]
      });

      res.json(movimientos);
    } catch (error) {
      console.error('Error al obtener movimientos:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  },

  // Abrir/Cerrar caja
  async toggleEstado(req, res) {
    try {
      const { id } = req.params;

      const caja = await Caja.findByPk(id);
      if (!caja) {
        return res.status(404).json({ error: 'Caja no encontrada' });
      }

      await caja.update({ abierta: !caja.abierta });
      
      res.json({ 
        message: `Caja ${caja.abierta ? 'abierta' : 'cerrada'} correctamente`,
        caja 
      });
    } catch (error) {
      console.error('Error al cambiar estado de caja:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  },

  // Obtener resumen financiero de cajas
  async getResumen(req, res) {
    try {
      const cajas = await Caja.findAll();
      
      const resumen = {
        total_cajas: cajas.length,
        cajas_abiertas: cajas.filter(c => c.abierta).length,
        cajas_cerradas: cajas.filter(c => !c.abierta).length,
        saldo_total: cajas.reduce((sum, c) => sum + (c.saldo_actual || 0), 0),
        saldo_inicial_total: cajas.reduce((sum, c) => sum + (c.saldo_inicial || 0), 0)
      };

      res.json(resumen);
    } catch (error) {
      console.error('Error al obtener resumen de cajas:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  },

  // Obtener caja activa (primera caja abierta)
  async getCajaActiva(req, res) {
    try {
      const cajaActiva = await Caja.findOne({
        where: { abierta: true },
        order: [['id_caja', 'ASC']]
      });
      
      if (!cajaActiva) {
        return res.status(404).json({ error: 'No hay cajas abiertas' });
      }
      
      res.json(cajaActiva);
    } catch (error) {
      console.error('Error al obtener caja activa:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  },

  // Obtener la primera caja abierta (para ventas)
  async getCajaActiva(req, res) {
    try {
      const caja = await Caja.findOne({
        where: { abierta: true },
        order: [['id_caja', 'ASC']]
      });
      
      if (!caja) {
        return res.status(404).json({ error: 'No hay cajas abiertas' });
      }
      
      res.json(caja);
    } catch (error) {
      console.error('Error al obtener caja activa:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  }
};

module.exports = CajasController;