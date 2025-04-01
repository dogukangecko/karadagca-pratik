// backend/routes/auth.js
const express = require('express');
const bcrypt = require('bcryptjs'); // bcryptjs veya bcrypt (hangisini kurduysanız)
const jwt = require('jsonwebtoken');
const { body } = require('express-validator');
const { pool } = require('../config/db');
const { handleValidationErrors } = require('../middleware/validationMiddleware');
const { protect } = require('../middleware/authMiddleware');
const { OAuth2Client } = require('google-auth-library'); // Google Auth Library import et
require('dotenv').config();

const router = express.Router();
const SALT_ROUNDS = 10;

// Google Client ID'nizi .env dosyasından alın
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
if (!GOOGLE_CLIENT_ID) {
    console.error("UYARI: GOOGLE_CLIENT_ID ortam değişkeni ayarlanmamış!");
}
const client = new OAuth2Client(GOOGLE_CLIENT_ID);


// --- Yardımcı Fonksiyon: JWT Oluşturma ---
const generateToken = (user) => { // Artık user objesini alıyor
    // Payload'a username ve email ekleyelim (opsiyonel)
    const payload = {
        userId: user.id,
        username: user.username,
        email: user.email // Gerekirse eklenebilir
    };
    return jwt.sign(payload, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRES_IN || '1d',
    });
};

// --- Kullanıcı Kayıt ---
router.post( '/register', [ /* ... validation ... */ ], handleValidationErrors, async (req, res, next) => {
    const { username, email, password } = req.body;
    let connection;
    try {
        connection = await pool.getConnection();
        const [existingUser] = await connection.query('SELECT id FROM users WHERE username = ? OR email = ?', [username, email]);
        if (existingUser.length > 0) { return res.status(400).json({ message: 'Bu e-posta veya kullanıcı adı zaten kullanılıyor.' }); }
        const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
        const [result] = await connection.query('INSERT INTO users (username, email, password) VALUES (?, ?, ?)', [username, email, hashedPassword]);
        const userId = result.insertId;
        if (userId) {
            // Yeni kullanıcı objesi oluştur
            const newUser = { id: userId, username: username, email: email };
            const token = generateToken(newUser); // Yeni kullanıcı objesi ile token oluştur
            res.status(201).json({ user: newUser, token: token }); // User objesini de dön
        } else { throw new Error('Kullanıcı kaydedilirken bir sorun oluştu.'); }
    } catch (error) { next(error); }
    finally { if (connection) connection.release(); }
});

// --- Kullanıcı Giriş ---
router.post( '/login', [ /* ... validation ... */ ], handleValidationErrors, async (req, res, next) => {
    const { email, password } = req.body;
    let connection;
    try {
        connection = await pool.getConnection();
        const [users] = await connection.query('SELECT id, username, email, password FROM users WHERE email = ?', [email]);
        if (users.length === 0) { return res.status(401).json({ message: 'Geçersiz e-posta veya şifre.' }); }
        const user = users[0];
        // Google ile kaydolmuş ve şifresi olmayan kullanıcılar için kontrol
        if (!user.password) {
             return res.status(401).json({ message: 'Bu hesap Google ile oluşturulmuş. Lütfen Google ile giriş yapın.' });
        }
        const isMatch = await bcrypt.compare(password, user.password);
        if (isMatch) {
            // Dönen user objesinden şifreyi çıkar
            const { password: _, ...userToSend } = user;
            const token = generateToken(userToSend); // User objesi ile token oluştur
            res.json({ user: userToSend, token: token }); // User objesini de dön
        } else { return res.status(401).json({ message: 'Geçersiz e-posta veya şifre.' }); }
    } catch (error) { next(error); }
    finally { if (connection) connection.release(); }
});

