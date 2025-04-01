// src/pages/LoginPage.jsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { GoogleLogin } from '@react-oauth/google';
import { toast } from 'react-toastify';
import ThemeToggleButton from '../components/ThemeToggleButton';

function LoginPage({ darkMode: initialDarkModeProp }) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [googleLoading, setGoogleLoading] = useState(false);
    const { login, loginWithGoogle } = useAuth();
    const navigate = useNavigate();
    const [darkMode, setDarkMode] = useState(initialDarkModeProp);

    useEffect(() => {
        setDarkMode(initialDarkModeProp);
    }, [initialDarkModeProp]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        const success = await login(email, password);
        setLoading(false);
        if (success) navigate('/');
    };

    const handleGoogleLoginSuccess = async (credentialResponse) => {
        setGoogleLoading(true);
        const success = await loginWithGoogle(credentialResponse);
        setGoogleLoading(false);
        if (success) navigate('/');
    };

    const handleGoogleLoginError = () => {
        console.error("Google Login Başarısız");
        toast.error('Google ile giriş sırasında bir sorun oluştu.');
        setGoogleLoading(false);
    };

    return (
        <div className={`container py-5 ${darkMode ? 'text-light' : ''}`}>
            <style>{`
                body {
                    background-image: url('arkaplan.png');
                    background-size: cover;
                    background-position: center;
                    background-repeat: no-repeat;
                    min-height: 100vh;
                }
            `}</style>

            <div style={{ position: 'fixed', top: '1rem', right: '1rem', zIndex: 1050 }}>
                <ThemeToggleButton initialDarkMode={darkMode} />
            </div>

            <div className="row justify-content-center">
                <div className="col-md-6 col-lg-4">
                    <div className="card shadow-sm">
                        <div className="card-body p-4">
                            <h3 className="card-title text-center mb-4">Giriş Yap</h3>
                            <form onSubmit={handleSubmit}>
                                <div className="mb-3">
                                    <label htmlFor="email" className="form-label">E-posta Adresi</label>
                                    <input type="email" className="form-control" id="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
                                </div>
                                <div className="mb-3">
                                    <label htmlFor="password">Şifre</label>
                                    <input type="password" className="form-control" id="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
                                </div>
                                <div className="d-grid mb-3">
                                    <button type="submit" className="btn btn-primary" disabled={loading || googleLoading}>
                                        {loading ? <><span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span><span className="ms-1">Giriş Yapılıyor...</span></> : 'Giriş Yap'}
                                    </button>
                                </div>
                            </form>

                            <div className="d-flex align-items-center my-3">
                                <hr className="flex-grow-1" />
                                <span className={`px-2 small ${darkMode ? 'text-white-50' : 'text-muted'}`}>VEYA</span>
                                <hr className="flex-grow-1" />
                            </div>

                            <div className="d-flex justify-content-center mb-3">
                                {googleLoading
                                    ? <div className="spinner-border text-secondary" role="status"><span className="visually-hidden">Yükleniyor...</span></div>
                                    : <GoogleLogin onSuccess={handleGoogleLoginSuccess} onError={handleGoogleLoginError} useOneTap theme={darkMode ? 'filled_black' : 'outline'} shape="rectangular" logo_alignment="left" />
                                }
                            </div>

                            <div className="text-center mt-3">
                                <small>Hesabınız yok mu? <Link to="/register">Kayıt Olun</Link></small>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className={`alert alert-info mt-4 small ${darkMode ? 'bg-dark border border-info text-light' : ''}`} role="alert">
                Bu uygulamadaki tüm bilgiler, <strong>yapay zekânın tatlı hayal gücünden</strong> çıkma sesli kartlardır. Bilgiler %100 doğruluk garantisiyle <u>değil</u>, %100 <strong>iyi niyetle</strong> sunulmaktadır 😊 Proje tamamen <strong>test amaçlıdır</strong>, reklam içermez, cüzdanınızı sevindiren <strong>ücretsiz</strong> bir uygulamadır. Telaffuzlar bazen profesör, bazen mahalle çocuğu gibi olabilir — siz yine de <strong>eğlenin, öğrenin</strong>, ama <u>ezber yapmayın</u> 😄
            </div>
        </div>
    );
}

export default LoginPage;
