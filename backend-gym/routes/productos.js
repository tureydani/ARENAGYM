const express = require('express');
const router = express.Router();
const ProductosController = require('../controllers/productosController');

// Rutas específicas primero (sin parámetros)
router.get('/stock-bajo', ProductosController.getStockBajo);
router.get('/inactive', ProductosController.getInactive);
router.post('/verificar-stock-multiple', ProductosController.verificarStockMultiple);

// Rutas generales
router.get('/', ProductosController.getAll);
router.post('/', ProductosController.create);

// Rutas con parámetros al final
router.get('/:id', ProductosController.getById);
router.get('/:id/verificar-stock', ProductosController.verificarStock);
router.put('/:id', ProductosController.update);
router.delete('/:id', ProductosController.delete);
router.patch('/:id/restore', ProductosController.restore);
router.delete('/:id/force', ProductosController.forceDelete);
router.patch('/:id/stock', ProductosController.updateStock);

module.exports = router;