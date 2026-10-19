'use strict';

const path = require('node:path');
const express = require('express');
const fs = require('node:fs');
const os = require('node:os');

const { createRateLimit } = require('../lib/rate-limit');
const app = express();

const globalLimit = createRateLimit({
  name: 'global',
  windowMs: 60_000,
  max: Number(process.env.RATE_LIMIT_GLOBAL) || 100,
});

app.use(globalLimit);

// Serve static UI from public/
const publicDir = path.join(__dirname, '..', 'public');
app.use(express.static(publicDir, { extensions: ['html'] }));

// API routes
const apiRouter = require('./routes/api');
app.use('/api', apiRouter);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  const status = err.statusCode || 500;
  res.status(status).json({ error: err.message || 'Internal error' });
});

// Start server
const PORT = Number(process.env.PORT) || 3000;
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`PulseSave running at http://localhost:${PORT}`);
});

// Write PID file forProc monitoring
const pidPath = path.join(__dirname, '..', 'server.pid');
fs.writeFileSync(pidPath, String(process.pid));

// Graceful shutdown
const SIGS = ['SIGTERM', 'SIGINT'];
for (const sig of SIGS) {
  process.on(sig, () => {
    console.log(`Received ${sig}, shutting down...`);
    server.close(() => {
      try { fs.unlinkSync(pidPath); } catch {}
      process.exit(0);
    });
  });
}
