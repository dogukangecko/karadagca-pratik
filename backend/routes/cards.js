// backend/routes/cards.js
const express = require('express');
const router = express.Router();
const { param } = require('express-validator');
const { pool } = require('../config/db');
const { handleValidationErrors } = require('../middleware/validationMiddleware');

// Veritabanı sütun ve tablo adlarını ortam değişkenlerinden veya varsayılanlardan al
const DB_TABLE_NAME = process.env.DB_TABLE_NAME || 'cards';
const DB_COLUMN_AUDIO = process.env.DB_COLUMN_AUDIO || 'audio_filename';
  
// --- Mevcut Tüm Seviyeleri Getir ---
router.get('/levels', async (req, res, next) => {
    let connection;
    try {
        connection = await pool.getConnection();
        const [rows] = await connection.query(
            `SELECT DISTINCT level FROM ${DB_TABLE_NAME} WHERE level IS NOT NULL AND level != "" ORDER BY FIELD(level, "A1", "A2", "B1", "B2", "C1", "C2"), level ASC`
        );
        res.json(rows.map(row => row.level));
    } catch (error) { next(error); }
    finally { if (connection) connection.release(); }
});


// --- Belirli Bir Seviyedeki TÜM Kartları Getir (audioUrl ile) ---
router.get(
    '/:level',
    [
        param('level', 'Geçersiz seviye parametresi.').trim().notEmpty().isLength({ min: 2, max: 10 }).escape(),
    ],
    handleValidationErrors,
    async (req, res, next) => {
        const { level } = req.params;
        let connection;
        try {
            connection = await pool.getConnection();
            // *** audio_filename SÜTUNUNU EKLE ***
            const [rows] = await connection.query(
                `SELECT id AS dbId, cardId AS id, level, category, tr, me, okunus,
                        ${DB_COLUMN_AUDIO} as audioFilename
                 FROM ${DB_TABLE_NAME}
                 WHERE level = ? ORDER BY category, id`,
                [level]
            );
         res.json(rows);

        } catch (error) {
            console.error(`Seviye kartları alınırken hata (${level}):`, error);
            next(error);
        } finally {
            if (connection) connection.release();
        }
    }
);

// --- Belirli Bir Seviye ve Kategorideki Kartları Getir (audioUrl ile) ---
router.get(
    '/:level/:category',
    [
        param('level', 'Geçersiz seviye parametresi.').trim().notEmpty().isLength({ min: 2, max: 10 }).escape(),
        param('category', 'Geçersiz kategori parametresi.').trim().notEmpty().isLength({ min: 1, max: 255 }),
    ],
    handleValidationErrors,
    async (req, res, next) => {
        const { level } = req.params;
        let category;
        try { category = decodeURIComponent(req.params.category).replace(/</g, "<").replace(/>/g, ">"); }
        catch (e) { return res.status(400).json({ message: 'Kategori parametresi çözümlenemedi.' }); }

        let connection;
        try {
            connection = await pool.getConnection();
             // *** audio_filename SÜTUNUNU EKLE ***
            const [rows] = await connection.query(
                `SELECT id AS dbId, cardId AS id, level, category, tr, me, okunus,
                        ${DB_COLUMN_AUDIO} as audioFilename
                 FROM ${DB_TABLE_NAME}
                 WHERE level = ? AND category = ? ORDER BY id`,
                [level, category]
            );
            res.json(rows);

        } catch (error) {
            console.error(`Kategori kartları alınırken hata (${level}/${category}):`, error);
            next(error);
        } finally {
            if (connection) connection.release();
        }
    }
);

module.exports = router;