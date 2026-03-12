const router = require('express').Router();
const ctrl   = require('../controllers/report.controller');
const { protect, adminOnly } = require('../middleware/auth.middleware');

router.post('/submit',          protect, ctrl.submitReport);
router.get('/my',               protect, ctrl.getMyReports);
router.post('/safe-ride',       protect, ctrl.logSafeRide);
router.get('/admin/pending',    protect, adminOnly, ctrl.getPendingReports);

module.exports = router;
