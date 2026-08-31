const { Producto } = require('../models/index');

const ProductosController = {
  // Obtener todos los productos
  async getAll(req, res) {
    try {
      // Por defecto solo mostrar productos activos
      const includeInactive = req.query.includeInactive === 'true';
      const scope = includeInactive ? 'withInactive' : 'defaultScope';
      
      const productos = await Producto.scope(scope).findAll({
        order: [['id_producto', 'ASC']]
      });
      res.json(productos);
    } catch (error) {
      console.error('Error al obtener productos:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  },

  // Obtener productos inactivos
  async getInactive(req, res) {
    try {
      const productos = await Producto.scope('onlyInactive').findAll({
        order: [['id_producto', 'ASC']]
      });
      res.json(productos);
    } catch (error) {
      console.error('Error al obtener productos inactivos:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  },

  // Obtener un producto por ID
  async getById(req, res) {
    try {
      const { id } = req.params;
      // Buscar tanto en activos como inactivos
      const producto = await Producto.scope('withInactive').findByPk(id);
      
      if (!producto) {
        return res.status(404).json({ error: 'Producto no encontrado' });
      }
      
      res.json(producto);
    } catch (error) {
      console.error('Error al obtener producto:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  },

  // Crear nuevo producto
  async create(req, res) {
    try {
      const { nombre, descripcion, precio, stock } = req.body;

      // Validaciones
      if (!nombre || !precio) {
        return res.status(400).json({ 
          error: 'Los campos nombre y precio son obligatorios' 
        });
      }

      if (precio < 0) {
        return res.status(400).json({ 
          error: 'El precio no puede ser negativo' 
        });
      }

      if (stock && stock < 0) {
        return res.status(400).json({ 
          error: 'El stock no puede ser negativo' 
        });
      }

      const producto = await Producto.create({
        nombre: nombre.trim(),
        descripcion: descripcion ? descripcion.trim() : null,
        precio: parseFloat(precio),
        stock: stock ? parseInt(stock) : 0
      });

      res.status(201).json(producto);
    } catch (error) {
      console.error('Error al crear producto:', error);
      
      if (error.name === 'SequelizeValidationError') {
        return res.status(400).json({ 
          error: 'Datos de producto inválidos',
          details: error.errors.map(e => e.message)
        });
      }
      
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  },

  // Actualizar producto
  async update(req, res) {
    try {
      const { id } = req.params;
      const { nombre, descripcion, precio, stock } = req.body;

      const producto = await Producto.findByPk(id);
      if (!producto) {
        return res.status(404).json({ error: 'Producto no encontrado' });
      }

      // Validaciones
      if (precio !== undefined && precio < 0) {
        return res.status(400).json({ 
          error: 'El precio no puede ser negativo' 
        });
      }

      if (stock !== undefined && stock < 0) {
        return res.status(400).json({ 
          error: 'El stock no puede ser negativo' 
        });
      }

      // Actualizar solo los campos proporcionados
      const updateData = {};
      if (nombre !== undefined) updateData.nombre = nombre.trim();
      if (descripcion !== undefined) updateData.descripcion = descripcion ? descripcion.trim() : null;
      if (precio !== undefined) updateData.precio = parseFloat(precio);
      if (stock !== undefined) updateData.stock = parseInt(stock);

      await producto.update(updateData);
      
      res.json(producto);
    } catch (error) {
      console.error('Error al actualizar producto:', error);
      
      if (error.name === 'SequelizeValidationError') {
        return res.status(400).json({ 
          error: 'Datos de producto inválidos',
          details: error.errors.map(e => e.message)
        });
      }
      
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  },

  // Eliminar producto (soft delete)
  async delete(req, res) {
    try {
      const { id } = req.params;

      const producto = await Producto.scope('withInactive').findByPk(id);
      if (!producto) {
        return res.status(404).json({ error: 'Producto no encontrado' });
      }

      if (!producto.activo) {
        return res.status(400).json({ error: 'El producto ya está eliminado' });
      }

      // Soft delete: marcar como inactivo
      await producto.update({ activo: false });
      
      const productoActualizado = await Producto.scope('withInactive').findByPk(id);
      
      res.json({ 
        message: 'Producto eliminado lógicamente',
        producto: productoActualizado 
      });
    } catch (error) {
      console.error('Error al eliminar producto:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  },

  // Restaurar producto
  async restore(req, res) {
    try {
      const { id } = req.params;

      const producto = await Producto.scope('withInactive').findByPk(id);
      if (!producto) {
        return res.status(404).json({ error: 'Producto no encontrado' });
      }

      if (producto.activo) {
        return res.status(400).json({ error: 'El producto ya está activo' });
      }

      // Restaurar: marcar como activo
      await producto.update({ activo: true });
      
      const productoActualizado = await Producto.findByPk(id);
      
      res.json({ 
        message: 'Producto restaurado exitosamente',
        producto: productoActualizado 
      });
    } catch (error) {
      console.error('Error al restaurar producto:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  },

  // Eliminar producto permanentemente
  async forceDelete(req, res) {
    try {
      const { id } = req.params;

      const producto = await Producto.scope('withInactive').findByPk(id);
      if (!producto) {
        return res.status(404).json({ error: 'Producto no encontrado' });
      }

      await producto.destroy();
      res.json({ message: 'Producto eliminado permanentemente' });
    } catch (error) {
      console.error('Error al eliminar producto permanentemente:', error);
      
      if (error.name === 'SequelizeForeignKeyConstraintError') {
        return res.status(400).json({ 
          error: 'No se puede eliminar el producto porque tiene ventas asociadas' 
        });
      }
      
      res.status(500).json({ 
        error: 'Error al eliminar permanentemente',
        details: error.message 
      });
    }
  },

  // Verificar disponibilidad de stock
  async verificarStock(req, res) {
    try {
      const { id } = req.params;
      const { cantidad } = req.query;

      const producto = await Producto.findByPk(id);
      if (!producto) {
        return res.status(404).json({ error: 'Producto no encontrado' });
      }

      const cantidadSolicitada = parseInt(cantidad) || 1;
      const disponible = producto.stock >= cantidadSolicitada;

      res.json({
        producto: {
          id: producto.id_producto,
          nombre: producto.nombre,
          stock_actual: producto.stock,
          precio: producto.precio
        },
        cantidad_solicitada: cantidadSolicitada,
        disponible,
        stock_faltante: disponible ? 0 : cantidadSolicitada - producto.stock
      });
    } catch (error) {
      console.error('Error al verificar stock:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  },

  // Verificar múltiples productos
  async verificarStockMultiple(req, res) {
    try {
      const { productos } = req.body; // Array de {id_producto, cantidad}

      if (!productos || !Array.isArray(productos)) {
        return res.status(400).json({ 
          error: 'Debe proporcionar un array de productos con id_producto y cantidad' 
        });
      }

      const resultados = [];
      let todasDisponibles = true;

      for (const item of productos) {
        const producto = await Producto.findByPk(item.id_producto);
        if (!producto) {
          resultados.push({
            id_producto: item.id_producto,
            error: 'Producto no encontrado',
            disponible: false
          });
          todasDisponibles = false;
          continue;
        }

        const disponible = producto.stock >= item.cantidad;
        if (!disponible) todasDisponibles = false;

        resultados.push({
          id_producto: producto.id_producto,
          nombre: producto.nombre,
          stock_actual: producto.stock,
          cantidad_solicitada: item.cantidad,
          disponible,
          stock_faltante: disponible ? 0 : item.cantidad - producto.stock
        });
      }

      res.json({
        todas_disponibles: todasDisponibles,
        productos: resultados
      });
    } catch (error) {
      console.error('Error al verificar stock múltiple:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  },

  // Obtener productos con stock bajo
  async getStockBajo(req, res) {
    try {
      const { limite = 5 } = req.query; // Stock mínimo considerado como "bajo"
      
      // Solo productos activos con stock bajo
      const productos = await Producto.findAll({
        where: {
          stock: {
            [require('sequelize').Op.lte]: parseInt(limite)
          },
          activo: true
        },
        order: [['stock', 'ASC']],
        attributes: ['id_producto', 'nombre', 'descripcion', 'precio', 'stock']
      });

      res.json({
        limite_configurado: parseInt(limite),
        productos_con_stock_bajo: productos,
        total: productos.length
      });
    } catch (error) {
      console.error('Error al obtener productos con stock bajo:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  },

  // Actualizar stock de producto
  async updateStock(req, res) {
    try {
      const { id } = req.params;
      const { cantidad, operacion } = req.body; // operacion: 'suma' o 'resta'

      const producto = await Producto.findByPk(id);
      if (!producto) {
        return res.status(404).json({ error: 'Producto no encontrado' });
      }

      if (!cantidad || cantidad <= 0) {
        return res.status(400).json({ 
          error: 'La cantidad debe ser mayor a 0' 
        });
      }

      let nuevoStock = producto.stock;
      
      if (operacion === 'suma') {
        nuevoStock += parseInt(cantidad);
      } else if (operacion === 'resta') {
        nuevoStock -= parseInt(cantidad);
        if (nuevoStock < 0) {
          return res.status(400).json({ 
            error: 'No hay suficiente stock disponible' 
          });
        }
      } else {
        return res.status(400).json({ 
          error: 'Operación inválida. Use "suma" o "resta"' 
        });
      }

      await producto.update({ stock: nuevoStock });
      
      res.json(producto);
    } catch (error) {
      console.error('Error al actualizar stock:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  },

  // Eliminación lógica (soft delete)
  async softDelete(req, res) {
    try {
      const { id } = req.params;
      const producto = await Producto.findByPk(id);
      
      if (!producto) {
        return res.status(404).json({ error: 'Producto no encontrado' });
      }
      
      if (!producto.activo) {
        return res.status(400).json({ error: 'El producto ya está inactivo' });
      }
      
      // Marcar como inactivo
      await producto.update({ activo: false });
      
      const productoActualizado = await Producto.scope('withInactive').findByPk(id);
      
      res.json({ 
        message: "Producto eliminado lógicamente", 
        producto: productoActualizado 
      });
    } catch (error) {
      console.error('Error al eliminar producto lógicamente:', error);
      res.status(400).json({ error: 'Error al eliminar producto' });
    }
  },

  // Restaurar producto inactivo
  async restore(req, res) {
    try {
      const { id } = req.params;
      const producto = await Producto.scope('withInactive').findByPk(id);
      
      if (!producto) {
        return res.status(404).json({ error: 'Producto no encontrado' });
      }
      
      if (producto.activo) {
        return res.status(400).json({ error: 'El producto ya está activo' });
      }
      
      // Restaurar: marcar como activo
      await producto.update({ activo: true });
      
      const productoActualizado = await Producto.findByPk(id);
      
      res.json({ 
        message: "Producto restaurado exitosamente", 
        producto: productoActualizado 
      });
    } catch (error) {
      console.error('Error al restaurar producto:', error);
      res.status(400).json({ error: 'Error al restaurar producto' });
    }
  },

  // Eliminación permanente (solo para administradores)
  async forceDelete(req, res) {
    try {
      const { id } = req.params;
      const producto = await Producto.scope('withInactive').findByPk(id);
      
      if (!producto) {
        return res.status(404).json({ error: 'Producto no encontrado' });
      }
      
      // Eliminar permanentemente
      await producto.destroy();
      
      res.json({ message: "Producto eliminado permanentemente" });
    } catch (error) {
      console.error('Error al eliminar producto permanentemente:', error);
      res.status(400).json({ 
        error: "Error al eliminar permanentemente. Puede que el producto tenga registros asociados.",
        details: error.message 
      });
    }
  }
};

module.exports = ProductosController;