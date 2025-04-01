// src/index.js
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter as Router } from 'react-router-dom'; // Router
import WrappedApp from './App'; // Ana uygulama bileşenini (sarmalayıcı ile) import et
import { AuthProvider } from './context/AuthContext'; // Auth context provider
import { SpeechProvider } from './context/SpeechContext'; // Speech context provider
import { GoogleOAuthProvider } from '@react-oauth/google'; // <-- BU SATIR Google Girişi İçin
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap-icons/font/bootstrap-icons.css';
import 'react-toastify/dist/ReactToastify.css';
 
const root = ReactDOM.createRoot(document.getElementById('root'));
const googleClientId = "977239285992-7mnu4098ml4p0rjd7ahinbdgap6su3ld.apps.googleusercontent.com";

root.render(
  <React.StrictMode>
        <GoogleOAuthProvider clientId={googleClientId}> {/* clientId prop'unu ekledik google login için */}
    <Router>
      <AuthProvider>
        <SpeechProvider>
          <WrappedApp />
        </SpeechProvider>
      </AuthProvider>
    </Router>
    </GoogleOAuthProvider>
  </React.StrictMode>
);