// src/pages/RegisterPage.jsx
import React, { useState, useEffect } from 'react'; // useEffect eklendi
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import ThemeToggleButton from '../components/ThemeToggleButton'; // Butonu import et

function RegisterPage({ darkMode: initialDarkModeProp }) { // Prop adını değiştir
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const { register } = useAuth();
    const navigate = useNavigate();

    // Tema durumu için local state
    const [darkMode, setDarkMode] = useState(initialDarkModeProp);

    // Prop değişirse local state'i güncelle
    useEffect(() => {
        setDarkMode(initialDarkModeProp);
    }, [initialDarkModeProp]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        const success = await register(username, email, password);
        setLoading(false);
        if (success) { navigate('/'); }
    };

    return (
         <div className={`container mt-5 ${darkMode ? 'text-light' : ''}`}>
             {/* Tema Butonu - Sayfanın sağ üst köşesi */}
             <div style={{ position: 'fixed', top: '1rem', right: '1rem', zIndex: 1050 }}>
                 <ThemeToggleButton initialDarkMode={darkMode} />
             </div>

            <div className="row justify-content-center">
                <div className="col-md-6 col-lg-4">
                    <div className={`card shadow-sm ${darkMode ? 'border-secondary' : ''}`}>
                        <div className="card-body p-4">
                            <h3 className="card-title text-center mb-4">Kayıt Ol</h3>
                            <form onSubmit={handleSubmit}>
                                <div className="mb-3"> <label htmlFor="username">Kullanıcı Adı</label> <input type="text" className={`form-control ${darkMode ? 'bg-secondary text-light border-secondary' : ''}`} id="username" value={username} onChange={(e) => setUsername(e.target.value)} required minLength="3" autoComplete="username" /> </div>
                                <div className="mb-3"> <label htmlFor="email">E-posta Adresi</label> <input type="email" className={`form-control ${darkMode ? 'bg-secondary text-light border-secondary' : ''}`} id="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" /> </div>
                                <div className="mb-3"> <label htmlFor="password">Şifre</label> <input type="password" className={`form-control ${darkMode ? 'bg-secondary text-light border-secondary' : ''}`} id="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength="6" autoComplete="new-password" /> </div>
                                <div className="d-grid"> <button type="submit" className="btn btn-success" disabled={loading}>{loading ? 'Kaydediliyor...' : 'Kayıt Ol'}</button> </div>
                            </form>
                             <div className="text-center mt-3"> <small>Zaten hesabınız var mı? <Link to="/login">Giriş Yapın</Link></small> </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default RegisterPage;