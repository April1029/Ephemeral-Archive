const express = require('express');
const router = express.Router();

// Home route
router.get('/', (req, res) => {
  res.sendFile('index.html', { root: 'public' });
});

// Example API route
router.get('/api/hello', (req, res) => {
  res.json({ message: 'Hello from the API!' });
});

module.exports = router;
