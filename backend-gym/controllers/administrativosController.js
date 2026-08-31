const Administrativo = require('../models/administrativo');
const Usuario = require('../models/usuario');
const Pago = require('../models/pago');
const RegistroMembresia = require('../models/registroMembresia');
const Venta = require('../models/venta');

exports.getAll = async (req, res) => {
  try {
    // Por defecto solo mostrar administrativos activos
    const includeInactive = req.query.includeInactive === 'true';
    const scope = includeInactive ? 'withInactive' : 'defaultScope';
    
    const admins = await Administrativo.scope(scope).findAll({
      order: [['fecha_contratacion', 'DESC'], ['id_admin', 'ASC']]
    });
    res.json(admins);
  } catch (error) {
    console.error('Error al obtener administrativos:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.getInactive = async (req, res) => {
  try {
    const admins = await Administrativo.scope('onlyInactive').findAll({
      order: [['fecha_contratacion', 'DESC'], ['id_admin', 'ASC']]
    });
    res.json(admins);
  } catch (error) {
    console.error('Error al obtener administrativos inactivos:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.getOne = async (req, res) => {
  try {
    // Buscar tanto en activos como inactivos
    const admin = await Administrativo.scope('withInactive').findByPk(req.params.id);
    if (!admin) {
      return res.status(404).json({ 
        error: "Administrativo no encontrado",
        message: `No se encontró un administrativo con ID ${req.params.id}` 
      });
    }
    res.json(admin);
  } catch (error) {
    console.error('Error al obtener administrativo:', error);
    res.status(500).json({ 
      error: error.message,
      message: "Error interno del servidor al obtener el administrativo"
    });
  }
};

exports.create = async (req, res) => {
  try {
    const { nombre, apellido, usuario, contraseña, fecha_contratacion } = req.body;

    // Validaciones básicas
    if (!nombre || !apellido || !usuario || !contraseña) {
      return res.status(400).json({
        error: "Datos incompletos",
        message: "Los campos nombre, apellido, usuario y contraseña son obligatorios"
      });
    }

    // Verificar si el usuario ya existe
    const existingAdmin = await Administrativo.findOne({ where: { usuario } });
    if (existingAdmin) {
      return res.status(409).json({
        error: "Usuario duplicado",
        message: `El nombre de usuario '${usuario}' ya está en uso`
      });
    }

    const admin = await Administrativo.create({
      nombre: nombre.trim(),
      apellido: apellido.trim(),
      usuario: usuario.trim(),
      contraseña,
      fecha_contratacion: fecha_contratacion || new Date()
    });

    res.status(201).json(admin);
  } catch (error) {
    console.error('Error al crear administrativo:', error);
    
    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({
        error: "Usuario duplicado",
        message: "El nombre de usuario ya está en uso"
      });
    }
    
    res.status(400).json({ 
      error: error.message,
      message: "Error al crear el administrativo"
    });
  }
};

exports.update = async (req, res) => {
  try {
    const admin = await Administrativo.scope('withInactive').findByPk(req.params.id);
    if (!admin) {
      return res.status(404).json({ 
        error: "Administrativo no encontrado",
        message: `No se encontró un administrativo con ID ${req.params.id}` 
      });
    }

    const { nombre, apellido, usuario, contraseña, fecha_contratacion } = req.body;

    // Verificar si el nuevo usuario ya existe (solo si se está cambiando)
    if (usuario && usuario !== admin.usuario) {
      const existingAdmin = await Administrativo.scope('withInactive').findOne({ 
        where: { 
          usuario,
          id_admin: { [require('sequelize').Op.ne]: req.params.id }
        } 
      });
      if (existingAdmin) {
        return res.status(409).json({
          error: "Usuario duplicado",
          message: `El nombre de usuario '${usuario}' ya está en uso`
        });
      }
    }

    // Preparar datos para actualizar
    const updateData = {};
    if (nombre) updateData.nombre = nombre.trim();
    if (apellido) updateData.apellido = apellido.trim();
    if (usuario) updateData.usuario = usuario.trim();
    if (contraseña) updateData.contraseña = contraseña;
    if (fecha_contratacion) updateData.fecha_contratacion = fecha_contratacion;

    await admin.update(updateData);
    
    // Obtener el administrativo actualizado
    const adminActualizado = await Administrativo.scope('withInactive').findByPk(req.params.id);
    res.json(adminActualizado);
  } catch (error) {
    console.error('Error al actualizar administrativo:', error);
    
    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({
        error: "Usuario duplicado",
        message: "El nombre de usuario ya está en uso"
      });
    }
    
    res.status(400).json({ 
      error: error.message,
      message: "Error al actualizar el administrativo"
    });
  }
};

exports.delete = async (req, res) => {
  try {
    const admin = await Administrativo.findByPk(req.params.id);
    if (!admin) {
      return res.status(404).json({ 
        error: "Administrativo no encontrado",
        message: `No se encontró un administrativo con ID ${req.params.id}` 
      });
    }

    if (!admin.activo) {
      return res.status(400).json({ 
        error: "El administrativo ya está inactivo" 
      });
    }

    // Soft delete: marcar como inactivo
    await admin.update({ activo: false });
    
    const adminActualizado = await Administrativo.scope('withInactive').findByPk(req.params.id);
    
    res.json({ 
      message: "Administrativo eliminado lógicamente", 
      administrativo: adminActualizado 
    });
  } catch (error) {
    console.error('Error al eliminar administrativo:', error);
    res.status(500).json({ 
      error: error.message,
      message: "Error interno del servidor al eliminar el administrativo"
    });
  }
};

exports.restore = async (req, res) => {
  try {
    const admin = await Administrativo.scope('withInactive').findByPk(req.params.id);
    if (!admin) {
      return res.status(404).json({ 
        error: "Administrativo no encontrado" 
      });
    }
    
    if (admin.activo) {
      return res.status(400).json({ 
        error: "El administrativo ya está activo" 
      });
    }
    
    // Verificar si el usuario no está duplicado al restaurar
    const existingAdmin = await Administrativo.findOne({ 
      where: { 
        usuario: admin.usuario,
        id_admin: { [require('sequelize').Op.ne]: req.params.id }
      } 
    });
    
    if (existingAdmin) {
      return res.status(409).json({
        error: "Usuario duplicado",
        message: `No se puede restaurar: el nombre de usuario '${admin.usuario}' ya está en uso por otro administrativo activo`
      });
    }
    
    // Restaurar: marcar como activo
    await admin.update({ activo: true });
    
    const adminActualizado = await Administrativo.findByPk(req.params.id);
    
    res.json({ 
      message: "Administrativo restaurado exitosamente", 
      administrativo: adminActualizado 
    });
  } catch (error) {
    console.error('Error al restaurar administrativo:', error);
    res.status(400).json({ 
      error: error.message,
      message: "Error al restaurar el administrativo"
    });
  }
};

exports.forceDelete = async (req, res) => {
  try {
    const admin = await Administrativo.scope('withInactive').findByPk(req.params.id);
    if (!admin) {
      return res.status(404).json({ 
        error: "Administrativo no encontrado" 
      });
    }

    // Verificar si el administrativo tiene registros asociados
    const [usuarios, pagos, registros, ventas] = await Promise.all([
      Usuario.count({ where: { registrado_por: req.params.id } }),
      Pago.count({ where: { id_admin: req.params.id } }),
      RegistroMembresia.count({ where: { id_admin: req.params.id } }),
      Venta.count({ where: { id_admin: req.params.id } })
    ]);

    const totalRegistros = usuarios + pagos + registros + ventas;

    if (totalRegistros > 0) {
      return res.status(409).json({
        error: "No se puede eliminar permanentemente",
        message: `Este administrativo tiene ${totalRegistros} registro(s) asociado(s)`,
        details: {
          usuarios,
          pagos,
          registros_membresias: registros,
          ventas
        }
      });
    }

    // Eliminar permanentemente
    await admin.destroy();
    
    res.json({ 
      message: "Administrativo eliminado permanentemente",
      id: req.params.id
    });
  } catch (error) {
    console.error('Error al eliminar permanentemente administrativo:', error);
    res.status(400).json({ 
      error: "Error al eliminar permanentemente. Puede que el administrativo tenga registros asociados.",
      details: error.message 
    });
  }
};