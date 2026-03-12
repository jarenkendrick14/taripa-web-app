// routes/auth.routes.js
const router = require('express').Router();
const ctrl   = require('../controllers/auth.controller');
const { protect } = require('../middleware/auth.middleware');

router.post('/register',         ctrl.register);
router.post('/login',            ctrl.login);
router.get('/me',       protect, ctrl.getMe);
router.patch('/trusted-contact', protect, ctrl.updateTrustedContact);

module.exports = router;
