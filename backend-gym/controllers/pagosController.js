const Pago = require('../models/pago');
const RegistroMembresia = require('../models/registroMembresia');
const Administrativo = require('../models/administrativo');
const Caja = require('../models/caja');
const Usuario = require('../models/usuario');
const MovimientoCaja = require('../models/movimientoCaja');
const sequelize = require('../config/database');

exports.getAll = async (req, res) => {
  try {
    // Por defecto solo mostrar pagos activos
    const includeInactive = req.query.includeInactive === 'true';
    const scope = includeInactive ? 'withInactive' : 'defaultScope';
    
    const pagos = await Pago.scope(scope).findAll({ 
      include: [
        { 
          model: RegistroMembresia.scope('withInactive'), 
          as: 'RegistroMembresia' 
        },
        { 
          model: Administrativo.scope('withInactive'), 
          as: 'Administrativo' 
        },
        { 
          model: Caja, 
          as: 'Caja' 
        }
      ],
      order: [['fecha_pago', 'DESC'], ['id_pago', 'DESC']] 
    });
    res.json(pagos);
  } catch (error) {
    console.error('Error al obtener pagos:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.getOne = async (req, res) => {
  try {
    const pago = await Pago.scope('withInactive').findByPk(req.params.id, { 
      include: [
        { 
          model: RegistroMembresia.scope('withInactive'), 
          as: 'RegistroMembresia' 
        },
        { 
          model: Administrativo.scope('withInactive'), 
          as: 'Administrativo' 
        },
        { 
          model: Caja, 
          as: 'Caja' 
        }
      ] 
    });
    if (!pago) return res.status(404).json({ error: "No encontrado" });
    res.json(pago);
  } catch (error) {
    console.error('Error al obtener pago:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.create = async (req, res) => {
  try {
    const { id_registro, monto_pagado, fecha_pago, id_admin, id_caja, estado_pago } = req.body;
    
    const nuevoPago = await Pago.create({
      id_registro,
      monto_pagado,
      fecha_pago,
      id_admin: id_admin || 1,
      id_caja: id_caja || 1,
      estado_pago: estado_pago || 'Pendiente'
    });

    // El trigger automáticamente:
    // 1. Actualiza el saldo de la caja
    // 2. Crea el movimiento en movimientos_caja
    // No necesitamos hacerlo manualmente aquí

    const pagoConRelaciones = await Pago.scope('withInactive').findByPk(nuevoPago.id_pago, {
      include: [
        { model: RegistroMembresia.scope('withInactive'), as: 'RegistroMembresia' },
        { model: Administrativo, as: 'Administrativo' },
        { model: Caja, as: 'Caja' }
      ]
    });

    res.status(201).json(pagoConRelaciones);
  } catch (error) {
    console.error('Error al crear pago:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.update = async (req, res) => {
  try {
    const pago = await Pago.scope('withInactive').findByPk(req.params.id);
    if (!pago) return res.status(404).json({ error: "No encontrado" });
    
    await pago.update(req.body);
    
    const pagoActualizado = await Pago.scope('withInactive').findByPk(req.params.id, {
      include: [
        { model: RegistroMembresia.scope('withInactive'), as: 'RegistroMembresia' },
        { model: Administrativo.scope('withInactive'), as: 'Administrativo' },
        { model: Caja, as: 'Caja' }
      ]
    });
    
    res.json(pagoActualizado);
  } catch (error) {
    console.error('Error al actualizar pago:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.delete = async (req, res) => {
  try {
    const pago = await Pago.scope('withInactive').findByPk(req.params.id, {
      include: [
        { 
          model: RegistroMembresia.scope('withInactive'), 
          as: 'RegistroMembresia',
          include: [
            { 
              model: Usuario.scope('withInactive'), 
              as: 'Usuario' 
            }
          ]
        },
        { model: Caja, as: 'Caja' }
      ]
    });
    
    if (!pago) return res.status(404).json({ error: "Pago no encontrado" });

    // Iniciar transacción para asegurar consistencia
    const transaction = await sequelize.transaction();

    try {
      // Obtener información del cliente para el movimiento
      const nombreCliente = pago.RegistroMembresia?.Usuario ? 
        `${pago.RegistroMembresia.Usuario.nombre} ${pago.RegistroMembresia.Usuario.apellido}` : 
        'Cliente desconocido';

      // 1. Restar el monto de la caja
      await Caja.update(
        { 
          saldo_actual: sequelize.literal(`saldo_actual - ${pago.monto_pagado}`)
        },
        { 
          where: { id_caja: pago.id_caja },
          transaction 
        }
      );

      // 2. Crear movimiento de egreso en la tabla de movimientos
      await MovimientoCaja.create({
        id_caja: pago.id_caja,
        id_admin: pago.id_admin,
        tipo_movimiento: 'Egreso',
        descripcion: `Eliminación de pago de membresía de ${nombreCliente} (ID Pago: ${pago.id_pago})`,
        monto: pago.monto_pagado,
        origen: 'Reembolso',
        id_referencia: pago.id_pago
      }, { transaction });

      // 3. Eliminar el pago (soft delete)
      await pago.destroy({ transaction });

      // Confirmar transacción
      await transaction.commit();

      // Obtener saldo actualizado de la caja
      const cajaActualizada = await Caja.findByPk(pago.id_caja);

      res.json({ 
        message: "Pago eliminado correctamente",
        montoPago: pago.monto_pagado,
        cajaAfectada: {
          id: cajaActualizada.id_caja,
          descripcion: cajaActualizada.descripcion,
          saldoAnterior: parseFloat(cajaActualizada.saldo_actual) + parseFloat(pago.monto_pagado),
          saldoActual: parseFloat(cajaActualizada.saldo_actual),
          diferencia: -parseFloat(pago.monto_pagado)
        },
        cliente: nombreCliente
      });

    } catch (error) {
      // Revertir transacción en caso de error
      await transaction.rollback();
      throw error;
    }

  } catch (error) {
    console.error('Error al eliminar pago:', error);
    res.status(500).json({ 
      error: "Error al eliminar pago: " + error.message,
      details: "No se pudo completar la eliminación del pago y actualización de caja"
    });
  }
};