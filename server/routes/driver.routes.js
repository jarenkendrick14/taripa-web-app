const router = require('express').Router();
const ctrl   = require('../controllers/driver.controller');
const { protect, adminOnly } = require('../middleware/auth.middleware');

router.get('/lookup/:bodyNumber', ctrl.lookupDriver);
router.get('/flagged',            ctrl.getFlagged);
router.get('/search',             ctrl.searchDrivers);

module.exports = router;
