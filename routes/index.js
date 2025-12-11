const express = require('express');
const router = express.Router();

// Import controller
const userController = require('../controllers/userController');

// Halaman utama
router.get('/', userController.index);

// Pencarian
router.get('/search', userController.search);

// Statistik
router.get('/stats', userController.stats);

// CRUD Routes untuk Pengguna
router.get('/users/create', userController.createForm);
router.post('/users/create', userController.create);

router.get('/users/edit/:id', userController.editForm);
router.post('/users/update/:id', userController.update);

router.get('/users/delete/:id', userController.delete);

// Halaman 404
router.use((req, res) => {
    res.status(404).render('error', {
        error: 'Halaman tidak ditemukan'
    });
});

module.exports = router;