const router  = require('express').Router();
const ctrl    = require('../controllers/fare.controller');
const { protect } = require('../middleware/auth.middleware');

router.get('/ordinance',                  ctrl.getOrdinance);
router.post('/calculate',                 ctrl.calculateFare);   // optional auth
router.post('/resibo/:calculationId',  protect, ctrl.markResiboGenerated);
router.get('/terminals',                  ctrl.getTerminals);

module.exports = router;
