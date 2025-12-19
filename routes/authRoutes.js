const express = require('express');
const router = express.Router();

// Test route dulu
router.get('/', (req, res) => {
    res.json({ message: 'Articles route working' });
});

router.get('/:id', (req, res) => {
    res.json({ message: `Article ${req.params.id} route working` });
});

module.exports = router;