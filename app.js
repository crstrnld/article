const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');

const app = express();
const PORT = 3000;
const JWT_SECRET = 'your-secret-key-123456';

// ===== MIDDLEWARE SETUP =====
app.use(express.json());
app.use(express.static('public'));

// ===== DATABASE SETUP =====
const db = new sqlite3.Database('./database.db');

// Create tables
db.serialize(() => {
    // Users table
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT CHECK(role IN ('admin', 'member')) DEFAULT 'member',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Articles table
    db.run(`CREATE TABLE IF NOT EXISTS articles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        author_id INTEGER NOT NULL,
        status TEXT CHECK(status IN ('published', 'draft')) DEFAULT 'published',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE
    )`);
});

// Database helper functions
const dbGet = (sql, params = []) => {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
};

const dbAll = (sql, params = []) => {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
};

const dbRun = (sql, params = []) => {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function(err) {
            if (err) reject(err);
            else resolve({ id: this.lastID, changes: this.changes });
        });
    });
};

// ===== CUSTOM MIDDLEWARE =====
// 1. Authentication Middleware
const authenticate = async (req, res, next) => {
    try {
        const token = req.header('Authorization')?.replace('Bearer ', '');
        if (!token) {
            req.user = null;
            return next();
        }
        
        const decoded = jwt.verify(token, JWT_SECRET);
        const user = await dbGet(
            'SELECT id, username, email, role, created_at FROM users WHERE id = ?',
            [decoded.userId]
        );
        
        if (!user) {
            req.user = null;
            return next();
        }
        
        req.user = user;
        req.token = token;
        next();
    } catch (error) {
        req.user = null;
        next();
    }
};

// 2. Require Authentication Middleware
const requireAuth = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({
            success: false,
            error: 'Authentication required. Please login first.'
        });
    }
    next();
};

// 3. Authorization Middleware (Role-based)
const authorize = (roles = []) => {
    if (typeof roles === 'string') {
        roles = [roles];
    }
    
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                error: 'Authentication required'
            });
        }
        
        if (roles.length && !roles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                error: `Access denied. Required role: ${roles.join(', ')}. Your role: ${req.user.role}`
            });
        }
        
        next();
    };
};

// 4. Article Ownership Middleware
const checkArticleOwnership = async (req, res, next) => {
    try {
        const article = await dbGet(
            'SELECT * FROM articles WHERE id = ?',
            [req.params.id]
        );
        
        if (!article) {
            return res.status(404).json({
                success: false,
                error: 'Article not found'
            });
        }
        
        // Admin can access all articles
        if (req.user.role === 'admin') {
            req.article = article;
            return next();
        }
        
        // Member can only access their own articles
        if (article.author_id !== req.user.id) {
            return res.status(403).json({
                success: false,
                error: 'You can only manage your own articles'
            });
        }
        
        req.article = article;
        next();
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Server error'
        });
    }
};

// ===== AUTHENTICATION ROUTES =====
// 1. Register new user
app.post('/api/auth/register', async (req, res) => {
    try {
        const { username, email, password, role = 'member' } = req.body;
        
        // Validation
        if (!username || !email || !password) {
            return res.status(400).json({
                success: false,
                error: 'Please provide username, email and password'
            });
        }
        
        // Check if user exists
        const existingUser = await dbGet(
            'SELECT * FROM users WHERE email = ? OR username = ?',
            [email, username]
        );
        
        if (existingUser) {
            return res.status(400).json({
                success: false,
                error: 'User already exists with this email or username'
            });
        }
        
        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);
        
        // Create user
        const result = await dbRun(
            'INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)',
            [username, email, hashedPassword, role]
        );
        
        // Get created user
        const user = await dbGet(
            'SELECT id, username, email, role, created_at FROM users WHERE id = ?',
            [result.id]
        );
        
        // Generate JWT token
        const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });
        
        res.status(201).json({
            success: true,
            message: 'Registration successful',
            token,
            user
        });
        
    } catch (error) {
        console.error('Register error:', error);
        res.status(500).json({
            success: false,
            error: 'Server error'
        });
    }
});

// 2. Login user
app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        // Validation
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                error: 'Please provide email and password'
            });
        }
        
        // Find user
        const user = await dbGet(
            'SELECT * FROM users WHERE email = ?',
            [email]
        );
        
        if (!user) {
            return res.status(401).json({
                success: false,
                error: 'Invalid email or password'
            });
        }
        
        // Check password
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.status(401).json({
                success: false,
                error: 'Invalid email or password'
            });
        }
        
        // Remove password from user object
        const { password: _, ...userWithoutPassword } = user;
        
        // Generate JWT token
        const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });
        
        res.json({
            success: true,
            message: 'Login successful',
            token,
            user: userWithoutPassword
        });
        
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            success: false,
            error: 'Server error'
        });
    }
});

