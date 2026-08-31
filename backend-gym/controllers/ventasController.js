const Venta = require('../models/venta');
const DetalleVenta = require('../models/detalleVenta');
const Usuario = require('../models/usuario');
const Administrativo = require('../models/administrativo');
const Caja = require('../models/caja');
const Producto = require('../models/producto');
const MovimientoCaja = require('../models/movimientoCaja');
const sequelize = require('../config/database');

exports.getAll = async (req, res) => {
  try {
    // Por defecto solo mostrar ventas activas (no eliminadas)
    const includeInactive = req.query.includeInactive === 'true';
    const scope = includeInactive ? 'withInactive' : 'defaultScope';
    
    const ventas = await Venta.scope(scope).findAll({ 
      include: [
        { model: Usuario.scope('withInactive'), as: 'Usuario' },
        { model: Administrativo.scope('withInactive'), as: 'Administrativo' },
        { model: Caja, as: 'Caja' },
        { 
          model: DetalleVenta, 
          as: 'Detalles',
          include: [{ model: Producto, as: 'Producto' }]
        }
      ],
      order: [['fecha_venta', 'DESC'], ['id_venta', 'DESC']] 
    });
    res.json(ventas);
  } catch (error) {
    console.error('Error al obtener ventas:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.getOne = async (req, res) => {
  try {
    const venta = await Venta.scope('withInactive').findByPk(req.params.id, { 
      include: [
        { model: Usuario.scope('withInactive'), as: 'Usuario' },
        { model: Administrativo.scope('withInactive'), as: 'Administrativo' },
        { model: Caja, as: 'Caja' },
        { 
          model: DetalleVenta, 
          as: 'Detalles',
          include: [{ model: Producto, as: 'Producto' }]
        }
      ] 
    });
    if (!venta) return res.status(404).json({ error: "No encontrada" });
    res.json(venta);
  } catch (error) {
    console.error('Error al obtener venta:', error);
    res.status(500).json({ error: error.message });
  }
};

const { Transaction } = require('sequelize');

exports.create = async (req, res) => {
  const transaction = await sequelize.transaction();
  
  try {
    const { id_usuario, id_admin, id_caja, fecha_venta, total, estado, productos } = req.body;
    
    // Función para obtener fecha local en formato YYYY-MM-DD
    const getFechaHoy = () => {
      const hoy = new Date();
      const año = hoy.getFullYear();
      const mes = String(hoy.getMonth() + 1).padStart(2, '0');
      const dia = String(hoy.getDate()).padStart(2, '0');
      return `${año}-${mes}-${dia}`;
    };
    
    // Si incluye productos, validar stock antes de crear la venta
    if (productos && productos.length > 0) {
      for (const item of productos) {
        const producto = await Producto.findByPk(item.id_producto, { transaction });
        if (!producto) {
          await transaction.rollback();
          return res.status(404).json({ error: `Producto con ID ${item.id_producto} no encontrado` });
        }
        
        if (producto.stock < item.cantidad) {
          await transaction.rollback();
          return res.status(400).json({ 
            error: `Stock insuficiente para ${producto.nombre}. Stock disponible: ${producto.stock}, cantidad solicitada: ${item.cantidad}` 
          });
        }
      }
    }
    
    // Crear la venta principal con valores por defecto
    const nuevaVenta = await Venta.create({
      id_usuario,
      id_admin: id_admin || 1,
      id_caja: id_caja || 1,
      fecha_venta: fecha_venta || getFechaHoy(),
      total: total || 0,
      estado: estado || 'Completada'
    }, { transaction });

    // Si incluye productos, crear detalles de venta y actualizar stock
    if (productos && productos.length > 0) {
      for (const item of productos) {
        // Crear detalle de venta
        await DetalleVenta.create({
          id_venta: nuevaVenta.id_venta,
          id_producto: item.id_producto,
          cantidad: item.cantidad,
          precio_unitario: item.precio_unitario
        }, { transaction });

        // Actualizar stock del producto
        await Producto.update(
          { stock: sequelize.literal(`stock - ${item.cantidad}`) },
          { 
            where: { id_producto: item.id_producto },
            transaction 
          }
        );
      }
    }

    await transaction.commit();

    // El trigger automáticamente:
    // 1. Actualiza el saldo de la caja
    // 2. Crea el movimiento en movimientos_caja
    // No necesitamos hacerlo manualmente aquí

    // Obtener la venta completa con relaciones
    const ventaCompleta = await Venta.findByPk(nuevaVenta.id_venta, {
      include: [
        { model: Usuario, as: 'Usuario' },
        { model: Administrativo, as: 'Administrativo' },
        { model: Caja, as: 'Caja' },
        { 
          model: DetalleVenta, 
          as: 'Detalles',
          include: [{ model: Producto, as: 'Producto' }]
        }
      ]
    });

    res.status(201).json(ventaCompleta);
  } catch (error) {
    await transaction.rollback();
    console.error('Error al crear venta:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.update = async (req, res) => {
  try {
    const venta = await Venta.findByPk(req.params.id);
    if (!venta) return res.status(404).json({ error: "No encontrada" });
    
    await venta.update(req.body);
    
    const ventaActualizada = await Venta.findByPk(req.params.id, {
      include: [
        { model: Usuario, as: 'Usuario' },
        { model: Administrativo, as: 'Administrativo' },
        { model: Caja, as: 'Caja' }
      ]
    });
    
    res.json(ventaActualizada);
  } catch (error) {
    console.error('Error al actualizar venta:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.delete = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const venta = await Venta.scope('withInactive').findByPk(req.params.id, {
      include: [
        { model: DetalleVenta, as: 'Detalles', include: [{ model: Producto, as: 'Producto' }] },
        { model: Usuario.scope('withInactive'), as: 'Usuario' },
        { model: Caja, as: 'Caja' }
      ],
      transaction
    });
    
    if (!venta) {
      await transaction.rollback();
      return res.status(404).json({ error: "Venta no encontrada" });
    }

    // Obtener información del cliente para el movimiento
    const nombreCliente = venta.Usuario ? `${venta.Usuario.nombre} ${venta.Usuario.apellido}` : 'Cliente desconocido';

    // 1. Restaurar stock de productos antes de eliminar
    for (const detalle of venta.Detalles) {
      await Producto.update(
        { stock: sequelize.literal(`stock + ${detalle.cantidad}`) },
        { where: { id_producto: detalle.id_producto }, transaction }
      );
    }

    // 2. Restar el total de la venta de la caja
    await Caja.update(
      { saldo_actual: sequelize.literal(`saldo_actual - ${venta.total}`) },
      { where: { id_caja: venta.id_caja }, transaction }
    );

    // 3. Crear movimiento de egreso en la tabla de movimientos
    await MovimientoCaja.create({
      id_caja: venta.id_caja,
      id_admin: venta.id_admin,
      tipo_movimiento: 'Egreso',
      descripcion: `Eliminación de venta de productos a ${nombreCliente} (ID Venta: ${venta.id_venta})`,
      monto: venta.total,
      origen: 'Reembolso',
      id_referencia: venta.id_venta
    }, { transaction });

    // 4. Eliminar detalles de venta (hard delete ya que no tienen soft delete)
    await DetalleVenta.destroy({
      where: { id_venta: req.params.id },
      transaction
    });

    // 5. Marcar la venta como eliminada (soft delete usando estado)
    await Venta.update(
      { estado: 'Eliminada' },
      { where: { id_venta: venta.id_venta }, transaction }
    );

    await transaction.commit();

    // Obtener saldo actualizado de la caja
    const cajaActualizada = await Caja.findByPk(venta.id_caja);

    res.json({
      message: "Venta eliminada correctamente, stock restaurado y caja actualizada",
      montoVenta: venta.total,
      productosRestaurados: venta.Detalles.length,
      cajaAfectada: {
        id: cajaActualizada.id_caja,
        descripcion: cajaActualizada.descripcion,
        saldoAnterior: parseFloat(cajaActualizada.saldo_actual) + parseFloat(venta.total),
        saldoActual: parseFloat(cajaActualizada.saldo_actual),
        diferencia: -parseFloat(venta.total)
      },
      cliente: nombreCliente
    });
  } catch (error) {
    await transaction.rollback();
    console.error('Error al eliminar venta:', error);
    res.status(500).json({
      error: "Error al eliminar venta: " + error.message,
      details: "No se pudo completar la eliminación de la venta, restauración de stock y actualización de caja"
    });
  }
};