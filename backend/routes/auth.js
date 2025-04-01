// backend/routes/auth.js
const express = require('express');
const bcrypt = require('bcryptjs'); // bcryptjs veya bcrypt (hangisini kurduysanız)
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator'); // validationResult import edildi
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
     // LOG: Token oluşturma başlangıcı
    console.log(`[AUTH generateToken] Kullanıcı ID ${user.id} için JWT oluşturuluyor.`);
    return jwt.sign(payload, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRES_IN || '1d',
    });
};

// --- Kullanıcı Kayıt ---
router.post(
    '/register',
    [ // Validation kuralları eklendi
        body('username', 'Kullanıcı adı gerekli ve en az 3 karakter olmalı.').trim().isLength({ min: 3 }),
        body('email', 'Geçerli bir e-posta adresi girin.').trim().isEmail().normalizeEmail(),
        body('password', 'Şifre gerekli ve en az 6 karakter olmalı.').trim().isLength({ min: 6 }),
    ],
    handleValidationErrors, // Middleware burada çağrılıyor
    async (req, res, next) => {
        const { username, email, password } = req.body;
        let connection;
        console.log(`[AUTH /register] Kayıt isteği alındı: Username: ${username}, Email: ${email}`);
        try {
            connection = await pool.getConnection();
            console.log("[AUTH /register] Veritabanı bağlantısı alındı.");
            console.log(`[AUTH /register] Mevcut kullanıcı kontrol ediliyor: Username: ${username} OR Email: ${email}`);
            const [existingUser] = await connection.query('SELECT id FROM users WHERE username = ? OR email = ?', [username, email]);

            if (existingUser.length > 0) {
                console.warn(`[AUTH /register] Kullanıcı zaten mevcut: Username: ${username} OR Email: ${email}`);
                return res.status(400).json({ message: 'Bu e-posta veya kullanıcı adı zaten kullanılıyor.' });
            }
            console.log(`[AUTH /register] Yeni kullanıcı için şifre hashleniyor.`);
            const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
            console.log(`[AUTH /register] Şifre hashlendi. Kullanıcı veritabanına ekleniyor...`);
            const [result] = await connection.query('INSERT INTO users (username, email, password, created_at, updated_at) VALUES (?, ?, ?, NOW(), NOW())', [username, email, hashedPassword]);
            const userId = result.insertId;

            if (userId) {
                 console.log(`[AUTH /register] Kullanıcı başarıyla kaydedildi. ID: ${userId}`);
                // Yeni kullanıcı objesi oluştur
                const newUser = { id: userId, username: username, email: email };
                const token = generateToken(newUser); // Yeni kullanıcı objesi ile token oluştur
                console.log(`[AUTH /register] Kullanıcı ID ${userId} için token oluşturuldu.`);
                res.status(201).json({ user: newUser, token: token }); // User objesini de dön
                console.log(`[AUTH /register] Kayıt başarılı yanıtı gönderildi.`);
            } else {
                 console.error('[AUTH /register] HATA: Kullanıcı kaydedilemedi, insertId alınamadı.');
                throw new Error('Kullanıcı kaydedilirken bir sorun oluştu.');
            }
        } catch (error) {
            console.error('[AUTH /register] HATA:', error);
            next(error);
        }
        finally {
            if (connection) {
                console.log("[AUTH /register] Veritabanı bağlantısı bırakılıyor.");
                connection.release();
            }
        }
});