// 3. Get current user profile
app.get('/api/auth/me', authenticate, requireAuth, (req, res) => {
    res.json({
        success: true,
        user: req.user
    });
});

// ===== ARTICLE ROUTES =====
// 1. Public: Get all published articles
app.get('/api/articles', async (req, res) => {
    try {
        const articles = await dbAll(`
            SELECT a.*, u.username, u.email, u.role as author_role 
            FROM articles a 
            JOIN users u ON a.author_id = u.id 
            WHERE a.status = 'published'
            ORDER BY a.created_at DESC
        `);
        
        res.json({
            success: true,
            count: articles.length,
            articles
        });
        
    } catch (error) {
        console.error('Get articles error:', error);
        res.status(500).json({
            success: false,
            error: 'Server error'
        });
    }
});

// 2. Public: Get single article (with access control for drafts)
app.get('/api/articles/:id', authenticate, async (req, res) => {
    try {
        const article = await dbGet(`
            SELECT a.*, u.username, u.email, u.role as author_role 
            FROM articles a 
            JOIN users u ON a.author_id = u.id 
            WHERE a.id = ?
        `, [req.params.id]);
        
        if (!article) {
            return res.status(404).json({
                success: false,
                error: 'Article not found'
            });
        }
        
        // Check access for draft articles
        if (article.status === 'draft') {
            if (!req.user) {
                return res.status(403).json({
                    success: false,
                    error: 'Access denied. Login required to view draft articles.'
                });
            }
            
            if (req.user.role !== 'admin' && article.author_id !== req.user.id) {
                return res.status(403).json({
                    success: false,
                    error: 'Access denied. You can only view your own draft articles.'
                });
            }
        }
        
        res.json({
            success: true,
            article
        });
        
    } catch (error) {
        console.error('Get article error:', error);
        res.status(500).json({
            success: false,
            error: 'Server error'
        });
    }
});

// 3. Protected: Create new article (member/admin only)
app.post('/api/articles', authenticate, requireAuth, authorize(['member', 'admin']), async (req, res) => {
    try {
        const { title, content, status = 'published' } = req.body;
        
        if (!title || !content) {
            return res.status(400).json({
                success: false,
                error: 'Please provide title and content'
            });
        }
        
        const result = await dbRun(
            'INSERT INTO articles (title, content, author_id, status) VALUES (?, ?, ?, ?)',
            [title, content, req.user.id, status]
        );
        
        // Get created article with author info
        const article = await dbGet(`
            SELECT a.*, u.username, u.email, u.role as author_role 
            FROM articles a 
            JOIN users u ON a.author_id = u.id 
            WHERE a.id = ?
        `, [result.id]);
        
        res.status(201).json({
            success: true,
            message: 'Article created successfully',
            article
        });
        
    } catch (error) {
        console.error('Create article error:', error);
        res.status(500).json({
            success: false,
            error: 'Server error'
        });
    }
});

// 4. Protected: Update article (author or admin only)
app.put('/api/articles/:id', authenticate, requireAuth, checkArticleOwnership, async (req, res) => {
    try {
        const { title, content, status } = req.body;
        const updates = [];
        const params = [];
        
        if (title !== undefined) {
            updates.push('title = ?');
            params.push(title);
        }
        if (content !== undefined) {
            updates.push('content = ?');
            params.push(content);
        }
        if (status !== undefined) {
            updates.push('status = ?');
            params.push(status);
        }
        
        if (updates.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'No updates provided'
            });
        }
        
        params.push(req.params.id);
        
        await dbRun(
            `UPDATE articles SET ${updates.join(', ')} WHERE id = ?`,
            params
        );
        
        // Get updated article
        const updatedArticle = await dbGet(`
            SELECT a.*, u.username, u.email, u.role as author_role 
            FROM articles a 
            JOIN users u ON a.author_id = u.id 
            WHERE a.id = ?
        `, [req.params.id]);
        
        res.json({
            success: true,
            message: 'Article updated successfully',
            article: updatedArticle
        });
        
    } catch (error) {
        console.error('Update article error:', error);
        res.status(500).json({
            success: false,
            error: 'Server error'
        });
    }
});

