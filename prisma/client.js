const { PrismaClient } = require('@prisma/client');

// Buat instance Prisma Client
const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error'],
});

// Setup database dengan Prisma Migrate
async function setupDatabase() {
  try {
    console.log('🔗 Menghubungkan ke database...');
    
    // Cek koneksi
    await prisma.$connect();
    console.log('✅ Database terhubung!');
    
    // Cek apakah ada data
    const userCount = await prisma.user.count();
    console.log(`📊 Jumlah pengguna: ${userCount}`);
    
    // Jika tidak ada data, tambah sample
    if (userCount === 0) {
      console.log('➕ Menambahkan data contoh...');
      await prisma.user.createMany({
        data: [
          {
            nama: 'Budi Santoso',
            email: 'budi@example.com',
            telepon: '081234567890',
            alamat: 'Jakarta',
            usia: 25,
          },
          {
            nama: 'Siti Aminah',
            email: 'siti@example.com',
            telepon: '082345678901',
            alamat: 'Bandung',
            usia: 30,
          },
          {
            nama: 'Agus Wijaya',
            email: 'agus@example.com',
            telepon: '083456789012',
            usia: 28,
          },
        ],
      });
      console.log('✅ Data contoh berhasil ditambahkan!');
    }
    
    return { success: true };
  } catch (error) {
    console.error('❌ Database error:', error.message);
    
    // Jika tabel belum ada, coba buat dengan db push
    if (error.code === 'P2021' || error.code === 'P1001') {
      console.log('🔄 Mencoba membuat tabel...');
      try {
        const { execSync } = require('child_process');
        execSync('npx prisma db push', { stdio: 'inherit' });
        console.log('✅ Tabel berhasil dibuat!');
        return { success: true };
      } catch (pushError) {
        console.error('❌ Gagal membuat tabel:', pushError.message);
      }
    }
    
    return { success: false, error: error.message };
  }
}

module.exports = { prisma, setupDatabase };