const express = require('express');
const router = express.Router();

// Example API route
router.get('/api/hello', (req, res) => {
  res.json({ message: 'Hello from the Ephemeral Archive!' });
});

module.exports = router;