// 5. Protected: Delete article (author or admin only)
app.delete('/api/articles/:id', authenticate, requireAuth, checkArticleOwnership, async (req, res) => {
    try {
        await dbRun('DELETE FROM articles WHERE id = ?', [req.params.id]);
        
        res.json({
            success: true,
            message: 'Article deleted successfully'
        });
        
    } catch (error) {
        console.error('Delete article error:', error);
        res.status(500).json({
            success: false,
            error: 'Server error'
        });
    }
});

// 6. Protected: Get my articles (member/admin only)
app.get('/api/articles/my/all', authenticate, requireAuth, authorize(['member', 'admin']), async (req, res) => {
    try {
        let sql = `
            SELECT a.*, u.username, u.email, u.role as author_role 
            FROM articles a 
            JOIN users u ON a.author_id = u.id 
        `;
        let params = [];
        
        // Admin can see all articles, member only their own
        if (req.user.role === 'member') {
            sql += ' WHERE a.author_id = ?';
            params.push(req.user.id);
        }
        
        sql += ' ORDER BY a.created_at DESC';
        
        const articles = await dbAll(sql, params);
        
        res.json({
            success: true,
            count: articles.length,
            articles
        });
        
    } catch (error) {
        console.error('Get my articles error:', error);
        res.status(500).json({
            success: false,
            error: 'Server error'
        });
    }
});

// ===== ADMIN ROUTES =====
// 1. Admin dashboard (admin only)
app.get('/api/admin/dashboard', authenticate, requireAuth, authorize(['admin']), async (req, res) => {
    try {
        const users = await dbAll('SELECT COUNT(*) as count FROM users');
        const articles = await dbAll('SELECT COUNT(*) as count FROM articles');
        const admins = await dbAll("SELECT COUNT(*) as count FROM users WHERE role = 'admin'");
        const members = await dbAll("SELECT COUNT(*) as count FROM users WHERE role = 'member'");
        
        res.json({
            success: true,
            message: 'Welcome to admin dashboard',
            stats: {
                totalUsers: users[0].count,
                totalArticles: articles[0].count,
                admins: admins[0].count,
                members: members[0].count
            }
        });
        
    } catch (error) {
        console.error('Admin dashboard error:', error);
        res.status(500).json({
            success: false,
            error: 'Server error'
        });
    }
});

// 2. Get all users (admin only)
app.get('/api/admin/users', authenticate, requireAuth, authorize(['admin']), async (req, res) => {
    try {
        const users = await dbAll(`
            SELECT id, username, email, role, created_at 
            FROM users 
            ORDER BY created_at DESC
        `);
        
        res.json({
            success: true,
            count: users.length,
            users
        });
        
    } catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({
            success: false,
            error: 'Server error'
        });
    }
});

// 3. Get all articles including drafts (admin only)
app.get('/api/admin/articles', authenticate, requireAuth, authorize(['admin']), async (req, res) => {
    try {
        const articles = await dbAll(`
            SELECT a.*, u.username, u.email, u.role as author_role 
            FROM articles a 
            JOIN users u ON a.author_id = u.id 
            ORDER BY a.created_at DESC
        `);
        
        res.json({
            success: true,
            count: articles.length,
            articles
        });
        
    } catch (error) {
        console.error('Get all articles admin error:', error);
        res.status(500).json({
            success: false,
            error: 'Server error'
        });
    }
});

// 4. Delete any article (admin only)
app.delete('/api/admin/articles/:id', authenticate, requireAuth, authorize(['admin']), async (req, res) => {
    try {
        const article = await dbGet('SELECT * FROM articles WHERE id = ?', [req.params.id]);
        
        if (!article) {
            return res.status(404).json({
                success: false,
                error: 'Article not found'
            });
        }
        
        await dbRun('DELETE FROM articles WHERE id = ?', [req.params.id]);
        
        res.json({
            success: true,
            message: 'Article deleted successfully by admin'
        });
        
    } catch (error) {
        console.error('Delete article admin error:', error);
        res.status(500).json({
            success: false,
            error: 'Server error'
        });
    }
});

