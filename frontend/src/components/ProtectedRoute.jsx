// src/components/ProtectedRoute.jsx
import React from 'react';
import { useAuth } from '../context/AuthContext';
import { Navigate, Outlet } from 'react-router-dom';

// Bu bileşen, içine aldığı route'ları sadece giriş yapmış kullanıcılar için gösterir.
// Giriş yapılmamışsa login sayfasına yönlendirir.
function ProtectedRoute() {
    const { isAuthenticated, loading } = useAuth();

    if (loading) {
        // Kimlik durumu kontrol edilirken yükleme göstergesi
        return (
            <div className="d-flex justify-content-center align-items-center" style={{ height: '100vh' }}>
                <div className="spinner-border text-primary" role="status">
                    <span className="visually-hidden">Yükleniyor...</span>
                </div>
            </div>
        );
    }

    // Eğer kullanıcı giriş yapmışsa, alt route'ları (Outlet) göster
    // Yapmamışsa, /login sayfasına yönlendir
    return isAuthenticated ? <Outlet /> : <Navigate to="/login" replace />;
}

export default ProtectedRoute;