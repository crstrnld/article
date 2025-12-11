require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();

// ======================
// KONFIGURASI VIEW ENGINE
// ======================
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// ======================
// MIDDLEWARE
// ======================
app.use(express.static(path.join(__dirname, 'public')));

// Middleware untuk parsing JSON
app.use(express.json());

// Middleware untuk parsing form data
app.use(express.urlencoded({ extended: true }));

// Middleware untuk logging
app.use((req, res, next) => {
    console.log(`${new Date().toLocaleTimeString()} - ${req.method} ${req.url}`);
    next();
});

// ======================
// ROUTES
// ======================
try {
    const routes = require('./routes');
    app.use('/', routes);
    console.log('Routes loaded successfully');
} catch (error) {
    console.error('Failed to load routes:', error);
    app.get('/', (req, res) => {
        res.send(`
            <h1>Aplikasi CRUD</h1>
            <p>Routes gagal dimuat: ${error.message}</p>
            <p>Periksa file controllers/userController.js</p>
        `);
    });
}

// ======================
// ERROR HANDLING
// ======================

// 404 Handler
app.use((req, res, next) => {
    res.status(404).render('error', {
        error: 'Halaman tidak ditemukan'
    });
});

// Error handler umum
app.use((err, req, res, next) => {
    console.error('App error:', err.stack);
    
    res.status(500).render('error', {
        error: process.env.NODE_ENV === 'development' 
            ? err.message 
            : 'Terjadi kesalahan pada server'
    });
});

// ======================
// EKSPOR APLIKASI
// ======================
module.exports = app;

console.log('App initialized');