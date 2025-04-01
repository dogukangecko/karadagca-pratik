// backend/routes/quizResults.js
const express = require('express');
const router = express.Router();
console.log("--- quizResults.js dosyası yüklendi ---"); // Dosya yüklenme logu
const { body } = require('express-validator');
const { pool } = require('../config/db');
const { protect } = require('../middleware/authMiddleware');
const { handleValidationErrors } = require('../middleware/validationMiddleware');

router.use(protect); // Tüm route'ları koru
 
router.post(
    '/save',
    [ /* ... validation ... */ ],
    handleValidationErrors,
    async (req, res, next) => { /* ... kaydetme logic ... */
        const userId = req.userId;
        const { quizId, categoryTitle, level, correct, incorrect, total } = req.body;
        if (correct + incorrect > total) { return res.status(400).json({ message: 'Doğru ve yanlış sayısı toplamdan fazla olamaz.' }); }
        let connection;
        try {
            connection = await pool.getConnection();
            const [result] = await connection.query( `INSERT INTO quiz_results (user_id, quiz_id, category_title, level, correct_count, incorrect_count, total_questions, completed_at) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`, [userId, quizId, categoryTitle, level, correct, incorrect, total] );
            if (result.insertId) { console.log(`[API POST /quiz/results/save] User ${userId} saved quiz result for ${quizId}. Insert ID: ${result.insertId}`); res.status(201).json({ message: 'Quiz sonucu başarıyla kaydedildi.', resultId: result.insertId }); }
            else { throw new Error('Quiz sonucu veritabanına eklenemedi.'); }
        } catch (error) { console.error(`Quiz sonucu kaydetme API hatası (User: ${userId}, Quiz: ${quizId}):`, error); next(error); }
        finally { if (connection) connection.release(); }
    }
);

// === Kullanıcının Tüm Quiz Sonuçlarını Getir ===
// GET /api/quiz/results/all
router.get(
    '/all', // Bu doğru ve eksiksiz olan blok kalacak
    async (req, res, next) => {
        console.log(`[API GET /quiz/results/all] İstek alındı. User ID: ${req.userId}`); // Log eklendi
        const userId = req.userId;
        let connection;
        try {
            connection = await pool.getConnection();
            const [rows] = await connection.query( `SELECT id, quiz_id, category_title, level, correct_count, incorrect_count, total_questions, completed_at FROM quiz_results WHERE user_id = ? ORDER BY completed_at DESC`, [userId] );
            const resultsWithAccuracy = rows.map(row => ({ ...row, accuracy: row.total_questions > 0 ? Math.round((row.correct_count / row.total_questions) * 100) : 0 }));
            console.log(`[API GET /quiz/results/all] User ${userId} fetched ${resultsWithAccuracy.length} results.`);
            res.status(200).json(resultsWithAccuracy);
        } catch (error) {
            console.error(`Quiz sonuçları getirme API hatası (User: ${userId}):`, error);
            next(error);
        } finally {
            if (connection) connection.release();
        }
    }
);

// === Kullanıcının Tüm Quiz Sonuçlarını Sil ===
// DELETE /api/quiz/results/all
router.delete(
    '/all',
    async (req, res, next) => { /* ... silme logic ... */
        const userId = req.userId;
        let connection;
        try {
            connection = await pool.getConnection();
            const [result] = await connection.query('DELETE FROM quiz_results WHERE user_id = ?', [userId]);
            console.log(`[API DELETE /quiz/results/all] User ${userId} deleted ${result.affectedRows} quiz results.`);
            res.status(200).json({ message: `${result.affectedRows} quiz sonucu başarıyla silindi.` });
        } catch (error) {
            console.error(`Quiz sonuçları silme API hatası (User: ${userId}):`, error);
            next(error);
        } finally {
            if (connection) connection.release();
        }
    }
);

module.exports = router;