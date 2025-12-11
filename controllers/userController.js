const userService = require('../services/userService');

const userController = {
    // ====================
    // Halaman Utama - Tampilkan semua pengguna
    // ====================
    async index(req, res) {
        try {
            console.log('🔄 Loading users...');
            const result = await userService.getAllUsers();
            
            if (result.success) {
                res.render('index', {
                    title: 'Data Pengguna',
                    users: result.data || [],
                    message: req.query.message || null,
                    error: req.query.error || null,
                    keyword: '' // Default value untuk search form
                });
            } else {
                res.render('error', {
                    error: result.message || 'Gagal mengambil data pengguna'
                });
            }
        } catch (error) {
            console.error('❌ Error in index:', error);
            res.render('error', {
                error: 'Terjadi kesalahan pada server'
            });
        }
    },

    // ====================
    // Halaman Form Tambah Pengguna
    // ====================
    createForm(req, res) {
        try {
            res.render('form', {
                title: 'Tambah Pengguna Baru',
                user: null,
                action: '/users/create',
                error: null
            });
        } catch (error) {
            console.error('❌ Error in createForm:', error);
            res.render('error', {
                error: 'Gagal memuat halaman tambah pengguna'
            });
        }
    },

    // ====================
    // Proses Tambah Pengguna Baru
    // ====================
    async create(req, res) {
        try {
            const { nama, email, telepon, alamat, usia } = req.body;
            
            console.log('➕ Creating user with data:', { nama, email });
            
            // Validasi input
            if (!nama || !nama.trim()) {
                return res.render('form', {
                    title: 'Tambah Pengguna Baru',
                    user: req.body,
                    action: '/users/create',
                    error: 'Nama wajib diisi'
                });
            }
            
            if (!email || !email.trim()) {
                return res.render('form', {
                    title: 'Tambah Pengguna Baru',
                    user: req.body,
                    action: '/users/create',
                    error: 'Email wajib diisi'
                });
            }
            
            // Validasi format email sederhana
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                return res.render('form', {
                    title: 'Tambah Pengguna Baru',
                    user: req.body,
                    action: '/users/create',
                    error: 'Format email tidak valid'
                });
            }

            // Panggil service untuk create user
            const result = await userService.createUser({
                nama: nama.trim(),
                email: email.trim(),
                telepon: telepon ? telepon.trim() : null,
                alamat: alamat ? alamat.trim() : null,
                usia: usia ? parseInt(usia) : null
            });

            if (result.success) {
                console.log('✅ User created:', result.data);
                res.redirect('/?message=' + encodeURIComponent(result.message));
            } else {
                console.log('❌ Failed to create user:', result.message);
                res.render('form', {
                    title: 'Tambah Pengguna Baru',
                    user: req.body,
                    action: '/users/create',
                    error: result.message
                });
            }
        } catch (error) {
            console.error('❌ Error in create:', error);
            res.render('form', {
                title: 'Tambah Pengguna Baru',
                user: req.body,
                action: '/users/create',
                error: 'Terjadi kesalahan saat menambahkan pengguna'
            });
        }
    },

    // ====================
    // Halaman Form Edit Pengguna
    // ====================
    async editForm(req, res) {
        try {
            const { id } = req.params;
            console.log('✏️ Loading user for edit:', id);
            
            const result = await userService.getUserById(id);

            if (result.success) {
                res.render('form', {
                    title: 'Edit Pengguna',
                    user: result.data,
                    action: `/users/update/${id}`,
                    error: null
                });
            } else {
                console.log('❌ User not found for edit:', id);
                res.redirect('/?error=' + encodeURIComponent(result.message));
            }
        } catch (error) {
            console.error('❌ Error in editForm:', error);
            res.redirect('/?error=' + encodeURIComponent('Gagal memuat data pengguna'));
        }
    },

    // ====================
    // Proses Update Pengguna
    // ====================
    async update(req, res) {
        try {
            const { id } = req.params;
            const { nama, email, telepon, alamat, usia } = req.body;
            
            console.log('🔄 Updating user:', id, { nama, email });
            
            // Validasi input
            if (!nama || !nama.trim()) {
                // Ambil data user dulu untuk ditampilkan kembali
                const userResult = await userService.getUserById(id);
                return res.render('form', {
                    title: 'Edit Pengguna',
                    user: userResult.success ? userResult.data : req.body,
                    action: `/users/update/${id}`,
                    error: 'Nama wajib diisi'
                });
            }
            
            if (!email || !email.trim()) {
                const userResult = await userService.getUserById(id);
                return res.render('form', {
                    title: 'Edit Pengguna',
                    user: userResult.success ? userResult.data : req.body,
                    action: `/users/update/${id}`,
                    error: 'Email wajib diisi'
                });
            }
            
            // Validasi format email
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                const userResult = await userService.getUserById(id);
                return res.render('form', {
                    title: 'Edit Pengguna',
                    user: userResult.success ? userResult.data : req.body,
                    action: `/users/update/${id}`,
                    error: 'Format email tidak valid'
                });
            }

            // Panggil service untuk update user
            const result = await userService.updateUser(id, {
                nama: nama.trim(),
                email: email.trim(),
                telepon: telepon ? telepon.trim() : null,
                alamat: alamat ? alamat.trim() : null,
                usia: usia ? parseInt(usia) : null
            });

            if (result.success) {
                console.log('✅ User updated:', result.data);
                res.redirect('/?message=' + encodeURIComponent(result.message));
            } else {
                console.log('❌ Failed to update user:', result.message);
                res.render('form', {
                    title: 'Edit Pengguna',
                    user: req.body,
                    action: `/users/update/${id}`,
                    error: result.message
                });
            }
        } catch (error) {
            console.error('❌ Error in update:', error);
            res.redirect('/?error=' + encodeURIComponent('Terjadi kesalahan saat memperbarui data'));
        }
    },

    // ====================
    // Proses Hapus Pengguna
    // ====================
    async delete(req, res) {
        try {
            const { id } = req.params;
            console.log('🗑️ Deleting user:', id);
            
            const result = await userService.deleteUser(id);

            if (result.success) {
                console.log('✅ User deleted:', id);
                res.redirect('/?message=' + encodeURIComponent(result.message));
            } else {
                console.log('❌ Failed to delete user:', result.message);
                res.redirect('/?error=' + encodeURIComponent(result.message));
            }
        } catch (error) {
            console.error('❌ Error in delete:', error);
            res.redirect('/?error=' + encodeURIComponent('Terjadi kesalahan saat menghapus data'));
        }
    },

    // ====================
    // Pencarian Pengguna
    // ====================
    async search(req, res) {
        try {
            const { keyword } = req.query;
            console.log('🔍 Searching for:', keyword);
            
            if (!keyword || keyword.trim() === '') {
                return res.redirect('/');
            }

            const result = await userService.searchUsers(keyword);
            
            if (result.success) {
                res.render('index', {
                    title: `Hasil Pencarian: ${keyword}`,
                    users: result.data || [],
                    keyword: keyword,
                    message: result.data && result.data.length === 0 ? 'Tidak ada hasil yang ditemukan' : null,
                    error: null
                });
            } else {
                res.render('error', {
                    error: result.message
                });
            }
        } catch (error) {
            console.error('❌ Error in search:', error);
            res.render('error', {
                error: 'Terjadi kesalahan saat mencari pengguna'
            });
        }
    },

    // ====================
    // Halaman Statistik
    // ====================
    async stats(req, res) {
        try {
            console.log('📊 Loading user statistics...');
            const result = await userService.getUserStats();
            
            if (result.success) {
                res.render('stats', {
                    title: 'Statistik Pengguna',
                    stats: result.data || { 
                        totalUsers: 0, 
                        latestUsers: []
                    },
                    message: null,
                    error: null
                });
            } else {
                res.render('error', {
                    error: result.message
                });
            }
        } catch (error) {
            console.error('❌ Error in stats:', error);
            res.render('error', {
                error: 'Terjadi kesalahan saat mengambil statistik'
            });
        }
    }
};

module.exports = userController;