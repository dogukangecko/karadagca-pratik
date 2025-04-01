// backend/server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { testConnection } = require('./config/db');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5001;

app.use(cors()); // Geliştirme için şimdilik hepsi açık
app.use(express.json()); // JSON body parser
console.log("Statik dosya yolu ayarlanıyor:", path.join(__dirname, '../frontend/public/audio')); // Yolu kontrol etmek için log
app.use('/audio', express.static(path.join(__dirname, 'public/audio')));
// Basit Ana Route
app.get('/', (req, res) => {
    res.send('Karadağca App Backend Çalışıyor!');
});

// --- API Rotaları ---
const authRoutes = require('./routes/auth');
const cardRoutes = require('./routes/cards');
const progressRoutes = require('./routes/progress');
const quizRoutes = require('./routes/quizResults');

app.use('/api/auth', authRoutes);
app.use('/api/cards', cardRoutes);
app.use('/api/progress', progressRoutes); // Koruma kendi içinde
app.use('/api/quiz/results', quizRoutes); // VEYA './routes/quiz' eğer dosya adı buysa
// --- /API Rotaları ---


// Bulunamayan Rotalar İçin 404
app.use((req, res, next) => {
    res.status(404).json({ message: 'Endpoint bulunamadı.' });
});

// Genel Hata Yönetimi Middleware'i
app.use((err, req, res, next) => {
    console.error("Genel Hata Yakalayıcı:", err); // Hatanın tamamını logla (production'da sadece gerekli kısımları logla)

    // express-validator hatalarını özel olarak ele alabiliriz (opsiyonel)
    // if (err instanceof ValidationError) { ... }

    // Genel hata mesajı
    const statusCode = err.statusCode || 500;
    const message = err.message || 'Sunucuda beklenmeyen bir hata oluştu.';

    res.status(statusCode).json({
        message,
        // Geliştirme ortamında hatanın detayını da gönder (opsiyonel)
        stack: process.env.NODE_ENV === 'production' ? undefined : err.stack,
    });
});


// Sunucuyu Başlat
app.listen(PORT, async () => {
    console.log(`Backend sunucusu http://localhost:${PORT} adresinde çalışıyor`);
    await testConnection(); // Veritabanı bağlantısını test et
});