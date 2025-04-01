// generate_audio.js
// require('dotenv').config(); // .env dosyasını KULLANMIYORUZ

const mysql = require('mysql2/promise');
const fs = require('fs').promises;
const path = require('path');
const { TextToSpeechClient } = require('@google-cloud/text-to-speech');

// --- Ayarlar (Doğrudan Kod İçinde) ---

// Veritabanı Bilgileri (KENDİ BİLGİLERİNİZLE DEĞİŞTİRİN!)
const DB_CONFIG = {
    host: 'localhost',      // Genellikle localhost
    user: 'root',           // MySQL Kullanıcı Adınız
    password: 'dfkl39A+', // MySQL Şifreniz
    database: 'dil'             // Veritabanı Adınız
};

// Google Cloud Ayarları
// Eğer Hizmet Hesabı kullanıyorsanız, anahtar dosyasının yolunu belirtin:
process.env.GOOGLE_APPLICATION_CREDENTIALS = "key.json";
// Eğer ADC (gcloud auth application-default login) kullandıysanız, bu satıra gerek yok.

// Seslendirme Ayarları
const AUDIO_OUTPUT_BASE_DIR = path.join(__dirname, 'public', 'audio', 'sr');
const TARGET_LANGUAGE_CODE = 'sr-RS'; // veya 'hr-HR'
const TTS_VOICE_NAME = 'sr-RS-Standard-A'; // veya 'hr-HR-Standard-A'
const AUDIO_ENCODING = 'MP3';

// Veritabanı Tablo/Sütun Adları
const DB_TABLE_NAME = 'cards';
const DB_COLUMN_ME = 'me';
const DB_COLUMN_LEVEL = 'level';
const DB_COLUMN_AUDIO = 'audio_filename';

// Test Limiti
const PROCESSING_LIMIT = 3000;
// --- /Ayarlar ---


// Google TTS İstemcisini Başlat
let ttsClient;
try {
    ttsClient = new TextToSpeechClient();
    console.log("Google Text-to-Speech istemcisi başarıyla başlatıldı.");
} catch (error) {
    console.error("HATA: Google Text-to-Speech istemcisi başlatılamadı!");
    console.error("Google Cloud kimlik doğrulaması (ADC veya GOOGLE_APPLICATION_CREDENTIALS) yapıldığından emin olun.");
    console.error("Orijinal Hata:", error);
    process.exit(1);
}

// Veritabanı Bağlantı Havuzu (Doğrudan DB_CONFIG ile)
let pool;
try {
    pool = mysql.createPool({
        ...DB_CONFIG, // Ayarları doğrudan kullan
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0
    });
    console.log("Veritabanı bağlantı havuzu oluşturuldu.");
} catch (error) {
     console.error("HATA: Veritabanı bağlantı havuzu oluşturulamadı!");
     console.error("Orijinal Hata:", error);
     process.exit(1);
}


// Metni URL/Dosya adı için güvenli hale getiren fonksiyon
function sanitizeFilename(text) {
    if (!text) return `unknown_${Date.now()}`;
    return text.toLowerCase().replace(/[ğüşıöç]/g, char => ({'ğ':'g','ü':'u','ş':'s','ı':'i','ö':'o','ç':'c'}[char])).replace(/\s+/g, '_').replace(/[^a-z0-9_.-]/g, '').substring(0, 100);
}

