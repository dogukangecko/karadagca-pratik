// backend/routes/progress.js
const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { pool } = require('../config/db');
const { protect } = require('../middleware/authMiddleware');
const { handleValidationErrors } = require('../middleware/validationMiddleware');

router.use(protect); // Tüm route'ları koru

// --- Mevcut Route'lar ---
router.get('/difficult', async (req, res, next) => { /* ... önceki gibi ... */
    const userId = req.userId;
    let connection;
    try {
        connection = await pool.getConnection();
        const [rows] = await connection.query('SELECT card_id FROM user_difficult_cards WHERE user_id = ?', [userId]);
        res.json(rows.map(row => row.card_id));
    } catch (error) { next(error); } finally { if (connection) connection.release(); }
});
router.get('/learned', async (req, res, next) => { /* ... önceki gibi ... */
    const userId = req.userId;
    let connection;
    try {
        connection = await pool.getConnection();
        const [rows] = await connection.query('SELECT card_id FROM user_progress WHERE user_id = ?', [userId]);
        res.json(rows.map(row => row.card_id));
    } catch (error) { next(error); } finally { if (connection) connection.release(); }
});
router.post('/toggle', [ /* ... */ ], handleValidationErrors, async (req, res, next) => { /* ... önceki gibi ... */
    const userId = req.userId;
    const { cardId, learned } = req.body;
    let connection;
    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();
        if (learned) {
            await connection.query('INSERT IGNORE INTO user_progress (user_id, card_id) VALUES (?, ?)', [userId, cardId]);
        } else {
            await connection.query('DELETE FROM user_progress WHERE user_id = ? AND card_id = ?', [userId, cardId]);
        }
        await connection.commit();
        res.status(200).json({ message: 'İlerleme başarıyla güncellendi.' });
    } catch (error) { if (connection) await connection.rollback(); next(error); } finally { if (connection) connection.release(); }
});
router.delete('/all', async (req, res, next) => { /* ... önceki gibi ... */
    const userId = req.userId;
    let connection;
    try {
        connection = await pool.getConnection();
        const [result] = await connection.query('DELETE FROM user_progress WHERE user_id = ?', [userId]);
        console.log(`User ${userId} reset progress: ${result.affectedRows} rows deleted.`);
        res.status(200).json({ message: `${result.affectedRows} kartın öğrenilme durumu başarıyla sıfırlandı.` });
    } catch (error) { next(error); } finally { if (connection) connection.release(); }
});
router.post('/difficult/toggle', [ /* ... */ ], handleValidationErrors, async (req, res, next) => { /* ... önceki gibi ... */
    const userId = req.userId;
    const { cardId, difficult } = req.body;
    let connection;
    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();
        if (difficult) {
            await connection.query('INSERT IGNORE INTO user_difficult_cards (user_id, card_id) VALUES (?, ?)', [userId, cardId]);
        } else {
            await connection.query('DELETE FROM user_difficult_cards WHERE user_id = ? AND card_id = ?', [userId, cardId]);
        }
        await connection.commit();
        res.status(200).json({ message: 'Zorluk durumu başarıyla güncellendi.' });
    } catch (error) { if (connection) await connection.rollback(); next(error); } finally { if (connection) connection.release(); }
});
router.delete('/difficult/all', async (req, res, next) => { /* ... önceki gibi ... */
    const userId = req.userId;
    let connection;
    try {
        connection = await pool.getConnection();
        const [result] = await connection.query('DELETE FROM user_difficult_cards WHERE user_id = ?', [userId]);
        console.log(`User ${userId} reset difficult cards: ${result.affectedRows} rows deleted.`);
        res.status(200).json({ message: `${result.affectedRows} zor kart işareti başarıyla sıfırlandı.` });
    } catch (error) { next(error); } finally { if (connection) connection.release(); }
});

router.post(
    '/unlearn-many', // <-- Endpoint adı
    [
        // Gelen 'cardIds' dizisini doğrula
        body('cardIds', 'Kart ID dizisi gerekli ve bir dizi olmalı.')
            .isArray({ min: 1 }) // Boş olmayan bir dizi olmalı
            .withMessage('En az bir kart IDsi gönderilmelidir.'),
        // Dizideki her bir ID'nin string ve geçerli uzunlukta olduğunu kontrol et
        body('cardIds.*', 'Dizideki her kart IDsi geçerli bir string olmalı.')
            .if(body('cardIds').isArray()) // Sadece dizi ise kontrol et
            .trim()
            .notEmpty()
            .isString()
            .isLength({ min: 5, max: 255 }) // Kart ID uzunluğuna göre ayarla
    ],
    handleValidationErrors,
    async (req, res, next) => {
        const userId = req.userId;
        const { cardIds } = req.body; // Frontend'den gelen ID dizisi

        // Doğrulamadan geçse bile cardIds'in gerçekten bir dizi olduğundan emin olalım
        if (!Array.isArray(cardIds) || cardIds.length === 0) {
            // Bu durum normalde validasyon tarafından yakalanmalı
            return res.status(400).json({ message: 'Geçersiz veya boş kart ID dizisi.' });
        }

        let connection;
        console.log(`[API /unlearn-many] User: ${userId} resetliyor: ${cardIds.length} kart`); // Loglama

        try {
            connection = await pool.getConnection();
            await connection.beginTransaction();

            // SQL'de IN (?) ifadesini kullanmak için bir placeholder dizisi oluştur
            // Örn: DELETE FROM user_progress WHERE user_id = ? AND card_id IN (?, ?, ?)
            const placeholders = cardIds.map(() => '?').join(','); // "?,?,?" string'ini oluşturur

            // DELETE sorgusunu çalıştır
            const [result] = await connection.query(
                `DELETE FROM user_progress WHERE user_id = ? AND card_id IN (${placeholders})`,
                [userId, ...cardIds] // Önce userId, sonra cardIds dizisinin elemanları
            );

            await connection.commit();

            console.log(`[API /unlearn-many] User: ${userId}, Silinen Kayıt: ${result.affectedRows}`);
            res.status(200).json({ message: `${result.affectedRows} kartın öğrenilme durumu başarıyla sıfırlandı.` });

        } catch (error) {
            if (connection) await connection.rollback();
            console.error(`Kart sıfırlama API hatası (User: ${userId}):`, error);
            next(error); // Genel hata yöneticisine gönder
        } finally {
            if (connection) connection.release();
        }
    }
);

