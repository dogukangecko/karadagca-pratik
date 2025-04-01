// src/context/AuthContext.js
import React, { createContext, useState, useContext, useEffect, useCallback, useMemo } from 'react'; // useMemo import edildi
import api from '../utils/api'; // API instance'ını import et
import { toast } from 'react-toastify';
// JWT decode sadece debug veya hızlı bilgi için, backend'e güvenmek daha iyi
// import { jwtDecode } from "jwt-decode";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null); // User bilgisini sadece state'te tut
    const [token, setToken] = useState(() => localStorage.getItem('authToken') || null); // Token'ı localStorage'dan al
    const [loading, setLoading] = useState(true); // Başlangıçta kimlik kontrolü yapılıyor

    // Token değiştiğinde API header'ını ayarla ve localStorage'ı güncelle
    useEffect(() => {
        if (token) {
             api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
            localStorage.setItem('authToken', token);
        } else {
             delete api.defaults.headers.common['Authorization'];
            localStorage.removeItem('authToken');
            setUser(null); // Token yoksa user da olamaz
        }
    }, [token]);

    // Kullanıcıyı token ile backend'den çekme fonksiyonu
    const fetchCurrentUser = useCallback(async (currentToken) => {
         if (!currentToken) {
              setUser(null); // Token yoksa kullanıcıyı null yap
             return null; // Kullanıcı döndürme
        }
        try {
            // Token zaten header'da olmalı (yukarıdaki useEffect sayesinde)
            const response = await api.get('/api/auth/me'); // Backend'den kullanıcı bilgisini al
             setUser(response.data); // User state'ini güncelle
            return response.data; // Kullanıcı bilgisini döndür
        } catch (error) {
            console.error("Kullanıcı bilgisi alınamadı (fetchCurrentUser):", error.response?.data?.message || error.message);
            // Token geçersizse veya backend hatası varsa token'ı ve user'ı temizle
            setToken(null); // Bu, yukarıdaki useEffect'i tetikleyip localStorage'ı temizler
            setUser(null);
            // toast.error("Oturumunuz sonlandırıldı, lütfen tekrar giriş yapın."); // Kullanıcıya bilgi vermek yerine yönlendirme yapılabilir
            return null; // Hata durumunda null döndür
        }
    }, []); // Bağımlılık yok

    // Uygulama ilk yüklendiğinde token varsa kullanıcıyı çek
    useEffect(() => {
        const initialToken = localStorage.getItem('authToken');
         if (initialToken) {
            // Header'ı ilk yüklemede de ayarla
            api.defaults.headers.common['Authorization'] = `Bearer ${initialToken}`;
            fetchCurrentUser(initialToken).finally(() => {
                 setLoading(false); // Kullanıcı çekme bitince yüklemeyi bitir
            });
        } else {
             setLoading(false); // Token yoksa yükleme hemen biter
        }
    }, [fetchCurrentUser]); // Sadece fetchCurrentUser'a bağlı

    // Login fonksiyonu (useCallback ile sarıldı)
    const login = useCallback(async (email, password) => {
        try {
            const response = await api.post('/api/auth/login', { email, password });
            if (response.data?.token && response.data?.user) {
                 setUser(response.data.user);
                setToken(response.data.token);
                toast.success("Giriş başarılı!");
                return true;
            }
             console.error("[AuthContext] Login başarısız: Token veya user bilgisi eksik.", response.data);
             toast.error("Giriş yapılamadı (sunucu hatası).");
             return false;
        } catch (error) {
            console.error("Login API hatası:", error.response?.data?.message || error.message);
            toast.error(error.response?.data?.message || "Giriş yapılamadı.");
            return false;
        }
    }, []); // Bağımlılık dizisi boş

    // Register fonksiyonu (useCallback ile sarıldı)
    const register = useCallback(async (username, email, password) => {
        try {
            const response = await api.post('/api/auth/register', { username, email, password });
             if (response.data?.token && response.data?.user) {
                 setUser(response.data.user);
                setToken(response.data.token);
                toast.success("Kayıt başarılı! Giriş yapıldı.");
                return true;
            }
            console.error("[AuthContext] Register başarısız: Token veya user bilgisi eksik.", response.data);
            toast.error("Kayıt oluşturulamadı (sunucu hatası).");
             return false;
        } catch (error) {
            console.error("Register API hatası:", error.response?.data || error.message);
             if (error.response?.data?.errors) { error.response.data.errors.forEach(err => toast.error(err.msg)); }
             else { toast.error(error.response?.data?.message || "Kayıt işlemi başarısız."); }
            return false;
        }
    }, []); // Bağımlılık dizisi boş

    // Google Login fonksiyonu (useCallback ile sarıldı)
    const loginWithGoogle = useCallback(async (credentialResponse) => {
         if (!credentialResponse.credential) {
            console.error("Google login: Credential bulunamadı.");
            toast.error("Google ile giriş sırasında bir hata oluştu.");
            return false;
        }
         try {
            const response = await api.post('/api/auth/google', { idToken: credentialResponse.credential });
            if (response.data?.token && response.data?.user) {
                 setUser(response.data.user);
                setToken(response.data.token);
                toast.success(response.data.message || "Google ile başarıyla giriş yapıldı!");
                // Yönlendirme LoginPage'de veya ProtectedRoute tarafından yapılmalı
                return true;
            }
             console.error("[AuthContext] Google Login başarısız: Token veya user bilgisi eksik.", response.data);
             toast.error("Google ile giriş yapılamadı (sunucu hatası).");
            return false;
        } catch (error) {
            console.error("Google login API hatası:", error.response?.data?.message || error.message);
            toast.error(error.response?.data?.message || "Google ile giriş yapılamadı.");
            return false;
        }
    }, []); // Bağımlılık dizisi boş

    // Logout fonksiyonu (useCallback ile sarıldı)
    const logout = useCallback(() => {
         setToken(null); // Bu, useEffect'i tetikler, localStorage'ı temizler ve user'ı null yapar.
        toast.info("Başarıyla çıkış yapıldı.");
        // Yönlendirme AppContent içinde veya ProtectedRoute tarafından yapılmalı
    }, []); // Bağımlılık dizisi boş

    // Context değeri (useMemo ile sarıldı ve bağımlılıklar eklendi)
    const value = useMemo(() => ({
        user,
        token,
        isAuthenticated: !!token && !!user, // Hem token hem user olmalı
        loading, // Başlangıç yükleme durumu
        login,
        register,
        loginWithGoogle,
        logout,
        fetchCurrentUser // Dışarıdan çağırmak gerekirse (nadiren)
    }), [user, token, loading, login, register, loginWithGoogle, logout, fetchCurrentUser]); // Tüm fonksiyonlar ve state'ler bağımlılık

    // Başlangıç yüklemesi bitmeden children'ı render etme (ÖNEMLİ!)
    // Bu, ProtectedRoute'un doğru çalışmasını ve sayfa yenilendiğinde
    // kısa süreliğine login sayfasına atmasını engeller.
    if (loading) {
         // Boş veya bir yükleme göstergesi döndür
        // Tam sayfa kaplayan bir yükleme göstergesi daha iyi olabilir
        return <div className="vh-100 d-flex justify-content-center align-items-center"><div className="spinner-border text-primary" style={{width: '3rem', height: '3rem'}} role="status"><span className="visually-hidden">Yükleniyor...</span></div></div>;
    }

     return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// useAuth hook'u (Değişiklik yok)
export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === null) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};