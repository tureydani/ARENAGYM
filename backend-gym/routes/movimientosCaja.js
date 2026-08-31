const express = require('express');
const router = express.Router();
const movimientosCajaController = require('../controllers/movimientosCajaController');

// Rutas para movimientos de caja
router.get('/', movimientosCajaController.getAll);
router.get('/:id', movimientosCajaController.getOne);
router.post('/', movimientosCajaController.create);
router.put('/:id', movimientosCajaController.update);
router.delete('/:id', movimientosCajaController.delete);

module.exports = router;