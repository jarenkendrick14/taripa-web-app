const express = require('express');
const router  = express.Router();
const { getRoute } = require('../controllers/route.controller');

// GET /api/route?origin_lat=&origin_lng=&dest_lat=&dest_lng=
router.get('/', getRoute);

module.exports = router;
