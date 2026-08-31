const MovimientoCaja = require('../models/movimientoCaja');
const Caja = require('../models/caja');
const Administrativo = require('../models/administrativo');

exports.getAll = async (req, res) => {
  try {
    const movimientos = await MovimientoCaja.findAll({ 
      include: [
        { model: Caja, as: 'Caja' },
        { model: Administrativo, as: 'Administrativo' }
      ],
      order: [['fecha_movimiento', 'DESC'], ['id_movimiento', 'DESC']]
    });
    res.json(movimientos);
  } catch (error) {
    console.error('Error al obtener movimientos de caja:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.getOne = async (req, res) => {
  try {
    const movimiento = await MovimientoCaja.findByPk(req.params.id, { 
      include: [
        { model: Caja, as: 'Caja' },
        { model: Administrativo, as: 'Administrativo' }
      ] 
    });
    if (!movimiento) return res.status(404).json({ error: "Movimiento no encontrado" });
    res.json(movimiento);
  } catch (error) {
    console.error('Error al obtener movimiento:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.create = async (req, res) => {
  try {
    const { id_caja, id_admin, tipo_movimiento, descripcion, monto, origen, id_referencia } = req.body;
    
    // Crear el movimiento
    const movimiento = await MovimientoCaja.create({
      id_caja,
      id_admin,
      tipo_movimiento,
      descripcion,
      monto,
      origen,
      id_referencia
    });

    // Solo actualizar el saldo si es un movimiento manual (no viene de Pago o Venta)
    // Los triggers ya manejan automáticamente los movimientos de Pago y Venta
    if (origen !== 'Pago' && origen !== 'Venta') {
      const caja = await Caja.findByPk(id_caja);
      if (caja) {
        if (tipo_movimiento === 'Ingreso') {
          caja.saldo_actual = parseFloat(caja.saldo_actual) + parseFloat(monto);
        } else {
          caja.saldo_actual = parseFloat(caja.saldo_actual) - parseFloat(monto);
        }
        await caja.save();
      }
    }

    // Retornar el movimiento con relaciones
    const movimientoCompleto = await MovimientoCaja.findByPk(movimiento.id_movimiento, {
      include: [
        { model: Caja, as: 'Caja' },
        { model: Administrativo, as: 'Administrativo' }
      ]
    });

    res.status(201).json(movimientoCompleto);
  } catch (error) {
    console.error('Error al crear movimiento:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.update = async (req, res) => {
  try {
    const movimiento = await MovimientoCaja.findByPk(req.params.id);
    if (!movimiento) return res.status(404).json({ error: "Movimiento no encontrado" });
    
    await movimiento.update(req.body);
    
    const movimientoActualizado = await MovimientoCaja.findByPk(req.params.id, {
      include: [
        { model: Caja, as: 'Caja' },
        { model: Administrativo, as: 'Administrativo' }
      ]
    });
    
    res.json(movimientoActualizado);
  } catch (error) {
    console.error('Error al actualizar movimiento:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.delete = async (req, res) => {
  try {
    const movimiento = await MovimientoCaja.findByPk(req.params.id);
    if (!movimiento) return res.status(404).json({ error: "Movimiento no encontrado" });
    
    await movimiento.destroy();
    res.json({ message: "Movimiento eliminado correctamente" });
  } catch (error) {
    console.error('Error al eliminar movimiento:', error);
    res.status(500).json({ error: error.message });
  }
};