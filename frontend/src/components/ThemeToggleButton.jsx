// src/components/ThemeToggleButton.jsx
import React, { useState, useEffect } from 'react';
import 'bootstrap-icons/font/bootstrap-icons.css';

function ThemeToggleButton({ initialDarkMode = false, className = '' }) {
    const [darkMode, setDarkMode] = useState(initialDarkMode);

    // Tema state'i değiştiğinde localStorage ve body'yi güncelle
    useEffect(() => {
        document.documentElement.setAttribute('data-bs-theme', darkMode ? 'dark' : 'light');
        localStorage.setItem("darkMode", darkMode.toString());
    }, [darkMode]);

    const toggleDarkMode = () => {
        setDarkMode(prevMode => !prevMode);
    };

    return (
        <button
            className={`btn btn-sm ${darkMode ? 'btn-light' : 'btn-dark'} ${className}`}
            onClick={toggleDarkMode}
            title={darkMode ? "Aydınlık Mod" : "Karanlık Mod"}
        >
            {darkMode
                ? <><i className="bi bi-sun-fill"></i> Aydınlık</>
                : <><i className="bi bi-moon-stars-fill"></i> Gece</>
            }
        </button>
    );
}

export default ThemeToggleButton;