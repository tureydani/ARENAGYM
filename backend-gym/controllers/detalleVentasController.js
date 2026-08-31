const DetalleVenta = require('../models/detalleVenta');
const Venta = require('../models/venta');
const Producto = require('../models/producto');
const sequelize = require('../config/database');

exports.getAll = async (req, res) => {
  try {
    const detalles = await DetalleVenta.findAll({
      include: [
        { model: Venta, as: 'Venta' },
        { model: Producto, as: 'Producto' }
      ]
    });
    res.json(detalles);
  } catch (error) {
    console.error('Error al obtener detalles de venta:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.getOne = async (req, res) => {
  try {
    const detalle = await DetalleVenta.findByPk(req.params.id, {
      include: [
        { model: Venta, as: 'Venta' },
        { model: Producto, as: 'Producto' }
      ]
    });
    if (!detalle) return res.status(404).json({ error: "Detalle no encontrado" });
    res.json(detalle);
  } catch (error) {
    console.error('Error al obtener detalle de venta:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.create = async (req, res) => {
  const transaction = await sequelize.transaction();
  
  try {
    const { id_venta, id_producto, cantidad, precio_unitario, skip_stock_update = false } = req.body;
    
    // Si no se debe saltar la actualización de stock, validar stock disponible
    if (!skip_stock_update) {
      const producto = await Producto.findByPk(id_producto, { transaction });
      if (!producto) {
        await transaction.rollback();
        return res.status(404).json({ error: 'Producto no encontrado' });
      }
      
      if (producto.stock < cantidad) {
        await transaction.rollback();
        return res.status(400).json({ 
          error: `Stock insuficiente para ${producto.nombre}. Stock disponible: ${producto.stock}, cantidad solicitada: ${cantidad}` 
        });
      }
    }
    
    // Crear detalle de venta
    const nuevoDetalle = await DetalleVenta.create({
      id_venta,
      id_producto,
      cantidad,
      precio_unitario
    }, { transaction });

    // Si no se debe saltar la actualización, actualizar stock del producto
    if (!skip_stock_update) {
      await Producto.update(
        { stock: sequelize.literal(`stock - ${cantidad}`) },
        { 
          where: { id_producto },
          transaction 
        }
      );
    }

    await transaction.commit();

    // Obtener el detalle completo con relaciones
    const detalleCompleto = await DetalleVenta.findByPk(nuevoDetalle.id_detalle, {
      include: [
        { model: Venta, as: 'Venta' },
        { model: Producto, as: 'Producto' }
      ]
    });

    res.status(201).json(detalleCompleto);
  } catch (error) {
    await transaction.rollback();
    console.error('Error al crear detalle de venta:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.update = async (req, res) => {
  const transaction = await sequelize.transaction();
  
  try {
    const detalleOriginal = await DetalleVenta.findByPk(req.params.id, {
      include: [{ model: Producto, as: 'Producto' }],
      transaction
    });
    
    if (!detalleOriginal) {
      await transaction.rollback();
      return res.status(404).json({ error: "Detalle no encontrado" });
    }
    
    const { cantidad: nuevaCantidad, precio_unitario } = req.body;
    
    // Si se está actualizando la cantidad, validar stock
    if (nuevaCantidad !== undefined && nuevaCantidad !== detalleOriginal.cantidad) {
      const diferencia = nuevaCantidad - detalleOriginal.cantidad;
      
      if (diferencia > 0) {
        // Se está aumentando la cantidad, verificar stock disponible
        const producto = await Producto.findByPk(detalleOriginal.id_producto, { transaction });
        if (producto.stock < diferencia) {
          await transaction.rollback();
          return res.status(400).json({ 
            error: `Stock insuficiente para ${producto.nombre}. Stock disponible: ${producto.stock}, cantidad adicional solicitada: ${diferencia}` 
          });
        }
        
        // Descontar del stock
        await Producto.update(
          { stock: sequelize.literal(`stock - ${diferencia}`) },
          { 
            where: { id_producto: detalleOriginal.id_producto },
            transaction 
          }
        );
      } else {
        // Se está disminuyendo la cantidad, devolver al stock
        const cantidadADevolver = Math.abs(diferencia);
        await Producto.update(
          { stock: sequelize.literal(`stock + ${cantidadADevolver}`) },
          { 
            where: { id_producto: detalleOriginal.id_producto },
            transaction 
          }
        );
      }
    }
    
    // Actualizar el detalle
    const updateData = {};
    if (nuevaCantidad !== undefined) updateData.cantidad = nuevaCantidad;
    if (precio_unitario !== undefined) updateData.precio_unitario = precio_unitario;
    
    await detalleOriginal.update(updateData, { transaction });
    
    await transaction.commit();
    
    const detalleActualizado = await DetalleVenta.findByPk(req.params.id, {
      include: [
        { model: Venta, as: 'Venta' },
        { model: Producto, as: 'Producto' }
      ]
    });
    
    res.json(detalleActualizado);
  } catch (error) {
    await transaction.rollback();
    console.error('Error al actualizar detalle de venta:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.delete = async (req, res) => {
  const transaction = await sequelize.transaction();
  
  try {
    const detalle = await DetalleVenta.findByPk(req.params.id, {
      include: [{ model: Producto, as: 'Producto' }],
      transaction
    });
    
    if (!detalle) {
      await transaction.rollback();
      return res.status(404).json({ error: "Detalle no encontrado" });
    }
    
    // Restaurar stock antes de eliminar el detalle
    await Producto.update(
      { stock: sequelize.literal(`stock + ${detalle.cantidad}`) },
      { 
        where: { id_producto: detalle.id_producto },
        transaction 
      }
    );
    
    await detalle.destroy({ transaction });
    
    await transaction.commit();
    res.json({ message: "Detalle eliminado correctamente y stock restaurado" });
  } catch (error) {
    await transaction.rollback();
    console.error('Error al eliminar detalle de venta:', error);
    res.status(500).json({ error: error.message });
  }
};