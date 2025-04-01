# 🇲🇪 Karadağca Pratik AI

Node.js ve React tabanlı yapay zeka aracılığı ile içindeki tüm kartlar ve ses kayıtları oluşturuldu. Basit bir Karadağca - Türkçe dil kartları uygulaması örneğidir.

---

## 📁 Klasör Yapısı

```
karadagca-pratik/
├── backend/                # Node.js backend
│   ├── config/             # Veritabanı ve yapılandırma dosyaları
│   ├── middleware/         # JWT, hata yönetimi vb.
│   ├── records/            # generate_audio.js ile ses dosyalarını üretir
│   │                       # Kartlardaki metinleri Google Cloud Text-to-Speech ile MP3'e çevirir
│   │                       # Elde edilen ses dosyalarını kaydeder ve yolunu veritabanına yazar
│   ├── routes/             # API endpoint'leri
│   ├── scripts/            # Yükleme/güncelleme scriptleri
│   ├── server.js           # Uygulama başlangıç noktası
│   └── package.json        # "npm install" komutunda yüklenecek gereksinimler
│
├── frontend/               # React frontend
│   ├── public/
│   ├── src/
│   │   ├── components/  # İçinde kart , kategori , quiz ve istastiklerin yapısı yer almaktadır
│   │   ├── context/     # Oturum doğrulama 
│   │   │ 
│   │   │             
│   │   ├── pages/      # Giriş ve Kayıt sayfaları burada yer alıyor.
│   │   ├── utils/      # Burada da backend projenizin yolunu belirtiyorsunuz. Tüm api isteklerini buradaki belirlediğiniz adrese gönderiyor.
│   │   ├── App.js      # inceleyiniz 
│   │   └── index.js    # inceleyiniz
│   └── package.json    # "npm install" komutunda yüklenecek gereksinimler
```

---

## 🚀 Hızlı Kurulum

### 1. Repo'yu Klonla

```bash
git clone https://github.com/kullaniciadi/karadagca-pratik.git
cd karadagca-pratik
```

### 2. Ortam Değişkenlerini Ayarla

#### 📦 `backend/.env` 

> dosyasını oluştur içini kendi bilgilerinle düzenle

```env
PORT=5000
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=seninsifren
DB_NAME=karadagca_db
JWT_SECRET=supersecretkey
GOOGLE_APPLICATION_CREDENTIALS=./google-credentials.json
```

> `google-credentials.json` dosyasını Google Cloud Console üzerinden indirip `backend` klasörüne yerleştir.

---

## 🛠️ Kurulum Adımları

### 📡 Backend (Node.js)

```bash
cd backend
npm install
npm run dev
```

> Sunucu `http://localhost:5000` adresinde çalışmaya başlar.

### 🌐 Frontend (React)
public/manifest.json dosyasını kendi projenize göre düzenleyin , Progressive Web App olarak yüklendiğinde buradaki veriyi kullanır. Ayrıca Favicon değiştirmek isterseniz public klasöründe yer alıyor.
karadagca-pratik kök klasöründeyken asagıdaki komutlarla terminalde çalıştırabilirsiniz 
```bash
cd frontend
npm install
npm start
```

> React app varsayılan olarak `http://localhost:3000` adresinde çalışır.

bu geliştirici özellikleri açık şekilde çalıştıracaktır.

yazılımı paketlemek isterseniz frontend klasörü içinde terminaliniz açık iken "npm build" komutu ile derleyip ardından "npx serve -s build -l 3000" komutuyla sunucuyu başlatabilirsiniz. Gerçek kullanıma aktif etmek istiyorsanız geliştirici modunda bırakmamanız önerilir hem güvenlik açısından hem daha yavaş çalışacaktır.
---

## ⚙️ Özellikler

- Karadağca-Türkçe dil kartları
- Sesli quiz modu (doğru/yanlış geri bildirimli)
- Google TTS ile otomatik ses üretimi
- JWT ile kullanıcı oturumu
- Quiz sonuçlarını ve ilerleme kaydını görebilme
- Modern Bootstrap UI
---

## 🔉 Ses Üretimi (`generate_audio.js`)

- `backend/records/generate_audio.js` dosyası çalıştırıldığında:
  - Veritabanındaki kartlardaki metinleri Google Text-to-Speech API ile seslendirir.
  - MP3 dosyalarını `records/` içine kaydeder.
  - Dosya yollarını ilgili kart kayıtlarına yazar.
  - aynı klasör içine "key.json" dosyanızı google'dan aldığınız eklemeniz gerekmektedir.

```bash
node records/generate_audio.js
```

---

## 🧪 Geliştirme

Projenin bir admin paneli yok verileri görme, düzenleme ve silmek için istenirse yapılabilir. Localde çalışıyorsanız Dbeaver , yada herhangi bir mysql workbench gibi programlarla kontrol edebilirsiniz.
Konsept projesi olduğu için Şifre sıfırlama kısmı yapılmadı basit tutuldu. İşin içine smtp dahil edip mail gönderme yada gizli soru gibi eklemeler gerekecekti. 
3rd Party Login seçenekleri arttırılabilir suan sadece Google mevcut.
Quiz tipleri eklenip çeşitlilik katılabilir karmaşıklaşmaması adına eklenmedi.
Arkaplan Görseli yapay zeka ile oluşturuldu canlı sunucumdaki test sisteminde kullanılmadı localde sizde gözükecektir değiştirmek yada kaldırmak isterseniz src/pages/LoginPage.jsx içinde 47.satırda yer alıyor. 
---

## ❗️ Olası Hatalar

| Hata | Sebep | Çözüm |
|------|-------|-------|
| ECONNREFUSED | MySQL bağlantı sorunu | `DB_HOST`, `DB_USER`, `DB_PASSWORD` kontrol et |
| Unauthorized | JWT eksik/geçersiz | Giriş yapıldı mı? Token gönderiliyor mu? |
| Google TTS çalışmıyor | JSON credential eksik | `key.json` doğru yerde mi? |

---

## 🧠 Notlar

- `frontend/src/context/` klasörü global state yönetimi içerir (ör: auth context)
- `frontend/src/utils/` altında API işlemleri, yardımcı fonksiyonlar yer alır
- `react-bootstrap`, `react-toastify`, `react-router-dom`, `axios` gibi modern paketler kullanılmıştır
- db.sql dosyasında create table ve insert sorguları yer almaktadır projenizin çalışması için en azından create table sorgularını oluşturdugunuzdan emin olunuz. Insert sorgularını kullanmak istemezseniz aynı mantıkla kendiniz kartlar oluşturup insert edebilirsiniz 
---

## 📬 İletişim

Herhangi bir sorun ya da katkı için GitHub Issues kısmını kullanabilirsiniz.
Linkedin üzerinden de ulaşabilirsiniz. https://www.linkedin.com/in/dogukangecko