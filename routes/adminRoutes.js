const express = require('express');
const router = express.Router();

router.get('/dashboard', (req, res) => {
    res.json({ message: 'Admin dashboard working' });
});

module.exports = router;