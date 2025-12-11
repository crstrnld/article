const { prisma } = require('../prisma/client');

const userService = {
    // CREATE: Tambah pengguna baru
    async createUser(data) {
        try {
            console.log('Creating user:', data);
            
            if (!data.nama || !data.email) {
                return { success: false, message: 'Nama dan Email wajib diisi' };
            }

            const user = await prisma.user.create({
                data: {
                    nama: data.nama.trim(),
                    email: data.email.trim().toLowerCase(),
                    telepon: data.telepon ? data.telepon.trim() : null,
                    alamat: data.alamat ? data.alamat.trim() : null,
                    usia: data.usia ? parseInt(data.usia) : null
                }
            });
            
            return { 
                success: true, 
                data: user, 
                message: 'Pengguna berhasil ditambahkan' 
            };
        } catch (error) {
            console.error('Error creating user:', error);
            if (error.code === 'P2002') {
                return { success: false, message: 'Email sudah terdaftar' };
            }
            return { 
                success: false, 
                message: 'Gagal menambahkan pengguna' 
            };
        }
    },

    // READ: Ambil semua pengguna
    async getAllUsers() {
        try {
            console.log('Getting all users...');
            const users = await prisma.user.findMany({
                orderBy: { createdAt: 'desc' }
            });
            console.log('Found users:', users.length);
            return { success: true, data: users };
        } catch (error) {
            console.error('Error getting users:', error);
            return { 
                success: false, 
                message: 'Gagal mengambil data pengguna' 
            };
        }
    },

    // READ: Ambil pengguna berdasarkan ID
    async getUserById(id) {
        try {
            console.log('Getting user by ID:', id);
            const user = await prisma.user.findUnique({
                where: { id: parseInt(id) }
            });
            
            if (!user) {
                return { success: false, message: 'Pengguna tidak ditemukan' };
            }
            
            return { success: true, data: user };
        } catch (error) {
            console.error('Error getting user by ID:', error);
            return { 
                success: false, 
                message: 'Gagal mengambil data pengguna' 
            };
        }
    },

    // UPDATE: Perbarui data pengguna
    async updateUser(id, data) {
        try {
            console.log('Updating user:', id, data);
            
            // Cek apakah user ada
            const existingUser = await prisma.user.findUnique({
                where: { id: parseInt(id) }
            });
            
            if (!existingUser) {
                return { success: false, message: 'Pengguna tidak ditemukan' };
            }

            const user = await prisma.user.update({
                where: { id: parseInt(id) },
                data: {
                    nama: data.nama.trim(),
                    email: data.email.trim().toLowerCase(),
                    telepon: data.telepon ? data.telepon.trim() : null,
                    alamat: data.alamat ? data.alamat.trim() : null,
                    usia: data.usia ? parseInt(data.usia) : null
                }
            });
            
            return { 
                success: true, 
                data: user, 
                message: 'Data pengguna berhasil diperbarui' 
            };
        } catch (error) {
            console.error('Error updating user:', error);
            if (error.code === 'P2002') {
                return { success: false, message: 'Email sudah digunakan' };
            }
            return { 
                success: false, 
                message: 'Gagal memperbarui pengguna' 
            };
        }
    },

    // DELETE: Hapus pengguna
    async deleteUser(id) {
        try {
            console.log('Deleting user:', id);
            
            // Cek apakah user ada
            const existingUser = await prisma.user.findUnique({
                where: { id: parseInt(id) }
            });
            
            if (!existingUser) {
                return { success: false, message: 'Pengguna tidak ditemukan' };
            }

            await prisma.user.delete({
                where: { id: parseInt(id) }
            });
            
            return { 
                success: true, 
                message: 'Pengguna berhasil dihapus' 
            };
        } catch (error) {
            console.error('Error deleting user:', error);
            return { 
                success: false, 
                message: 'Gagal menghapus pengguna' 
            };
        }
    },

    // Pencarian pengguna
    async searchUsers(keyword) {
        try {
            console.log('Searching for:', keyword);
            const users = await prisma.user.findMany({
                where: {
                    OR: [
                        { nama: { contains: keyword } },
                        { email: { contains: keyword } },
                        { telepon: { contains: keyword } }
                    ]
                },
                orderBy: { nama: 'asc' }
            });
            return { success: true, data: users };
        } catch (error) {
            console.error('Error searching users:', error);
            return { 
                success: false, 
                message: 'Gagal mencari pengguna' 
            };
        }
    },

    // Statistik pengguna (TANPA rata-rata usia)
    async getUserStats() {
        try {
            console.log('Getting user stats...');
            const totalUsers = await prisma.user.count();
            const latestUsers = await prisma.user.findMany({
                take: 5,
                orderBy: { createdAt: 'desc' }
            });
            
            return {
                success: true,
                data: {
                    totalUsers,
                    latestUsers
                }
            };
        } catch (error) {
            console.error('Error getting stats:', error);
            return { 
                success: false, 
                message: 'Gagal mengambil statistik' 
            };
        }
    }
};

module.exports = userService;