// --- YENİ GOOGLE GİRİŞ/KAYIT ENDPOINT'İ ---
router.post('/google', [
    body('idToken', 'Google ID Token gerekli.').trim().notEmpty().isString()
], handleValidationErrors, async (req, res, next) => { // loginWithGoogle yerine async fonksiyon doğrudan burada
    const { idToken } = req.body;
    let connection;

    try {
        console.log("[AUTH /google] Google Login/Register isteği alındı.");
        // 1. Google ID Token'ı Doğrula
        const ticket = await client.verifyIdToken({
            idToken: idToken,
            audience: GOOGLE_CLIENT_ID,
        });
        const payload = ticket.getPayload();
        const googleUserId = payload['sub'];
        const email = payload['email'];
        const name = payload['name']; // İsim bilgisi

        if (!email || !googleUserId) {
            console.error("[AUTH /google] Google token payload eksik.");
            return res.status(400).json({ message: 'Google\'dan geçerli kullanıcı bilgisi alınamadı.' });
        }
        console.log("[AUTH /google] Google Token doğrulandı. Payload:", {email, googleUserId, name});

        connection = await pool.getConnection();
        await connection.beginTransaction(); // Transaction başlat

        // 2. Kullanıcıyı bul veya oluştur
        let [users] = await connection.query('SELECT id, username, email, google_id FROM users WHERE google_id = ? LIMIT 1', [googleUserId]);
        let user = users[0];
        let isNewUser = false;
        let needsGoogleIdUpdate = false;

        if (!user) { // Google ID ile bulunamadıysa
            [users] = await connection.query('SELECT id, username, email, google_id FROM users WHERE email = ? LIMIT 1', [email]);
            user = users[0];

            if (!user) { // Email ile de bulunamadıysa: Yeni kullanıcı
                isNewUser = true;
                const username = name ? name.replace(/\s+/g, '').substring(0, 15) : email.split('@')[0];
                // Yeni kullanıcı için NULL password veya geçici hashlenmiş şifre
                const tempPassword = Math.random().toString(36).slice(-8);
                const salt = await bcrypt.genSalt(SALT_ROUNDS);
                const hashedPassword = await bcrypt.hash(tempPassword, salt); // Ya da NULL

                const [insertResult] = await connection.query(
                    'INSERT INTO users (username, email, password, google_id, created_at, updated_at) VALUES (?, ?, ?, ?, NOW(), NOW())',
                    [username, email, hashedPassword, googleUserId] // Hashlenmiş şifre veya NULL
                );
                if (!insertResult.insertId) { throw new Error('Yeni Google kullanıcısı oluşturulamadı.'); }
                // Yeni kullanıcı bilgilerini al (şifre hariç)
                 user = { id: insertResult.insertId, username, email, google_id: googleUserId };
                 console.log(`[AUTH /google] Yeni kullanıcı oluşturuldu: ID ${user.id}`);
            } else { // Email ile bulundu
                if (!user.google_id) { // Google ID yoksa ekle
                    needsGoogleIdUpdate = true;
                    await connection.query('UPDATE users SET google_id = ?, updated_at = NOW() WHERE id = ?', [googleUserId, user.id]);
                    user.google_id = googleUserId; // user objesini güncelle
                    console.log(`[AUTH /google] Mevcut kullanıcı (${user.id}) Google ID ile güncellendi.`);
                } else if (user.google_id !== googleUserId) { // Başka Google ID'ye bağlıysa hata ver
                     await connection.rollback(); // Transaction'ı geri al
                     console.error(`[AUTH /google] Güvenlik: Email (${email}) başka Google ID (${user.google_id}) ile eşleşmiş.`);
                     return res.status(403).json({ message: 'Bu e-posta adresi başka bir Google hesabıyla ilişkilendirilmiş.' });
                }
                 // Google ID zaten varsa bir şey yapma
            }
        }
        // Kullanıcı bulunduysa (Google ID ile veya Email ile güncellendiyse)
         console.log(`[AUTH /google] İşlem yapılacak kullanıcı: ID ${user.id}, Username: ${user.username}`);

        await connection.commit(); // Transaction'ı onayla

        // 3. JWT Token Oluştur
        const token = generateToken(user); // user objesi ile token oluştur
        console.log(`[AUTH /google] JWT Token oluşturuldu.`);

        // 4. Yanıtı Gönder (Şifre olmadan)
        const { password: _, ...userToSend } = user; // Şifreyi yanıttan çıkar

        res.status(200).json({
            message: isNewUser ? 'Google ile hesap oluşturuldu.' : (needsGoogleIdUpdate ? 'Google hesabı ilişkilendirildi.' : 'Giriş başarılı.'),
            token: token,
            user: userToSend // Şifresiz kullanıcı bilgisi
        });

    } catch (error) {
        if (connection) await connection.rollback(); // Hata durumunda geri al
        console.error("[AUTH /google] Google Login/Register Hatası:", error);
        if (error.message.includes('Invalid token signature') || error.message.includes('Token used too late') || error.message.includes('audience')) {
             return res.status(401).json({ message: 'Geçersiz Google kimlik bilgisi.' });
        }
        next(error);
    } finally {
        if (connection) connection.release();
    }
});


// --- Mevcut Kullanıcı Bilgisi ---
router.get('/me', protect, async (req, res, next) => {
    const userId = req.userId; // protect middleware'inden gelir
    let connection;
    try {
        connection = await pool.getConnection();
        // Şifre hariç bilgileri seç
        const [users] = await connection.query('SELECT id, username, email, google_id, created_at FROM users WHERE id = ?', [userId]);
        if (users.length > 0) {
             console.log(`[AUTH /me] Kullanıcı bilgisi bulundu: ID ${userId}`);
            res.json(users[0]);
        }
        else {
            console.warn(`[AUTH /me] Kullanıcı bulunamadı: ID ${userId}`);
            res.status(404).json({ message: 'Kullanıcı bulunamadı.' });
        }
    } catch (error) {
        console.error(`[AUTH /me] Kullanıcı bilgisi alınırken hata: ID ${userId}`, error);
        next(error);
    } finally {
        if (connection) connection.release();
    }
});

// --- Kullanıcı Çıkış ---
router.post('/logout', protect, (req, res, next) => {
    try {
        console.log(`User ${req.userId} logout isteği.`);
        // Sunucu taraflı bir işlem yapmıyoruz (şimdilik)
        res.status(200).json({ message: 'Çıkış başarılı.' });
    } catch (error) {
         next(error);
    }
});


module.exports = router;