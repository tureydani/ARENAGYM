const RegistroMembresia = require('../models/registroMembresia');
const Usuario = require('../models/usuario');
const Membresia = require('../models/membresia');
const Administrativo = require('../models/administrativo');
const Pago = require('../models/pago');
const sequelize = require('../config/database');

exports.getAll = async (req, res) => {
  try {
    // Por defecto solo mostrar registros activos
    const includeInactive = req.query.includeInactive === 'true';
    const scope = includeInactive ? 'withInactive' : 'defaultScope';
    
    const registros = await RegistroMembresia.scope(scope).findAll({ 
      include: [
        { 
          model: Usuario, // Solo usuarios activos por defecto
          as: 'Usuario',
          required: false 
        },
        { 
          model: Membresia.scope('withInactive'), 
          as: 'Membresia',
          required: false 
        },
        { 
          model: Administrativo.scope('withInactive'), 
          as: 'Administrativo',
          required: false 
        }
      ] 
    });
    res.json(registros);
  } catch (error) {
    console.error('Error al obtener registros de membresías:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.getInactive = async (req, res) => {
  try {
    const registros = await RegistroMembresia.scope('onlyInactive').findAll({ 
      include: [
        { 
          model: Usuario.scope('withInactive'), 
          as: 'Usuario',
          required: false 
        },
        { 
          model: Membresia.scope('withInactive'), 
          as: 'Membresia',
          required: false 
        },
        { 
          model: Administrativo.scope('withInactive'), 
          as: 'Administrativo',
          required: false 
        }
      ] 
    });
    res.json(registros);
  } catch (error) {
    console.error('Error al obtener registros inactivos:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.getOne = async (req, res) => {
  try {
    // Buscar tanto en activos como inactivos
    const registro = await RegistroMembresia.scope('withInactive').findByPk(req.params.id, { 
      include: [
        { 
          model: Usuario.scope('withInactive'), 
          as: 'Usuario',
          required: false 
        },
        { 
          model: Membresia.scope('withInactive'), 
          as: 'Membresia',
          required: false 
        },
        { 
          model: Administrativo.scope('withInactive'), 
          as: 'Administrativo',
          required: false 
        }
      ] 
    });
    if (!registro) return res.status(404).json({ error: "No encontrado" });
    res.json(registro);
  } catch (error) {
    console.error('Error al obtener registro de membresía:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.create = async (req, res) => {
  try {
    // Debug: ver qué datos llegan
    console.log('🔍 Datos recibidos para crear registro:', req.body);
    
    // Asegurar que haya un id_admin por defecto si no se proporciona
    // La fecha_fin se calculará automáticamente por el trigger de la BD
    const { id_usuario, id_membresia, id_admin, fecha_inicio, activo } = req.body;
    
    console.log('🔍 Datos extraídos:', { id_usuario, id_membresia, id_admin, fecha_inicio, activo });
    
    const registro = await RegistroMembresia.create({
      id_usuario,
      id_membresia,
      id_admin: id_admin || 1, // Valor por defecto
      fecha_inicio,
      activo
      // fecha_fin se calculará automáticamente por trigger
    });
    
    console.log('✅ Registro creado exitosamente:', registro.toJSON());
    res.status(201).json(registro);
  } catch (error) {
    console.error('Error al crear registro de membresía:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.update = async (req, res) => {
  try {
    const registro = await RegistroMembresia.scope('withInactive').findByPk(req.params.id);
    if (!registro) return res.status(404).json({ error: "No encontrado" });
    await registro.update(req.body);
    res.json(registro);
  } catch (error) {
    console.error('Error al actualizar registro de membresía:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.delete = async (req, res) => {
  const transaction = await sequelize.transaction();
  
  try {
    const registro = await RegistroMembresia.scope('withInactive').findByPk(req.params.id, {
      transaction
    });
    
    if (!registro) {
      await transaction.rollback();
      return res.status(404).json({ error: "Registro no encontrado" });
    }
    
    if (!registro.activo) {
      await transaction.rollback();
      return res.status(400).json({ error: "El registro ya está inactivo" });
    }

    // 1. Buscar todos los pagos asociados al registro
    const pagosAsociados = await Pago.scope('withInactive').findAll({
      where: { id_registro: req.params.id, activo: true },
      transaction
    });

    console.log(`Encontrados ${pagosAsociados.length} pagos asociados al registro ${req.params.id}`);

    // 2. Calcular el monto total de pagos activos para revertir en caja
    const montoTotalRevertir = pagosAsociados.reduce((total, pago) => {
      return total + parseFloat(pago.monto_pagado);
    }, 0);

    console.log(`Monto total a revertir en caja: ${montoTotalRevertir}`);

    // 3. Marcar todos los pagos asociados como inactivos (soft delete)
    if (pagosAsociados.length > 0) {
      await Pago.update(
        { activo: false },
        { 
          where: { id_registro: req.params.id, activo: true },
          transaction 
        }
      );

      // 4. Obtener información de la caja del primer pago para revertir
      const primerPago = pagosAsociados[0];
      
      // 5. Revertir el monto en la caja
      if (montoTotalRevertir > 0) {
        await sequelize.query(`
          UPDATE cajas 
          SET saldo_actual = saldo_actual - :monto 
          WHERE id_caja = :id_caja
        `, {
          replacements: { 
            monto: montoTotalRevertir, 
            id_caja: primerPago.id_caja 
          },
          transaction
        });

        // 6. Registrar el movimiento de egreso en movimientos_caja
        await sequelize.query(`
          INSERT INTO movimientos_caja (id_caja, id_admin, tipo_movimiento, descripcion, monto, origen, id_referencia)
          VALUES (:id_caja, :id_admin, 'Egreso', :descripcion, :monto, 'Reembolso', :id_referencia)
        `, {
          replacements: {
            id_caja: primerPago.id_caja,
            id_admin: primerPago.id_admin,
            descripcion: `Reembolso por eliminación de registro de membresía ID ${req.params.id}`,
            monto: montoTotalRevertir,
            id_referencia: req.params.id
          },
          transaction
        });
      }
    }

    // 7. Finalmente, marcar el registro de membresía como inactivo
    await registro.update({ activo: false }, { transaction });
    
    // 8. Confirmar la transacción
    await transaction.commit();
    
    // 9. Obtener el registro actualizado con sus relaciones
    const registroActualizado = await RegistroMembresia.scope('withInactive').findByPk(req.params.id, {
      include: [
        { 
          model: Usuario.scope('withInactive'), 
          as: 'Usuario',
          required: false 
        },
        { 
          model: Membresia.scope('withInactive'), 
          as: 'Membresia',
          required: false 
        },
        { 
          model: Administrativo.scope('withInactive'), 
          as: 'Administrativo',
          required: false 
        }
      ]
    });
    
    res.json({ 
      message: "Registro de membresía eliminado lógicamente con eliminación en cascada", 
      registro: registroActualizado,
      pagosEliminados: pagosAsociados.length,
      montoRevertido: montoTotalRevertir,
      detalles: {
        registroEliminado: true,
        pagosEliminados: pagosAsociados.length,
        montoRevertidoEnCaja: montoTotalRevertir
      }
    });
    
  } catch (error) {
    console.error('Error al eliminar registro de membresía con cascada:', error);
    await transaction.rollback();
    res.status(500).json({ 
      error: error.message,
      message: "Error al eliminar el registro de membresía con eliminación en cascada"
    });
  }
};

exports.restore = async (req, res) => {
  const transaction = await sequelize.transaction();
  
  try {
    const registro = await RegistroMembresia.scope('withInactive').findByPk(req.params.id, {
      transaction
    });
    
    if (!registro) {
      await transaction.rollback();
      return res.status(404).json({ error: "Registro no encontrado" });
    }
    
    if (registro.activo) {
      await transaction.rollback();
      return res.status(400).json({ error: "El registro ya está activo" });
    }

    // 1. Buscar todos los pagos inactivos asociados al registro
    const pagosInactivos = await Pago.scope('onlyInactive').findAll({
      where: { id_registro: req.params.id, activo: false },
      transaction
    });

    console.log(`Encontrados ${pagosInactivos.length} pagos inactivos para restaurar`);

    // 2. Calcular el monto total de pagos a restaurar
    const montoTotalRestaurar = pagosInactivos.reduce((total, pago) => {
      return total + parseFloat(pago.monto_pagado);
    }, 0);

    console.log(`Monto total a restaurar en caja: ${montoTotalRestaurar}`);

    // 3. Restaurar todos los pagos asociados (marcar como activos)
    if (pagosInactivos.length > 0) {
      await Pago.update(
        { activo: true },
        { 
          where: { id_registro: req.params.id, activo: false },
          transaction 
        }
      );

      // 4. Obtener información de la caja del primer pago para restaurar
      const primerPago = pagosInactivos[0];
      
      // 5. Restaurar el monto en la caja
      if (montoTotalRestaurar > 0) {
        await sequelize.query(`
          UPDATE cajas 
          SET saldo_actual = saldo_actual + :monto 
          WHERE id_caja = :id_caja
        `, {
          replacements: { 
            monto: montoTotalRestaurar, 
            id_caja: primerPago.id_caja 
          },
          transaction
        });

        // 6. Registrar el movimiento de ingreso en movimientos_caja
        await sequelize.query(`
          INSERT INTO movimientos_caja (id_caja, id_admin, tipo_movimiento, descripcion, monto, origen, id_referencia)
          VALUES (:id_caja, :id_admin, 'Ingreso', :descripcion, :monto, 'Pago', :id_referencia)
        `, {
          replacements: {
            id_caja: primerPago.id_caja,
            id_admin: primerPago.id_admin,
            descripcion: `Restauración de pagos por registro de membresía ID ${req.params.id}`,
            monto: montoTotalRestaurar,
            id_referencia: req.params.id
          },
          transaction
        });
      }
    }

    // 7. Finalmente, restaurar el registro de membresía
    await registro.update({ activo: true }, { transaction });
    
    // 8. Confirmar la transacción
    await transaction.commit();
    
    // 9. Obtener el registro actualizado con sus relaciones
    const registroActualizado = await RegistroMembresia.findByPk(req.params.id, {
      include: [
        { 
          model: Usuario.scope('withInactive'), 
          as: 'Usuario',
          required: false 
        },
        { 
          model: Membresia.scope('withInactive'), 
          as: 'Membresia',
          required: false 
        },
        { 
          model: Administrativo.scope('withInactive'), 
          as: 'Administrativo',
          required: false 
        }
      ]
    });
    
    res.json({ 
      message: "Registro de membresía restaurado exitosamente con restauración en cascada", 
      registro: registroActualizado,
      pagosRestaurados: pagosInactivos.length,
      montoRestaurado: montoTotalRestaurar,
      detalles: {
        registroRestaurado: true,
        pagosRestaurados: pagosInactivos.length,
        montoRestauradoEnCaja: montoTotalRestaurar
      }
    });
    
  } catch (error) {
    console.error('Error al restaurar registro de membresía con cascada:', error);
    await transaction.rollback();
    res.status(400).json({ 
      error: error.message,
      message: "Error al restaurar el registro de membresía con restauración en cascada"
    });
  }
};

exports.forceDelete = async (req, res) => {
  try {
    const registro = await RegistroMembresia.scope('withInactive').findByPk(req.params.id);
    if (!registro) return res.status(404).json({ error: "Registro no encontrado" });
    
    // Eliminar permanentemente
    await registro.destroy();
    
    res.json({ message: "Registro de membresía eliminado permanentemente" });
  } catch (error) {
    console.error('Error al eliminar permanentemente registro:', error);
    res.status(400).json({ 
      error: "Error al eliminar permanentemente. Puede que el registro tenga pagos asociados.",
      details: error.message 
    });
  }
};