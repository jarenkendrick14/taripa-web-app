const express = require('express');
const router  = express.Router();
const { getConfig } = require('../controllers/config.controller');

router.get('/', getConfig);

module.exports = router;
