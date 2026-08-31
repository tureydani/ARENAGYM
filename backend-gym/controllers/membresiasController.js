const Membresia = require('../models/membresia');

exports.getAll = async (req, res) => {
  try {
    // Por defecto solo mostrar membresías activas
    const includeInactive = req.query.includeInactive === 'true';
    const scope = includeInactive ? 'withInactive' : 'defaultScope';
    
    const membresias = await Membresia.scope(scope).findAll();
    res.json(membresias);
  } catch (error) {
    console.error('Error al obtener membresías:', error);
    res.status(500).json({ 
      error: error.message || 'Error al obtener membresías',
      details: error
    });
  }
};

exports.getInactive = async (req, res) => {
  try {
    const membresias = await Membresia.scope('onlyInactive').findAll();
    res.json(membresias);
  } catch (error) {
    res.status(500).json({ error });
  }
};

exports.getOne = async (req, res) => {
  try {
    // Buscar tanto en activas como inactivas
    const membresia = await Membresia.scope('withInactive').findByPk(req.params.id);
    if (!membresia) return res.status(404).json({ error: "No encontrado" });
    res.json(membresia);
  } catch (error) {
    res.status(500).json({ error });
  }
};

exports.create = async (req, res) => {
  try {
    const membresia = await Membresia.create(req.body);
    res.status(201).json(membresia);
  } catch (error) {
    res.status(400).json({ error });
  }
};

exports.update = async (req, res) => {
  try {
    const membresia = await Membresia.scope('withInactive').findByPk(req.params.id);
    if (!membresia) return res.status(404).json({ error: "No encontrado" });
    await membresia.update(req.body);
    res.json(membresia);
  } catch (error) {
    res.status(400).json({ error });
  }
};

exports.delete = async (req, res) => {
  try {
    const membresia = await Membresia.scope('withInactive').findByPk(req.params.id);
    if (!membresia) return res.status(404).json({ error: "Membresía no encontrada" });
    
    if (!membresia.activo) {
      return res.status(400).json({ error: "La membresía ya está inactiva" });
    }
    
    // Soft delete: marcar como inactiva
    await membresia.update({ activo: false });
    
    const membresiaActualizada = await Membresia.scope('withInactive').findByPk(req.params.id);
    
    res.json({ 
      message: "Membresía eliminada lógicamente", 
      membresia: membresiaActualizada 
    });
  } catch (error) {
    console.error('Error en soft delete de membresía:', error);
    res.status(400).json({ 
      error: error.message || 'Error al eliminar membresía',
      details: error
    });
  }
};

exports.restore = async (req, res) => {
  try {
    const membresia = await Membresia.scope('withInactive').findByPk(req.params.id);
    if (!membresia) return res.status(404).json({ error: "Membresía no encontrada" });
    
    if (membresia.activo) {
      return res.status(400).json({ error: "La membresía ya está activa" });
    }
    
    // Restaurar: marcar como activa
    await membresia.update({ activo: true });
    
    const membresiaActualizada = await Membresia.findByPk(req.params.id);
    
    res.json({ 
      message: "Membresía restaurada exitosamente", 
      membresia: membresiaActualizada 
    });
  } catch (error) {
    res.status(400).json({ error });
  }
};

exports.forceDelete = async (req, res) => {
  try {
    const membresia = await Membresia.scope('withInactive').findByPk(req.params.id);
    if (!membresia) return res.status(404).json({ error: "Membresía no encontrada" });
    
    // Eliminar permanentemente
    await membresia.destroy();
    
    res.json({ message: "Membresía eliminada permanentemente" });
  } catch (error) {
    res.status(400).json({ 
      error: "Error al eliminar permanentemente. Puede que la membresía tenga registros asociados.",
      details: error.message 
    });
  }
};