// ========================================================
// === YENİ ENDPOINT: Kategori Tamamlama Durumunu İşle ===
// ========================================================
router.post(
    '/category/complete',
    [
        // Frontend'den categoryId veya categoryTitle/level gibi bir tanımlayıcı gelmeli
        // Biz burada categoryId'nin geldiğini varsayalım (frontend'deki category.id)
        body('categoryId', 'Kategori ID gerekli ve geçerli bir string olmalı.').trim().notEmpty().isString().isLength({ min: 5, max: 255 }),
        // Opsiyonel olarak categoryTitle ve level da doğrulanabilir
        body('categoryTitle', 'Kategori başlığı opsiyoneldir.').optional().trim().isString().isLength({ max: 255 }),
        body('level', 'Seviye opsiyoneldir.').optional().trim().isString().isLength({ max: 10 }),
    ],
    handleValidationErrors,
    async (req, res, next) => {
        const userId = req.userId;
        const { categoryId, categoryTitle, level } = req.body; // Frontend'den gelenler
        let connection;
        console.log(`[API /category/complete] User: ${userId}, CategoryId: ${categoryId}, Title: ${categoryTitle}, Level: ${level}`); // Loglama

        // Veritabanı Tablosu Adı (varsayım, kendi tablonuza göre değiştirin)
        const tableName = 'user_category_progress';

        try {
            connection = await pool.getConnection();
            await connection.beginTransaction();

            // 1. Bu kullanıcı ve kategori için mevcut bir kayıt var mı kontrol et
            const [existingRows] = await connection.query(
                `SELECT completed_at FROM ${tableName} WHERE user_id = ? AND category_id = ? LIMIT 1`,
                [userId, categoryId]
            );

            let newlyCompleted = false;

            // 2. Eğer kayıt yoksa VEYA completed_at NULL ise, bu yeni bir tamamlamadır
            if (existingRows.length === 0 || existingRows[0].completed_at === null) {
                console.log(`[API /category/complete] Yeni tamamlama: User: ${userId}, Category: ${categoryId}`);
                newlyCompleted = true;

                // Kayıt yoksa ekle, varsa completed_at'i güncelle (UPSERT mantığı)
                // completed_at'i SADECE ilk tamamlanmada ayarlamak için:
                // INSERT ... ON DUPLICATE KEY UPDATE completed_at = IF(completed_at IS NULL, NOW(), completed_at)
                // Veya daha basiti: Kayıt yoksa INSERT et, varsa ve completed_at null ise UPDATE et.

                // Basit UPSERT (varsa completed_at'i günceller, yoksa ekler):
                await connection.query(
                    `INSERT INTO ${tableName} (user_id, category_id, category_title, level, completed_at)
                     VALUES (?, ?, ?, ?, NOW())
                     ON DUPLICATE KEY UPDATE
                       category_title = VALUES(category_title),
                       level = VALUES(level),
                       -- completed_at'i sadece ilk seferde güncellemek için koşul ekle:
                       completed_at = IF(completed_at IS NULL, VALUES(completed_at), completed_at)`,
                    [userId, categoryId, categoryTitle || null, level || null]
                );
            } else {
                console.log(`[API /category/complete] Daha önce tamamlanmış: User: ${userId}, Category: ${categoryId}`);
                newlyCompleted = false; // Zaten tamamlanmış
            }

            await connection.commit();

            // Frontend'e bu tamamlamanın yeni olup olmadığını bildir
            res.status(200).json({ newlyCompleted: newlyCompleted });

        } catch (error) {
            if (connection) await connection.rollback();
            console.error(`Kategori tamamlama API hatası (User: ${userId}, Category: ${categoryId}):`, error);
            // Hata durumunda frontend'e bilgi ver (örneğin 500)
            // next(error) kullanmak merkezi hata yöneticisini tetikler
            next(error);
        } finally {
            if (connection) connection.release();
        }
    }
);


module.exports = router;