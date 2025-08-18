// server.js (CommonJS)
require('dotenv').config();

const path = require('path');
const express = require('express');
const next = require('next');
const routes = require('./routes');

const dev = process.env.NODE_ENV !== 'production';

// If your Next app is NOT in a subfolder, keep as is.
// If it IS (e.g., ./frontend), use: const app = next({ dev, dir: path.join(__dirname, 'frontend') });
const app = next({ dev });

// ⬇️ Define handle BEFORE you use it
const handle = app.getRequestHandler();

const PORT = process.env.PORT || 3001;

app.prepare().then(() => {
  const server = express();

  // Optional: static files
  server.use(express.static(path.join(__dirname, 'public')));

  // API routes (your Express router)
  server.use('/api', routes);

  // Catch-all for everything else → let Next render it
  // NOTE: Express v5 doesn't accept '*'—use server.use with no path.
  server.use((req, res) => handle(req, res));

  server.listen(PORT, () => {
    console.log(`> Ready on http://localhost:${PORT}`);
  });
}).catch((err) => {
  console.error('Error starting server:', err);
  process.exit(1);
});
