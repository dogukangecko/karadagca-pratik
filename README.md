# 🇲🇪 Karadağca Pratik AI

Node.js ve React tabanlı, yapay zeka destekli Karadağca - Türkçe dil kartları uygulamasıdır. Tüm kartlar ve ses kayıtları otomatik olarak oluşturulmuştur. Basit ama geliştirilebilir bir dil öğrenme platformudur.

---

## 📁 Klasör Yapısı

```
karadagca-pratik/
├── backend/                # Node.js backend
│   ├── config/             # Veritabanı ve yapılandırma dosyaları
│   ├── middleware/         # JWT, hata yönetimi vb.
│   ├── records/            # Google TTS ile ses üretimi (generate_audio.js)
│   ├── routes/             # API endpoint'leri
│   ├── scripts/            # Yardımcı scriptler
│   ├── server.js           # Uygulama başlangıç noktası
│   └── package.json        # Bağımlılıklar
│
├── frontend/               # React frontend
│   ├── public/
│   ├── src/
│   │   ├── components/     # Kart, kategori, quiz ve istatistik bileşenleri
│   │   ├── context/        # Oturum yönetimi (auth context)
│   │   ├── pages/          # Giriş ve kayıt sayfaları
│   │   ├── utils/          # API adresleri ve yardımcı fonksiyonlar
│   │   ├── App.js
│   │   └── index.js
│   └── package.json
```

---

## 🚀 Hızlı Kurulum

### 1. Repo'yu Klonla

```bash
git clone https://github.com/kullaniciadi/karadagca-pratik.git
cd karadagca-pratik
```

### 2. Ortam Değişkenlerini Ayarla

#### 📦 `backend/.env` dosyası (örnek içerik):

```env
PORT=5000
DB_HOST=localhost
DB_USER=veritabani_kullanici
DB_PASSWORD=veritabani_sifre
DB_NAME=veritabani_adi
JWT_SECRET=sizin_jwt_secretiniz
GOOGLE_CLIENT_ID=google_oauth_id
LOG_LEVEL=debug
```

> Google Cloud üzerinden `google-credentials.json` dosyasını indirip `backend/records/key.json` olarak yerleştirin.

---

## 🛠️ Kurulum Adımları

### 📡 Backend (Node.js)

```bash
cd backend
npm install
npm run dev
```

> Sunucu `http://localhost:5000` adresinde çalışır.

### 🌐 Frontend (React)

```bash
cd ../frontend
npm install
npm start
```

> Varsayılan olarak React `http://localhost:3000` adresinde çalışır.

#### Ek Bilgi:
- `public/manifest.json`: Progressive Web App ayarları.
- `public/favicon.ico`: Simge değiştirme dosyası.
- Prod ortama almak için:

```bash
npm run build
npx serve -s build -l 3000
```

---

## ⚙️ Uygulama Özellikleri

- Karadağca-Türkçe kartlar
- Sesli quiz sistemi (doğru/yanlış geri bildirimli)
- Google TTS ile ses üretimi
- JWT tabanlı kullanıcı oturumu
- Bootstrap UI
- Quiz sonuç takibi ve istatistikler
- PWA desteği

---

## 🔉 Ses Üretimi – `generate_audio.js`

```bash
cd backend
node records/generate_audio.js
```

- Veritabanındaki tüm kartlar için Google TTS ile MP3 oluşturur.
- `records/` klasörüne kaydeder ve kart verisine dosya yolunu yazar.
- `key.json` dosyanız aynı klasörde olmalıdır.

---

## 🧪 Geliştirme Notları

- Admin paneli bulunmamaktadır. Veritabanı işlemleri için DBeaver, MySQL Workbench vb. kullanılabilir.
- Şifre sıfırlama özelliği yoktur. Basitlik amaçlanmıştır.
- Giriş sadece Google ile yapılabilmektedir. Diğer 3rd party login seçenekleri eklenebilir.
- Arkaplan görseli yapay zeka ile üretilmiştir. Kaldırmak veya değiştirmek için:
  - `src/pages/LoginPage.jsx` → 47. satır

---

## ❗️ Olası Hatalar ve Çözümler

| Hata | Açıklama | Çözüm |
|------|----------|--------|
| `ECONNREFUSED` | MySQL bağlantısı kurulamadı | `.env` içindeki veritabanı bilgilerini kontrol et |
| `Unauthorized` | JWT geçersiz veya eksik | Giriş yapıldı mı? Token düzgün gönderiliyor mu? |
| Google TTS çalışmıyor | Credential eksik | `key.json` dosyası doğru yerde mi? |
| Google Login çalışmıyor | Client ID eksik | Google Console’dan yeni OAuth 2.0 client ID oluşturun |

---

## 📌 Notlar

- `frontend/src/context/` → Global oturum yönetimi
- `frontend/src/utils/` → API adresleri ve servisler
- `db.sql` içinde tablo oluşturma (`CREATE TABLE`) ve örnek veri (`INSERT`) sorguları yer alır. Çalışma için en azından tablo yapılarının eklenmiş olması gerekir.

---


---

## 🌐 Yayında

Proje şu anda aşağıdaki adreste aktif olarak yayınlanmaktadır:

🔗 [https://ucim.prvi.me/](https://ucim.prvi.me/)

Uygulama demo amaçlı olarak ücretsiz kullanılabilir. Kartlar, sesli quiz özelliği ve Google ile giriş sistemi test edilebilir durumdadır.


## 📬 İletişim

> Yardım veya katkı için GitHub Issues kısmını kullanabilir ya da bana LinkedIn üzerinden ulaşabilirsiniz.

👤 [linkedin.com/in/dogukangecko](https://www.linkedin.com/in/dogukangecko)
