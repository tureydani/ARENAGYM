const Usuario = require('../models/usuario');
const Administrativo = require('../models/administrativo');

exports.getAll = async (req, res) => {
  try {
    // Por defecto solo mostrar usuarios activos
    const includeInactive = req.query.includeInactive === 'true';
    const scope = includeInactive ? 'withInactive' : 'defaultScope';
    
    const usuarios = await Usuario.scope(scope).findAll({ 
      include: [{ model: Administrativo, as: 'Administrativo' }] 
    });
    res.json(usuarios);
  } catch (error) {
    res.status(500).json({ error });
  }
};

exports.getInactive = async (req, res) => {
  try {
    const usuarios = await Usuario.scope('onlyInactive').findAll({ 
      include: [{ model: Administrativo, as: 'Administrativo' }] 
    });
    res.json(usuarios);
  } catch (error) {
    res.status(500).json({ error });
  }
};

exports.getOne = async (req, res) => {
  try {
    // Buscar tanto en activos como inactivos
    const usuario = await Usuario.scope('withInactive').findByPk(req.params.id, { 
      include: [{ model: Administrativo, as: 'Administrativo' }] 
    });
    if (!usuario) return res.status(404).json({ error: "No encontrado" });
    res.json(usuario);
  } catch (error) {
    res.status(500).json({ error });
  }
};

exports.create = async (req, res) => {
  try {
    // Si el email está vacío, lo establecemos como null
    if (req.body.email === '') {
      req.body.email = null;
    }
    
    // Si la fecha de nacimiento está vacía, la establecemos como null
    if (req.body.fecha_nacimiento === '') {
      req.body.fecha_nacimiento = null;
    }
    
    // Verificar si ya existe un usuario activo con el mismo nombre y apellido
    const usuarioExistente = await Usuario.findOne({
      where: {
        nombre: req.body.nombre,
        apellido: req.body.apellido,
        activo: true
      }
    });
    
    if (usuarioExistente) {
      return res.status(400).json({ 
        error: 'Ya existe un usuario registrado con el mismo nombre y apellido' 
      });
    }
    
    const usuario = await Usuario.create(req.body);
    // Devolver el usuario creado con la información del administrativo incluida
    const usuarioCompleto = await Usuario.findByPk(usuario.id_usuario, { 
      include: [{ model: Administrativo, as: 'Administrativo' }] 
    });
    res.status(201).json(usuarioCompleto);
  } catch (error) {
    res.status(400).json({ error });
  }
};

exports.update = async (req, res) => {
  try {
    // Si el email está vacío, lo establecemos como null
    if (req.body.email === '') {
      req.body.email = null;
    }
    
    // Si la fecha de nacimiento está vacía, la establecemos como null
    if (req.body.fecha_nacimiento === '') {
      req.body.fecha_nacimiento = null;
    }
    
    const usuario = await Usuario.findByPk(req.params.id);
    if (!usuario) return res.status(404).json({ error: "No encontrado" });
    
    // Verificar si ya existe otro usuario activo con el mismo nombre y apellido (excepto el actual)
    if (req.body.nombre && req.body.apellido) {
      const usuarioExistente = await Usuario.findOne({
        where: {
          nombre: req.body.nombre,
          apellido: req.body.apellido,
          activo: true,
          id_usuario: { [require('sequelize').Op.ne]: req.params.id }
        }
      });
      
      if (usuarioExistente) {
        return res.status(400).json({ 
          error: 'Ya existe otro usuario registrado con el mismo nombre y apellido' 
        });
      }
    }
    
    await usuario.update(req.body);
    // Devolver el usuario actualizado con la información del administrativo incluida
    const usuarioCompleto = await Usuario.findByPk(req.params.id, { 
      include: [{ model: Administrativo, as: 'Administrativo' }] 
    });
    res.json(usuarioCompleto);
  } catch (error) {
    res.status(400).json({ error });
  }
};

exports.delete = async (req, res) => {
  try {
    const usuario = await Usuario.scope('withInactive').findByPk(req.params.id);
    if (!usuario) return res.status(404).json({ error: "Usuario no encontrado" });
    
    if (!usuario.activo) {
      return res.status(400).json({ error: "El usuario ya está eliminado" });
    }
    
    // Soft delete: marcar como inactivo
    await usuario.update({ activo: false });
    
    const usuarioActualizado = await Usuario.scope('withInactive').findByPk(req.params.id, { 
      include: [{ model: Administrativo, as: 'Administrativo' }] 
    });
    
    res.json({ 
      message: "Usuario eliminado lógicamente", 
      usuario: usuarioActualizado 
    });
  } catch (error) {
    res.status(400).json({ error });
  }
};

exports.restore = async (req, res) => {
  try {
    const usuario = await Usuario.scope('withInactive').findByPk(req.params.id);
    if (!usuario) return res.status(404).json({ error: "Usuario no encontrado" });
    
    if (usuario.activo) {
      return res.status(400).json({ error: "El usuario ya está activo" });
    }
    
    // Restaurar: marcar como activo
    await usuario.update({ activo: true });
    
    const usuarioActualizado = await Usuario.findByPk(req.params.id, { 
      include: [{ model: Administrativo, as: 'Administrativo' }] 
    });
    
    res.json({ 
      message: "Usuario restaurado exitosamente", 
      usuario: usuarioActualizado 
    });
  } catch (error) {
    res.status(400).json({ error });
  }
};

exports.forceDelete = async (req, res) => {
  try {
    const usuario = await Usuario.scope('withInactive').findByPk(req.params.id);
    if (!usuario) return res.status(404).json({ error: "Usuario no encontrado" });
    
    // Eliminar permanentemente
    await usuario.destroy();
    
    res.json({ message: "Usuario eliminado permanentemente" });
  } catch (error) {
    res.status(400).json({ 
      error: "Error al eliminar permanentemente. Puede que el usuario tenga registros asociados.",
      details: error.message 
    });
  }
};