const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/membresiasController');

router.get('/', ctrl.getAll);
router.get('/inactive', ctrl.getInactive);
router.get('/:id', ctrl.getOne);
router.post('/', ctrl.create);
router.put('/:id', ctrl.update);
router.delete('/:id', ctrl.delete);
router.put('/:id/restore', ctrl.restore);
router.delete('/:id/force', ctrl.forceDelete);

module.exports = router;