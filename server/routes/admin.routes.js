const router = require('express').Router();
const ctrl   = require('../controllers/admin.controller');
const { protect, adminOnly } = require('../middleware/auth.middleware');

router.use(protect, adminOnly);

router.get('/stats',                  ctrl.getStats);
router.get('/reports',                ctrl.getReports);
router.patch('/reports/:id/status',   ctrl.updateReportStatus);
router.get('/users',                  ctrl.getUsers);
router.get('/terminals',              ctrl.getTerminals);
router.post('/terminals',             ctrl.createTerminal);
router.put('/terminals/:id',          ctrl.updateTerminal);
router.delete('/terminals/:id',       ctrl.deleteTerminal);
router.put('/users/:id',              ctrl.updateUser);
router.delete('/users/:id',           ctrl.deleteUser);
router.get('/ptro',                   ctrl.getPtroReports);
router.post('/ptro/trigger',          ctrl.triggerPtroReport);

module.exports = router;