// Ana İşlem Fonksiyonu
async function generateAudioFiles() {
    let connection;
    try {
        connection = await pool.getConnection();
        console.log("Veritabanına bağlanıldı.");

        console.log("Seslendirilecek benzersiz metinler veritabanından alınıyor...");
        const [rowsToProcessRaw] = await connection.query(
            `SELECT DISTINCT ${DB_COLUMN_ME} as text, ${DB_COLUMN_LEVEL} as level
             FROM ${DB_TABLE_NAME}
             WHERE ${DB_COLUMN_ME} IS NOT NULL AND TRIM(${DB_COLUMN_ME}) != ''
               AND (${DB_COLUMN_AUDIO} IS NULL OR TRIM(${DB_COLUMN_AUDIO}) = '')
             ORDER BY level, text`
        );

        const rowsToProcess = rowsToProcessRaw.slice(0, PROCESSING_LIMIT);
        console.log(`Toplam ${rowsToProcessRaw.length} adet işlenmemiş metin bulundu.`);
        console.log(`Test için İLK ${rowsToProcess.length} tanesi işlenecek (Limit: ${PROCESSING_LIMIT}).`);

        if (rowsToProcess.length === 0) { console.log("Yeni ses dosyası oluşturulacak metin bulunamadı."); return; }

        await fs.mkdir(AUDIO_OUTPUT_BASE_DIR, { recursive: true });
        let successCount = 0;
        let errorCount = 0;

        for (let i = 0; i < rowsToProcess.length; i++) {
            const item = rowsToProcess[i];
            const textToSpeak = item.text;
            const level = item.level || 'unknown_level';
            console.log(`\n[${i + 1}/${rowsToProcess.length}] İşleniyor: "${textToSpeak}" (Seviye: ${level})`);

            const filenameBase = sanitizeFilename(textToSpeak);
            const filename = `${filenameBase}.${AUDIO_ENCODING.toLowerCase()}`;
            const levelDir = path.join(AUDIO_OUTPUT_BASE_DIR, level.toLowerCase());
            const outputPath = path.join(levelDir, filename);
            const audioPathForDb = `${level.toLowerCase()}/${filename}`;

            try {
                await fs.mkdir(levelDir, { recursive: true });
                console.log(` -> TTS API isteği gönderiliyor...`);
                const request = { input: { text: textToSpeak }, voice: { languageCode: TARGET_LANGUAGE_CODE, name: TTS_VOICE_NAME }, audioConfig: { audioEncoding: AUDIO_ENCODING }, };
                const [response] = await ttsClient.synthesizeSpeech(request);
                console.log(` -> Ses dosyası kaydediliyor: ${outputPath}`);
                await fs.writeFile(outputPath, response.audioContent, 'binary');
                console.log(` -> Başarılı: ${filename}`);
                console.log(` -> Veritabanı güncelleniyor (Metin: "${textToSpeak}", Seviye: ${level})...`);
                const [updateResult] = await connection.query( `UPDATE ${DB_TABLE_NAME} SET ${DB_COLUMN_AUDIO} = ? WHERE ${DB_COLUMN_ME} = ? AND ${DB_COLUMN_LEVEL} = ? AND (${DB_COLUMN_AUDIO} IS NULL OR TRIM(${DB_COLUMN_AUDIO}) = '')`, [audioPathForDb, textToSpeak, level] );
                console.log(` -> Veritabanı: ${updateResult.affectedRows} kayıt güncellendi.`);
                successCount++;
            } catch (error) {
                errorCount++;
                console.error(`HATA: "${textToSpeak}" için ses dosyası oluşturulamadı veya veritabanı güncellenemedi!`);
                console.error(" -> Orijinal Hata:", error.message || error);
            }
        } // Döngü sonu

        console.log("\n--- İşlem Tamamlandı ---");
        console.log(`Başarılı: ${successCount}`);
        console.log(`Hatalı: ${errorCount}`);
        if (rowsToProcessRaw.length > PROCESSING_LIMIT) {
             console.log(`NOT: İşlenecek ${rowsToProcessRaw.length - PROCESSING_LIMIT} metin daha var (Limit: ${PROCESSING_LIMIT}).`);
        }

    } catch (error) {
        console.error("\n!!! Script Çalıştırılırken Genel Hata Oluştu !!!");
        // Bağlantı hatası olup olmadığını kontrol et
        if (error.code === 'ER_ACCESS_DENIED_ERROR' || error.code === 'ECONNREFUSED') {
             console.error(" -> Veritabanı Bağlantı Hatası! DB_CONFIG içindeki bilgileri kontrol edin.");
        }
        console.error(error); // Hatanın tamamını yazdır
    } finally {
        if (connection) { await connection.release(); console.log("Veritabanı bağlantısı bırakıldı."); }
        if (pool) { await pool.end(); console.log("Veritabanı bağlantı havuzu kapatıldı."); }
    }
}

// Script'i çalıştır
generateAudioFiles();