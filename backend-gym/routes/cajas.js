const express = require('express');
const router = express.Router();
const CajasController = require('../controllers/cajasController');

// Rutas para cajas
router.get('/resumen', CajasController.getResumen);
router.get('/activa', CajasController.getCajaActiva);
router.get('/:id/movimientos', CajasController.getMovimientos);
router.patch('/:id/toggle', CajasController.toggleEstado);
router.get('/', CajasController.getAll);
router.get('/:id', CajasController.getById);
router.post('/', CajasController.create);
router.put('/:id', CajasController.update);
router.delete('/:id', CajasController.delete);

module.exports = router;