// --- Kullanıcı Giriş ---
router.post(
    '/login',
    [ // Validation kuralları eklendi
        body('email', 'Geçerli bir e-posta adresi girin.').trim().isEmail().normalizeEmail(),
        body('password', 'Şifre gerekli.').trim().notEmpty(),
    ],
    handleValidationErrors, // Middleware burada çağrılıyor
    async (req, res, next) => {
        const { email, password } = req.body;
        let connection;
        console.log(`[AUTH /login] Giriş isteği alındı: Email: ${email}`);
        try {
            connection = await pool.getConnection();
             console.log("[AUTH /login] Veritabanı bağlantısı alındı.");
            console.log(`[AUTH /login] Kullanıcı aranıyor: Email: ${email}`);
            const [users] = await connection.query('SELECT id, username, email, password, google_id FROM users WHERE email = ?', [email]);

            if (users.length === 0) {
                 console.warn(`[AUTH /login] Kullanıcı bulunamadı: Email: ${email}`);
                return res.status(401).json({ message: 'Geçersiz e-posta veya şifre.' });
            }

            const user = users[0];
            console.log(`[AUTH /login] Kullanıcı bulundu: ID ${user.id}`);

            // Google ile kaydolmuş ve şifresi olmayan kullanıcılar için kontrol
            // DÜZELTME: Google ile kaydolanların artık geçici hashlenmiş şifresi var,
            // ama yine de google_id varsa Google ile girişi teşvik edebiliriz.
            if (user.google_id && !user.password) { // Eğer google_id varsa VE ŞİFRE YOKSA (eski sistem)
                 console.warn(`[AUTH /login] Kullanıcı ID ${user.id} Google ile kayıtlı ve şifresi yok.`);
                 return res.status(401).json({ message: 'Bu hesap Google ile oluşturulmuş. Lütfen Google ile giriş yapın.' });
            }
             // Normal şifre kontrolü (artık Google kullanıcısının da hash'li şifresi var)
            if (!user.password) {
                 console.error(`[AUTH /login] HATA: Kullanıcı ID ${user.id} için veritabanında şifre bulunamadı (NULL).`);
                 // Bu durum normalde olmamalı (register veya google login şifre atamalı)
                 return res.status(500).json({ message: 'Hesap yapılandırma hatası.' });
            }

            console.log(`[AUTH /login] Şifre karşılaştırılıyor: Kullanıcı ID ${user.id}`);
            const isMatch = await bcrypt.compare(password, user.password);

            if (isMatch) {
                console.log(`[AUTH /login] Şifre eşleşti. Kullanıcı ID ${user.id}`);
                // Dönen user objesinden şifreyi çıkar
                const { password: _, ...userToSend } = user;
                const token = generateToken(userToSend); // User objesi ile token oluştur
                console.log(`[AUTH /login] Kullanıcı ID ${user.id} için token oluşturuldu.`);
                res.json({ user: userToSend, token: token }); // User objesini de dön
                 console.log(`[AUTH /login] Giriş başarılı yanıtı gönderildi.`);
            } else {
                 console.warn(`[AUTH /login] Şifre eşleşmedi. Kullanıcı ID ${user.id}`);
                return res.status(401).json({ message: 'Geçersiz e-posta veya şifre.' });
            }
        } catch (error) {
             console.error('[AUTH /login] HATA:', error);
            next(error);
        }
        finally {
            if (connection) {
                 console.log("[AUTH /login] Veritabanı bağlantısı bırakılıyor.");
                connection.release();
            }
        }
});

