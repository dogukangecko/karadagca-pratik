// backend/config/db.js
const mysql = require('mysql2/promise'); // Promise tabanlı sürümü kullanıyoruz
require('dotenv').config(); // .env dosyasını yükle

// Bağlantı havuzu oluşturuyoruz (performans için)
const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10, // Aynı anda açılabilecek maksimum bağlantı sayısı
    queueLimit: 0 // Bağlantı limiti dolduğunda bekleyecek istek sınırı (0 = sınırsız)
});

async function testConnection() {
    let connection;
    try {
        connection = await pool.getConnection();
        console.log('MySQL Veritabanına başarıyla bağlanıldı!');
        return true;
    } catch (error) {
        console.error('MySQL bağlantı hatası:', error.message); // Daha spesifik hata mesajı
        // Uygulamanın başlamasını engellemek isteyebilirsiniz
        // process.exit(1);
        return false;
    } finally {
        if (connection) connection.release();
    }
}

module.exports = { pool, testConnection };