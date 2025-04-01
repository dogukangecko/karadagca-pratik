// src/utils/api.js
import axios from 'axios';

// Backend API'nizin temel URL'si (SADECE sunucu ve port)
// .env dosyasından almak daha iyi olur: process.env.REACT_APP_BASE_API_URL
const BASE_API_URL = process.env.REACT_APP_BASE_API_URL || 'http://localhost:5001'; // Port backend'inizle eşleşmeli

const api = axios.create({
    baseURL: BASE_API_URL, // Sadece base URL, '/api' YOK
    headers: {
        'Content-Type': 'application/json',
    },
});

// İstek Interceptor (Token Ekleme - Değişiklik Yok)
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('authToken');
        if (token) {
            // URL'nin zaten /api ile başlamadığından emin ol (baseURL'den kaldırdık)
            // Her isteğin yolunun '/api/...' ile başladığını varsayıyoruz.
            config.headers['Authorization'] = `Bearer ${token}`;
        }
         // console.log('Axios Request:', config.method.toUpperCase(), config.url, config.headers); // Debug için istek logu
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Yanıt Interceptor (401 Yakalama - Değişiklik Yok)
api.interceptors.response.use(
    (response) => {
        return response;
    },
    (error) => {
        if (error.response && error.response.status === 401) {
            console.error("Yetkisiz erişim veya token süresi doldu (Interceptor). Çıkış yapılıyor.");
            localStorage.removeItem('authToken');
            localStorage.removeItem('user');
            // Basit yönlendirme, context kullanmak daha iyi olabilir
            if (window.location.pathname !== '/login') { // Zaten login sayfasındaysa tekrar yönlendirme
                 window.location.href = '/login';
            }
        }
        return Promise.reject(error);
    }
);

export default api;