// --- YENİ GOOGLE GİRİŞ/KAYIT ENDPOINT'İ (DETAYLI LOGLAMA İLE) ---
router.post('/google', [
    body('idToken', 'Google ID Token gerekli.').trim().notEmpty().isString()
], handleValidationErrors, async (req, res, next) => {
    const { idToken } = req.body;
    let connection;

    // LOG: İstek başlangıcı
    console.log("[AUTH /google] Google Login/Register isteği alındı.");

    try {
        // LOG: Token doğrulama başlangıcı
        console.log("[AUTH /google] Google ID token doğrulanıyor...");
        const ticket = await client.verifyIdToken({
            idToken: idToken,
            audience: GOOGLE_CLIENT_ID,
        });
        const payload = ticket.getPayload();
        const googleUserId = payload['sub'];
        const email = payload['email'];
        const name = payload['name']; // *** Google'dan gelen tam isim ***

        // LOG: Token doğrulama sonucu
        if (!email || !googleUserId) {
            console.error("[AUTH /google] HATA: Google token payload eksik veya geçersiz.", payload);
            return res.status(400).json({ message: 'Google\'dan geçerli kullanıcı bilgisi alınamadı.' });
        }
        // *** Log'a name eklendi ***
        console.log("[AUTH /google] Google Token doğrulandı. Payload:", { email, googleUserId, name });

        // LOG: Veritabanı bağlantısı alma
        console.log("[AUTH /google] Veritabanı bağlantısı alınıyor...");
        connection = await pool.getConnection();
        console.log("[AUTH /google] Veritabanı bağlantısı alındı.");

        // LOG: Transaction başlatma
        console.log("[AUTH /google] Veritabanı transaction başlatılıyor.");
        await connection.beginTransaction();
        console.log("[AUTH /google] Transaction başlatıldı.");

        // 2. Kullanıcıyı bul veya oluştur
        // LOG: Google ID ile kullanıcı arama
        console.log(`[AUTH /google] Mevcut kullanıcı google_id (${googleUserId}) ile aranıyor...`);
        // *** SELECT sorgusuna full_name eklendi ***
        let [users] = await connection.query('SELECT id, username, full_name, email, google_id FROM users WHERE google_id = ? LIMIT 1', [googleUserId]);
        let user = users[0];
        let isNewUser = false;
        let needsGoogleIdUpdate = false;

        if (!user) { // Google ID ile bulunamadıysa
             // LOG: Google ID ile bulunamadı, e-posta ile arama
            console.log(`[AUTH /google] Kullanıcı google_id ile bulunamadı. Email (${email}) ile aranıyor...`);
             // *** SELECT sorgusuna full_name eklendi ***
            [users] = await connection.query('SELECT id, username, full_name, email, google_id FROM users WHERE email = ? LIMIT 1', [email]);
            user = users[0];

            if (!user) { // Email ile de bulunamadıysa: Yeni kullanıcı
                isNewUser = true;
                // LOG: Yeni kullanıcı oluşturma
                console.log(`[AUTH /google] Kullanıcı email ile de bulunamadı. Yeni kullanıcı oluşturulacak: Email: ${email}`);
                // *** Username oluştururken name kullanıldı (varsa), yoksa eski yöntem ***
                const generatedUsername = name ? name.replace(/\s+/g, '').toLowerCase().substring(0, 15) : email.split('@')[0];
                // *** Benzersizlik kontrolü için basit bir ek (daha robust hale getirilebilir)
                let baseUsername = generatedUsername;
                let finalUsername = baseUsername;
                let counter = 1;
                let existingUsername = [];
                do {
                    [existingUsername] = await connection.query('SELECT id FROM users WHERE username = ?', [finalUsername]);
                    if (existingUsername.length > 0) {
                        finalUsername = `${baseUsername}${counter}`;
                        counter++;
                    }
                } while (existingUsername.length > 0);

                console.log(`[AUTH /google] Yeni kullanıcı için username: ${finalUsername}`);
                const username = finalUsername; // Atama

                // Yeni kullanıcı için NULL password veya geçici hashlenmiş şifre
                const tempPassword = Math.random().toString(36).slice(-8);
                console.log(`[AUTH /google] Geçici şifre oluşturuldu (hashlenecek).`);
                const salt = await bcrypt.genSalt(SALT_ROUNDS);
                const hashedPassword = await bcrypt.hash(tempPassword, salt); // Ya da NULL
                console.log(`[AUTH /google] Şifre hashlendi.`);

                 // LOG: Yeni kullanıcı INSERT işlemi
                console.log(`[AUTH /google] Yeni kullanıcı veritabanına ekleniyor (INSERT)...`);
                 // *** INSERT sorgusuna full_name eklendi ve parametre olarak 'name' verildi ***
                const [insertResult] = await connection.query(
                    'INSERT INTO users (username, full_name, email, password, google_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, NOW(), NOW())',
                    [username, name, email, hashedPassword, googleUserId] // name eklendi
                );

                if (!insertResult || !insertResult.insertId) {
                    // LOG: INSERT hatası
                    console.error('[AUTH /google] HATA: Yeni Google kullanıcısı INSERT edilemedi.', insertResult);
                    throw new Error('Yeni Google kullanıcısı oluşturulamadı.');
                }
                // Yeni kullanıcı bilgilerini al (şifre hariç)
                 // *** user objesine full_name eklendi ***
                 user = { id: insertResult.insertId, username, full_name: name, email, google_id: googleUserId };
                 // LOG: Yeni kullanıcı başarıyla oluşturuldu
                 console.log(`[AUTH /google] Yeni kullanıcı başarıyla oluşturuldu: ID ${user.id}, FullName: ${user.full_name}`);

            } else { // Email ile bulundu
                // LOG: Kullanıcı e-posta ile bulundu
                 console.log(`[AUTH /google] Kullanıcı email (${email}) ile bulundu: ID ${user.id}`);
                if (!user.google_id) { // Google ID yoksa ekle
                    needsGoogleIdUpdate = true;
                    // LOG: Mevcut kullanıcının Google ID'si ve full_name'i (eğer boşsa) güncelleniyor
                    console.log(`[AUTH /google] Kullanıcının google_id'si boş. Yeni google_id (${googleUserId}) ve full_name ('${name}') ile güncelleniyor (UPDATE)...`);
                     // *** UPDATE sorgusuna full_name eklendi ***
                     // *** Sadece full_name NULL ise güncelleme yapalım (opsiyonel) ***
                     let updateQuery = 'UPDATE users SET google_id = ?, updated_at = NOW() WHERE id = ?';
                     let updateParams = [googleUserId, user.id];
                     if (name && !user.full_name) { // Eğer Google'dan isim geldiyse VE DB'deki isim boşsa
                         updateQuery = 'UPDATE users SET google_id = ?, full_name = ?, updated_at = NOW() WHERE id = ?';
                         updateParams = [googleUserId, name, user.id];
                         user.full_name = name; // user objesini de güncelle
                         console.log(`[AUTH /google] Kullanıcının boş olan full_name alanı da güncelleniyor.`);
                     } else if (name && user.full_name !== name) {
                         console.log(`[AUTH /google] Kullanıcının mevcut full_name ('${user.full_name}') Google'dan gelen ('${name}') ile farklı, ancak mevcut isim korunuyor.`);
                         // İsteğe bağlı olarak burada da güncelleme yapılabilir:
                         // updateQuery = 'UPDATE users SET google_id = ?, full_name = ?, updated_at = NOW() WHERE id = ?';
                         // updateParams = [googleUserId, name, user.id];
                         // user.full_name = name;
                     }

                    await connection.query(updateQuery, updateParams);
                    user.google_id = googleUserId; // user objesini güncelle (google_id her durumda güncellenir)
                    console.log(`[AUTH /google] Mevcut kullanıcı (${user.id}) Google ID ile başarıyla güncellendi/ilişkilendirildi.`);

                } else if (user.google_id !== googleUserId) { // Başka Google ID'ye bağlıysa hata ver
                     // LOG: Güvenlik uyarısı - E-posta farklı Google ID ile eşleşiyor
                     console.warn(`[AUTH /google] GÜVENLİK UYARISI: Email (${email}) veritabanındaki google_id (${user.google_id}) ile eşleşmiyor! Gelen google_id: ${googleUserId}. İşlem geri alınıyor.`);
                     await connection.rollback(); // Transaction'ı geri al
                     console.log("[AUTH /google] Transaction geri alındı (rollback).");
                     return res.status(403).json({ message: 'Bu e-posta adresi başka bir Google hesabıyla ilişkilendirilmiş.' });
                } else {
                     // LOG: Google ID zaten eşleşiyor
                     console.log(`[AUTH /google] Kullanıcının google_id (${user.google_id}) zaten mevcut ve eşleşiyor. Güncelleme gerekmiyor.`);
                     // *** Opsiyonel: Burada da full_name kontrolü/güncellemesi yapılabilir ***
                     if (name && !user.full_name) {
                         console.log(`[AUTH /google] Kullanıcı bulundu, Google ID eşleşiyor ama full_name boş. Güncelleniyor...`);
                         await connection.query('UPDATE users SET full_name = ?, updated_at = NOW() WHERE id = ?', [name, user.id]);
                         user.full_name = name; // user objesini güncelle
                         console.log(`[AUTH /google] Mevcut kullanıcının (${user.id}) boş olan full_name alanı güncellendi.`);
                     } else if (name && user.full_name !== name) {
                          console.log(`[AUTH /google] Kullanıcı bulundu, Google ID eşleşiyor. Mevcut full_name ('${user.full_name}') Google'dan gelen ('${name}') ile farklı, mevcut isim korunuyor.`);
                          // İsteğe bağlı olarak güncelleme:
                          // await connection.query('UPDATE users SET full_name = ?, updated_at = NOW() WHERE id = ?', [name, user.id]);
                          // user.full_name = name;
                     }
                }
            }
        } else {
             // LOG: Kullanıcı doğrudan Google ID ile bulundu
             console.log(`[AUTH /google] Kullanıcı doğrudan google_id (${googleUserId}) ile bulundu: ID ${user.id}`);
              // *** Opsiyonel: Burada da full_name kontrolü/güncellemesi yapılabilir ***
             if (name && !user.full_name) {
                 console.log(`[AUTH /google] Kullanıcı bulundu, Google ID eşleşiyor ama full_name boş. Güncelleniyor...`);
                 await connection.query('UPDATE users SET full_name = ?, updated_at = NOW() WHERE id = ?', [name, user.id]);
                 user.full_name = name; // user objesini güncelle
                 console.log(`[AUTH /google] Mevcut kullanıcının (${user.id}) boş olan full_name alanı güncellendi.`);
             } else if (name && user.full_name !== name) {
                 console.log(`[AUTH /google] Kullanıcı bulundu, Google ID eşleşiyor. Mevcut full_name ('${user.full_name}') Google'dan gelen ('${name}') ile farklı, mevcut isim korunuyor.`);
                 // İsteğe bağlı olarak güncelleme:
                 // await connection.query('UPDATE users SET full_name = ?, updated_at = NOW() WHERE id = ?', [name, user.id]);
                 // user.full_name = name;
             }
        }

        // Kullanıcı bulunduysa veya oluşturulduysa (artık full_name bilgisini de içermeli)
        console.log(`[AUTH /google] İşlem yapılacak kullanıcı belirlendi: ID ${user.id}, Username: ${user.username}, FullName: ${user.full_name}, Email: ${user.email}`);

        // LOG: Transaction commit ediliyor
        console.log("[AUTH /google] Değişiklikler commit ediliyor...");
        await connection.commit(); // Transaction'ı onayla
        console.log("[AUTH /google] Transaction başarıyla commit edildi.");

        // 3. JWT Token Oluştur
        // *** generateToken'a gönderilen user objesi artık full_name içeriyor olabilir,
        // ancak token payload'ına eklemedik (generateToken fonksiyonu değiştirilmedi) ***
        console.log(`[AUTH /google] Kullanıcı ID ${user.id} için JWT token oluşturuluyor...`);
        const token = generateToken(user); // user objesi ile token oluştur
        console.log(`[AUTH /google] JWT Token oluşturuldu.`);

        // 4. Yanıtı Gönder (Şifre olmadan)
        const { password: _, ...userToSend } = user; // Şifreyi yanıttan çıkar
        // *** userToSend objesi artık full_name bilgisini de içeriyor ***
        // LOG: Yanıt hazırlanıyor
        console.log("[AUTH /google] Başarılı yanıt hazırlanıyor...");

        res.status(200).json({
            message: isNewUser ? 'Google ile hesap oluşturuldu.' : (needsGoogleIdUpdate ? 'Google hesabı ilişkilendirildi.' : 'Giriş başarılı.'),
            token: token,
            user: userToSend // Şifresiz kullanıcı bilgisi (full_name dahil)
        });
        // LOG: Yanıt gönderildi
         console.log("[AUTH /google] Başarılı yanıt gönderildi.");

    } catch (error) {
        // LOG: Genel hata yakalandı
        console.error("[AUTH /google] HATA OLUŞTU:", error);
        if (connection) {
            // LOG: Hata nedeniyle transaction geri alınıyor
            console.log("[AUTH /google] Hata nedeniyle transaction geri alınıyor (rollback)...");
            await connection.rollback();
             console.log("[AUTH /google] Transaction geri alındı (rollback).");
        }
        // Google token doğrulama hatalarını ayrıca yakala
        if (error.message && (error.message.includes('Invalid token signature') || error.message.includes('Token used too late') || error.message.includes('audience'))) {
             console.error("[AUTH /google] HATA TÜRÜ: Geçersiz Google Kimlik Bilgisi.");
             return res.status(401).json({ message: 'Geçersiz Google kimlik bilgisi.' });
        }
        // Diğer hataları sonraki middleware'e ilet
        next(error);
    } finally {
        if (connection) {
            // LOG: Veritabanı bağlantısı bırakılıyor
            console.log("[AUTH /google] Veritabanı bağlantısı bırakılıyor (release)...");
            connection.release();
            console.log("[AUTH /google] Veritabanı bağlantısı bırakıldı.");
        }
         console.log("[AUTH /google] İstek işleme tamamlandı (finally bloğu).");
    }
});