// ===== SEED DATA ROUTE =====
app.get('/api/seed', async (req, res) => {
    try {
        // Clear existing data
        await dbRun('DELETE FROM articles');
        await dbRun('DELETE FROM users');
        
        // Create admin user
        const adminPassword = await bcrypt.hash('admin123', 10);
        const adminResult = await dbRun(
            'INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)',
            ['admin', 'admin@example.com', adminPassword, 'admin']
        );
        
        // Create member users
        const memberPassword1 = await bcrypt.hash('password123', 10);
        const member1Result = await dbRun(
            'INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)',
            ['john_doe', 'john@example.com', memberPassword1, 'member']
        );
        
        const memberPassword2 = await bcrypt.hash('password123', 10);
        const member2Result = await dbRun(
            'INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)',
            ['jane_smith', 'jane@example.com', memberPassword2, 'member']
        );
        
        // Create sample articles
        const articles = [
            ['Welcome to Authentication System', 'This is a complete authentication and authorization system with middleware implementation.', adminResult.id, 'published'],
            ['Getting Started with Node.js', 'Learn the basics of Node.js development and authentication.', member1Result.id, 'published'],
            ['Understanding Middleware', 'Middleware functions are essential in Express applications for authentication and authorization.', adminResult.id, 'published'],
            ['JWT Authentication Guide', 'Implement secure authentication using JSON Web Tokens in your applications.', member2Result.id, 'published'],
            ['Role-Based Access Control', 'Learn how to implement RBAC for better security in your applications.', adminResult.id, 'draft'],
            ['SQLite Database Setup', 'Setting up SQLite database for Node.js applications.', member1Result.id, 'published'],
            ['Password Hashing Best Practices', 'Why and how to properly hash passwords in your applications.', member2Result.id, 'published'],
            ['Building RESTful APIs', 'Best practices for building secure RESTful APIs with authentication.', adminResult.id, 'published']
        ];
        
        for (const article of articles) {
            await dbRun(
                'INSERT INTO articles (title, content, author_id, status) VALUES (?, ?, ?, ?)',
                article
            );
        }
        
        // Get counts
        const users = await dbAll('SELECT COUNT(*) as count FROM users');
        const articlesCount = await dbAll('SELECT COUNT(*) as count FROM articles');
        
        res.json({
            success: true,
            message: 'Database seeded successfully!',
            stats: {
                users: users[0].count,
                articles: articlesCount[0].count
            },
            testAccounts: [
                { email: 'admin@example.com', password: 'admin123', role: 'admin' },
                { email: 'john@example.com', password: 'password123', role: 'member' },
                { email: 'jane@example.com', password: 'password123', role: 'member' }
            ]
        });
        
    } catch (error) {
        console.error('Seed error:', error);
        res.status(500).json({
            success: false,
            error: 'Seed failed: ' + error.message
        });
    }
});

// ===== HEALTH CHECK =====
app.get('/api/health', async (req, res) => {
    try {
        const users = await dbAll('SELECT COUNT(*) as count FROM users');
        const articles = await dbAll('SELECT COUNT(*) as count FROM articles');
        
        res.json({
            success: true,
            status: 'healthy',
            database: 'SQLite3',
            timestamp: new Date().toISOString(),
            stats: {
                users: users[0].count,
                articles: articles[0].count
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Health check failed'
        });
    }
});

// ===== FRONTEND ROUTES =====
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/register', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'register.html'));
});

app.get('/articles', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'articles.html'));
});

app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// ===== START SERVER =====
app.listen(PORT, () => {
    console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                🔐 AUTH SYSTEM STARTED                        ║
║          Complete Middleware Authentication                   ║
╚═══════════════════════════════════════════════════════════════╝

🌐 Server running on: http://localhost:${PORT}

📋 AUTHENTICATION ENDPOINTS:
  POST   /api/auth/register  - Register new user
  POST   /api/auth/login     - Login user
  GET    /api/auth/me        - Get current user (requires auth)

📰 ARTICLE ENDPOINTS:
  GET    /api/articles       - Get all published articles (Public)
  GET    /api/articles/:id   - Get single article
  POST   /api/articles       - Create article (Auth required)
  PUT    /api/articles/:id   - Update article (Owner/Admin only)
  DELETE /api/articles/:id   - Delete article (Owner/Admin only)
  GET    /api/articles/my/all - Get my articles (Auth required)

👑 ADMIN ENDPOINTS:
  GET    /api/admin/dashboard - Admin dashboard (Admin only)
  GET    /api/admin/users    - Get all users (Admin only)
  GET    /api/admin/articles - Get all articles including drafts (Admin only)
  DELETE /api/admin/articles/:id - Delete any article (Admin only)

🗃️  UTILITY ENDPOINTS:
  GET    /api/seed          - Seed database with test data
  GET    /api/health        - Health check

🔑 TEST ACCOUNTS (after seeding):
  👑 Admin:    admin@example.com   / admin123
  👤 Member 1: john@example.com    / password123
  👤 Member 2: jane@example.com    / password123

🌐 FRONTEND PAGES:
  🏠  /         - Homepage
  🔐  /login    - Login page
  📝  /register - Register page
  📰  /articles - Articles page
  📊  /dashboard - Dashboard page

⚡ Run 'npm run dev' to start development server
`);
});