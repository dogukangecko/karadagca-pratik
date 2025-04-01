// backend/middleware/authMiddleware.js
const jwt = require('jsonwebtoken');
require('dotenv').config();

const protect = (req, res, next) => {
    let token;
    const authHeader = req.headers.authorization; // Önce header'ı alalım

    // console.log('[Protect Middleware] Çalışıyor. Header:', authHeader); // Debug

    if (authHeader && authHeader.startsWith('Bearer')) {
        try {
            token = authHeader.split(' ')[1];
            // console.log('[Protect Middleware] Token bulundu:', token); // Debug

            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            // console.log('[Protect Middleware] Token doğrulandı. Decoded:', decoded); // Debug

            // *** DÜZELTME: Payload'daki doğru anahtarı kullan ('userId') ***
            if (!decoded.userId) { // Payload'da userId var mı diye kontrol et
                console.error('[Protect Middleware] Token payload içinde userId bulunamadı!', decoded);
                // Hata durumunda return ekle
                return res.status(401).json({ message: 'Yetkilendirme başarısız, token geçersiz (payload).' });
            }
            req.userId = decoded.userId; // Doğru anahtarı kullan ('userId')
            // *** DÜZELTME SONU ***

            console.log('[Protect Middleware] req.userId ayarlandı:', req.userId); // Debug

            next(); // Sonraki adıma geç

        } catch (error) {
            console.error('[Protect Middleware] Token doğrulama hatası:', error.name, error.message);
            if (error.name === 'TokenExpiredError') {
                // Hata durumunda return ekle
                return res.status(401).json({ message: 'Oturum süresi doldu, lütfen tekrar giriş yapın.' });
            }
            // Hata durumunda return ekle
            return res.status(401).json({ message: 'Yetkisiz erişim, geçersiz token.' });
        }
    }

    if (!token) {
        console.log('[Protect Middleware] Token bulunamadı.');
        // Hata durumunda return ekle
        return res.status(401).json({ message: 'Yetkisiz erişim, token bulunamadı.' });
    }
};

module.exports = { protect };