// --- Mevcut Kullanıcı Bilgisi ---
router.get('/me', protect, async (req, res, next) => {
    const userId = req.userId; // protect middleware'inden gelir
    let connection;
     console.log(`[AUTH /me] Mevcut kullanıcı bilgisi isteği alındı: User ID ${userId}`);
    try {
        connection = await pool.getConnection();
         console.log(`[AUTH /me] Veritabanı bağlantısı alındı. Kullanıcı ID ${userId} aranıyor.`);
        // Şifre hariç bilgileri seç
        const [users] = await connection.query('SELECT id, username, email, google_id, created_at FROM users WHERE id = ?', [userId]);
        if (users.length > 0) {
             console.log(`[AUTH /me] Kullanıcı bilgisi bulundu: ID ${userId}`);
            res.json(users[0]);
             console.log(`[AUTH /me] Kullanıcı bilgisi gönderildi: ID ${userId}`);
        }
        else {
            console.warn(`[AUTH /me] Kullanıcı bulunamadı: ID ${userId}`);
            res.status(404).json({ message: 'Kullanıcı bulunamadı.' });
        }
    } catch (error) {
        console.error(`[AUTH /me] Kullanıcı bilgisi alınırken HATA: ID ${userId}`, error);
        next(error);
    } finally {
        if (connection) {
             console.log(`[AUTH /me] Veritabanı bağlantısı bırakılıyor: ID ${userId}`);
            connection.release();
        }
    }
});

// --- Kullanıcı Çıkış ---
// NOT: Standart JWT tabanlı çıkış genellikle client-side token silme ile yapılır.
// Server-side blacklist/revokation daha karmaşık bir yapıdır ve burada eklenmemiştir.
router.post('/logout', protect, (req, res, next) => {
    try {
        // protect middleware zaten token'ı doğrulamış oluyor.
        const userId = req.userId;
        console.log(`[AUTH /logout] Kullanıcı çıkış isteği: User ID ${userId}`);
        // Sunucu tarafında yapılacak ek bir işlem yok (şimdilik).
        // İstemci tarafı token'ı silmeli.
        res.status(200).json({ message: 'Çıkış başarılı.' });
         console.log(`[AUTH /logout] Çıkış başarılı yanıtı gönderildi: User ID ${userId}`);
    } catch (error) {
         console.error(`[AUTH /logout] Çıkış sırasında HATA: User ID ${req.userId}`, error);
         next(error);
    }
});


module.exports = router;