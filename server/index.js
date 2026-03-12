// ─────────────────────────────────────────────────────────────
// TARIPA Backend — index.js
// ─────────────────────────────────────────────────────────────
require('dotenv').config();
const express   = require('express');
const cors      = require('cors');
const helmet    = require('helmet');
const rateLimit = require('express-rate-limit');
const cron      = require('node-cron');

const db          = require('./config/db');
const fareRoutes  = require('./routes/fare.routes');
const driverRoutes = require('./routes/driver.routes');
const reportRoutes = require('./routes/report.routes');
const authRoutes  = require('./routes/auth.routes');
const routeRoutes  = require('./routes/route.routes');
const configRoutes = require('./routes/config.routes');
const ptroService  = require('./services/ptro.service');

const app  = express();
const PORT = process.env.PORT || 3000;

// ─── Security middleware ──────────────────────────────────
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:4200',
  credentials: true,
}));

// ─── Rate limiter ─────────────────────────────────────────
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please try again later.' },
});
app.use('/api/', limiter);

// ─── Body parser ──────────────────────────────────────────
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true }));

// ─── Routes ───────────────────────────────────────────────
app.use('/api/auth',     authRoutes);
app.use('/api/fare',     fareRoutes);
app.use('/api/drivers',  driverRoutes);
app.use('/api/reports',  reportRoutes);
app.use('/api/route',    routeRoutes);
app.use('/api/config',   configRoutes);

// ─── Health check ─────────────────────────────────────────
app.get('/api/health', async (req, res) => {
  try {
    await db.query('SELECT 1');
    res.json({ status: 'ok', service: 'TARIPA API', db: 'connected' });
  } catch {
    res.status(503).json({ status: 'error', db: 'disconnected' });
  }
});

// ─── 404 handler ──────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// ─── Global error handler ─────────────────────────────────
app.use((err, req, res, _next) => {
  console.error('[TARIPA ERROR]', err.message);
  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production'
      ? 'Internal server error'
      : err.message,
  });
});

// ─── Scheduled Jobs ───────────────────────────────────────

// Every Sunday 23:59 — generate & send PTRO weekly report
cron.schedule('59 23 * * 0', async () => {
  console.log('[CRON] Generating weekly PTRO report...');
  await ptroService.generateAndSendWeeklyReport();
});

// Every hour — refresh tricycle flags & terminal alerts
cron.schedule('0 * * * *', async () => {
  await db.query('CALL RefreshTricycleFlags()');
  await db.query('CALL RefreshTerminalAlerts()');
  console.log('[CRON] Flags & terminal alerts refreshed');
});

// ─── Start server ─────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`
  ████████╗ █████╗ ██████╗ ██╗██████╗  █████╗
     ██╔══╝██╔══██╗██╔══██╗██║██╔══██╗██╔══██╗
     ██║   ███████║██████╔╝██║██████╔╝███████║
     ██║   ██╔══██║██╔══██╗██║██╔═══╝ ██╔══██║
     ██║   ██║  ██║██║  ██║██║██║     ██║  ██║
     ╚═╝   ╚═╝  ╚═╝╚═╝  ╚═╝╚═╝╚═╝     ╚═╝  ╚═╝
  
  🛺  TARIPA API running on port ${PORT}
  📍  Environment: ${process.env.NODE_ENV}
  `);
});
