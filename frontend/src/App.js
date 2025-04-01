// App.js
import React, { useState, useMemo, useEffect, useCallback } from "react";
import { Routes, Route, Link, useNavigate, Navigate } from 'react-router-dom';
import CategorySelector from "./components/CategorySelector";
import CardSession from "./components/CardSession";
import Quiz from "./components/Quiz";
import StatsPage from "./components/StatsPage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import ProtectedRoute from "./components/ProtectedRoute";
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap-icons/font/bootstrap-icons.css';
import { SpeechProvider } from './context/SpeechContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import api from './utils/api'; // API instance

// Ana Uygulama İçeriği Bileşeni
function AppContent({ authLoading, user }) {
 
    // --- State Tanımlamaları ---
    const [availableLevels, setAvailableLevels] = useState([]);
    const [selectedLevel, setSelectedLevel] = useState('');
    const [search, setSearch] = useState("");
    const [darkMode, setDarkMode] = useState(() => localStorage.getItem("darkMode") === "true");
    const [voiceEnabled, setVoiceEnabled] = useState(() => localStorage.getItem("voiceEnabled") !== "false");
    const [activeView, setActiveView] = useState('categorySelector');
    const [selectedCategory, setSelectedCategory] = useState(null);
    const [levelCards, setLevelCards] = useState([]); // API'den gelen ham kartlar (düz liste)
    const [displayedCategories, setDisplayedCategories] = useState([]);  
    const [learnedCardIds, setLearnedCardIds] = useState(new Set());    // Öğrenilen kart ID'leri (Merkezi State)
    const [difficultCardIds, setDifficultCardIds] = useState(new Set()); // Zor kart ID'leri (Merkezi State)
    const [loadingData, setLoadingData] = useState(true); // Kart/ilerleme/kaydedilenler yükleniyor mu?
    const [loadingLevels, setLoadingLevels] = useState(true); // Seviyeler yükleniyor mu?

    const { logout: authContextLogout } = useAuth();
    const navigate = useNavigate();

    // --- Temel Ayar Efektleri ---
    useEffect(() => {
        document.documentElement.setAttribute('data-bs-theme', darkMode ? 'dark' : 'light');
        localStorage.setItem("darkMode", darkMode.toString());
    }, [darkMode]);

    useEffect(() => {
        if (selectedLevel) localStorage.setItem("selectedLevel", selectedLevel);
    }, [selectedLevel]);

    useEffect(() => {
        localStorage.setItem("voiceEnabled", voiceEnabled.toString());
    }, [voiceEnabled]);

    // --- Veri Çekme Efektleri ---

    // Mevcut Seviyeleri API'den Çek
    useEffect(() => {
        let isMounted = true;
        const fetchLevels = async () => {
             setLoadingLevels(true);
            try {
                const response = await api.get('/api/cards/levels'); // '/api/' prefix'i api.js'de olmalı
                if (!isMounted) return;
                const levels = response.data || [];
                setAvailableLevels(levels);
                if (levels.length > 0) {
                    const savedLevel = localStorage.getItem("selectedLevel");
                    const initialLevel = savedLevel && levels.includes(savedLevel) ? savedLevel : levels[0];
                    setSelectedLevel(initialLevel);
                 } else {
                    setSelectedLevel(''); toast.warn("Sistemde kayıtlı dil seviyesi bulunamadı.");
                }
            } catch (error) {
                if (isMounted) { console.error("[Effect fetchLevels] Hata:", error); toast.error("Seviyeler yüklenemedi."); setAvailableLevels([]); setSelectedLevel(''); }
            } finally {
                if (isMounted) { setLoadingLevels(false); }
            }
        };
        fetchLevels();
        return () => { isMounted = false; };
    }, []);

    // ID Oluşturma Fonksiyonu (Fallback)
    const generateCardId = useCallback((card, index, categoryTitle, level) => {
        if (card?.id?.trim()) return card.id.trim();
        if (card?.cardId?.trim()) return card.cardId.trim();
        console.warn(`[generateCardId] Fallback ID oluşturuluyor:`, card);
        const trPart = card?.tr?.substring(0, 15) || `noTr${index}`;
        const mePart = card?.me?.substring(0, 15) || `noMe${index}`;
        const catPartClean = (categoryTitle || 'unknownCat').substring(0, 15);
        const levelPart = level || 'unknownLevel';
        const base = `gen_${levelPart}_${catPartClean}_${trPart}_${mePart}`;
        let safeId = base.toLowerCase().replace(/[ğüşıöç]/g, char => ({'ğ':'g','ü':'u','ş':'s','ı':'i','ö':'o','ç':'c'}[char])).replace(/[^a-z0-9_]/g, '').replace(/\s+/g, '_').replace(/__+/g, '_').replace(/^_+|_+$/g, '');
        if (!safeId || safeId.length < 10) { safeId = `${safeId}_${Date.now().toString().slice(-5)}_${index}`; }
        return safeId.substring(0, 100);
    }, []);

    // Kartları, Öğrenilmiş ve Zor Kartları API'den Çek
    useEffect(() => {
        let isMounted = true;
        const fetchData = async () => {
            if (!selectedLevel || authLoading || !user) {
                if (isMounted) { setLoadingData(false); setLevelCards([]); setLearnedCardIds(new Set()); setDifficultCardIds(new Set()); setDisplayedCategories([]); }
                return;
            }
             setLoadingData(true); setLevelCards([]); setDisplayedCategories([]);

            try {
                // API çağrıları için yolları kontrol et (api.js'deki baseURL'e göre)
                const results = await Promise.allSettled([
                    api.get(`/api/cards/${selectedLevel}`),
                    api.get('/api/progress/learned'),
                    api.get('/api/progress/difficult')
                ]);
                if (!isMounted) return;

                const cardsData = results[0].status === 'fulfilled' ? results[0].value.data || [] : [];
                const learnedData = results[1].status === 'fulfilled' ? results[1].value.data || [] : [];
                const difficultData = results[2].status === 'fulfilled' ? results[2].value.data || [] : [];

                if (results[0].status === 'rejected') { console.error("Kartlar çekilemedi:", results[0].reason); toast.error("Kart verileri yüklenemedi."); }
                if (results[1].status === 'rejected') { console.error("Öğrenilmiş kartlar çekilemedi:", results[1].reason); toast.error("Öğrenme durumu yüklenemedi."); }
                if (results[2].status === 'rejected') { console.error("Zor kartlar çekilemedi:", results[2].reason); }

                const cardsWithId = cardsData
                    .map((card, index) => ({
                        ...card,
                         id: card.id || generateCardId(card, index, card.category, card.level || selectedLevel)
                    }))
                    .filter(card => card.id);

                setLevelCards(cardsWithId);
                setLearnedCardIds(new Set(learnedData));
                setDifficultCardIds(new Set(difficultData));

            } catch (error) {
                if (isMounted) { console.error("[Effect fetchData] Genel Hata:", error); toast.error("Veriler yüklenirken hata."); setLevelCards([]); setLearnedCardIds(new Set()); setDifficultCardIds(new Set()); setDisplayedCategories([]); }
            } finally {
                if (isMounted) { setLoadingData(false); }
            }
        };
        fetchData();
        return () => { isMounted = false; };
    }, [selectedLevel, user, authLoading, generateCardId]);

    // Seviye değiştiğinde görünümü sıfırla
    useEffect(() => {
        if (selectedLevel && activeView !== 'categorySelector') {
            setActiveView('categorySelector'); setSelectedCategory(null); setSearch('');
        }
    }, [selectedLevel]); // Sadece selectedLevel'a bağlı

    // `levelCards` VEYA `difficultCardIds` değiştiğinde `displayedCategories`'i hesapla
    useEffect(() => {
        if (loadingData) return; // Yüklenirken hesaplama
        console.log("[Effect displayedCategories] Hesaplama başlıyor...");

        // 1. Normal Kategorileri Oluştur
        const categoriesMap = new Map();
        if (levelCards?.length > 0) {
            levelCards.forEach((card) => {
                if (!card?.id || !card.category || !card.level) return;
                const categoryKey = card.category;
                const categoryId = `category_${card.level}_${categoryKey.replace(/[^a-zA-Z0-9_]/g, '').replace(/\s+/g, '_')}`;
                if (!categoriesMap.has(categoryKey)) {
                    categoriesMap.set(categoryKey, { title: categoryKey, cards: [], id: categoryId, level: card.level, isDifficultCategory: false });
                }
                categoriesMap.get(categoryKey).cards.push(card);
            });
        }

        // 2. "Kaydettikleriniz" Sanal Kategorisini Oluştur
        let difficultCategory = null;
        if (difficultCardIds?.size > 0 && levelCards?.length > 0) {
            // Kaydedildi olarak işaretlenen kartları levelCards içinden filtrele
            const difficultCards = levelCards.filter(card => difficultCardIds.has(card.id));

            if (difficultCards.length > 0) {
                difficultCategory = {
                    title: "⭐ Kaydettikleriniz",
                    cards: difficultCards,
                    id: `difficult_cards_${selectedLevel || 'all'}`, // Sabit ID
                    level: selectedLevel,
                    isDifficultCategory: true // Özel kategori işareti
                };
                console.log(`[Effect displayedCategories] "Kaydettikleriniz" oluşturuldu: ${difficultCards.length} kart.`);
            }
        }

        // 3. Kategorileri Birleştir ve Sırala
        let finalCategories = Array.from(categoriesMap.values()).sort((a, b) => a.title.localeCompare(b.title));
        if (difficultCategory) {
            finalCategories = [difficultCategory, ...finalCategories]; // Özel kategoriyi başa ekle
        }

        setDisplayedCategories(finalCategories);
        console.log("[Effect displayedCategories] Kategoriler ayarlandı. Sayı:", finalCategories.length);

    }, [levelCards, loadingData, difficultCardIds, selectedLevel]); // Bağımlılıklar güncellendi

    // --- Memoized Değerler ---
    const allCards = useMemo(() => levelCards || [], [levelCards]);
    const progress = useMemo(() => {
        const normalCards = allCards.filter(card => !difficultCardIds.has(card.id)); // Zor olmayan kartlar
        const totalCount = normalCards.length; // Sadece normal kartları say
        const learnedCount = normalCards.filter(card => learnedCardIds.has(card.id)).length; // Normal kartlardan öğrenilenleri say
        const percentage = totalCount > 0 ? Math.round((learnedCount / totalCount) * 100) : 0;
        return { total: totalCount, learned: learnedCount, percentage };
    }, [allCards, learnedCardIds, difficultCardIds]); // difficultCardIds eklendi

    // --- Olay İşleyicileri (Callbacks) ---

    // Öğrenme Durumunu Değiştirme (API + State + Backend Kategori Tamamlama Kontrolü)
    const handleLearnedToggle = useCallback(async (cardId, newLearnedState) => {
        if (!cardId) return;
        const previousLearnedIds = new Set(learnedCardIds);
        const wasLearned = previousLearnedIds.has(cardId);
        if ((newLearnedState && wasLearned) || (!newLearnedState && !wasLearned)) return;

        const updatedLearnedIds = new Set(previousLearnedIds);
        if (newLearnedState) updatedLearnedIds.add(cardId); else updatedLearnedIds.delete(cardId);
        setLearnedCardIds(updatedLearnedIds); // İyimser UI

        let targetCategory = null;
        let newlyCompletedConfirmedByBackend = false;

        if (newLearnedState) {
             // Sadece normal kategorilerde tamamlama kontrolü yap
             for (const category of displayedCategories.filter(cat => !cat.isDifficultCategory)) {
                 if (category.cards.some(card => card.id === cardId)) { targetCategory = category; break; }
             }
             if (targetCategory) {
                 const allInCategoryLearned = targetCategory.cards.every(card => updatedLearnedIds.has(card.id));
                 if (allInCategoryLearned) {
                     console.log(`[AppContent] Normal Kategori "${targetCategory.title}" tamamlandı. Backend'e soruluyor...`);
                     try {
                         // API YOLUNU KONTROL ET (api.js'deki baseURL'e göre)
                         const response = await api.post('/api/progress/category/complete', {
                              categoryId: targetCategory.id,
                              categoryTitle: targetCategory.title,
                              level: targetCategory.level
                          });
                         if (response.data?.newlyCompleted === true) {
                             console.log(`[AppContent] Backend "${targetCategory.title}" için YENİ tamamlanma onayı.`);
                             newlyCompletedConfirmedByBackend = true;
                          }
                     } catch (catError) { console.error(/*...*/); }
                 }
             }
        }

        try {
            // API YOLUNU KONTROL ET
            await api.post('/api/progress/toggle', { cardId, learned: newLearnedState });
            if (newlyCompletedConfirmedByBackend && targetCategory) {
                toast.success(`"${targetCategory.title}" kategorisi tamamlandı! 🎉`, { autoClose: 5000 });
            }
        } catch (error) {
            console.error("Kart öğrenme API hatası:", error);
            toast.error("Öğrenme durumu güncellenemedi.");
            setLearnedCardIds(previousLearnedIds); // Hata durumunda geri al
        }
    }, [learnedCardIds, displayedCategories]);

    // Zorluk Durumunu Değiştirme
    const handleDifficultToggle = useCallback(async (cardId, newDifficultState) => {
        if (!cardId) return;
        const previousDifficultIds = new Set(difficultCardIds);
        const wasDifficult = previousDifficultIds.has(cardId);
        if ((newDifficultState && wasDifficult) || (!newDifficultState && !wasDifficult)) return;

        setDifficultCardIds(prev => { const n = new Set(prev); if (newDifficultState) n.add(cardId); else n.delete(cardId); return n; });
        try {
            // API YOLUNU KONTROL ET
            await api.post('/api/progress/difficult/toggle', { cardId, difficult: newDifficultState });
            toast.info(newDifficultState ? "Kaydedildi" : "Kaydedilenlerden çıkarıldı", { autoClose: 1500 });
        } catch (error) {
            console.error("Kaydedilenler API hatası:", error);
            toast.error("Kaydetme durumu güncellenemedi.");
            setDifficultCardIds(previousDifficultIds);
        }
    }, [difficultCardIds]);

    // Kategori İlerlemesini Sıfırla (Kaydedilenler kategori kontrolü ile)
    const handleResetCategoryProgress = useCallback(async (categoryCards, categoryId, categoryIsDifficult) => {
        if (!categoryCards || categoryCards.length === 0) return;
        if (categoryIsDifficult) { toast.warn("Kaydedilen kartlar listesi sıfırlanamaz."); return; }

        const categoryCardIds = categoryCards.map(c => c.id).filter(Boolean);
        if (categoryCardIds.length === 0) return;
        const categoryTitle = categoryCards[0]?.category || 'Bilinmeyen Kategori';
        console.log(`[AppContent] Kategori ilerlemesi sıfırlanıyor: ${categoryTitle}`);
        const previousLearnedIds = new Set(learnedCardIds);
        setLearnedCardIds(prev => { const n = new Set(prev); categoryCardIds.forEach(id => n.delete(id)); return n; });
        try {
            // API YOLUNU KONTROL ET
            await api.post('/api/progress/unlearn-many', { cardIds: categoryCardIds });
            toast.success(`"${categoryTitle}" kategorisi tekrar için sıfırlandı.`);
        } catch (error) {
            console.error(`API hatası - Kategori sıfırlama (${categoryTitle}):`, error);
            toast.error(`"${categoryTitle}" sıfırlanırken bir hata oluştu.`);
            setLearnedCardIds(previousLearnedIds);
        }
    }, [learnedCardIds]);

    // Kategori Seçimi
    const handleCategorySelect = useCallback((categoryData) => { if (!categoryData?.cards?.length) { toast.warn(`"${categoryData?.title}" boş.`); return; } setSelectedCategory(categoryData); setActiveView('cardSession'); setSearch(''); }, []);
    // Geri Dönüşler ve Diğerleri
    const handleGoBackToCategories = useCallback(() => { setSelectedCategory(null); setActiveView('categorySelector'); }, []);
    const startQuiz = useCallback(() => { if (allCards.length < 4) { toast.error("Quiz için yeterli kart yok."); return; } setActiveView('quiz'); setSearch(''); }, [allCards]);
    const handleGoBackFromQuiz = useCallback(() => { setActiveView('categorySelector'); }, []);
    // Sonraki Kategoriye Geç (Zor kategoriyi atlar)
    const handleGoToNextCategory = useCallback(() => {
        if (!selectedCategory || !displayedCategories?.length) { handleGoBackToCategories(); return; }
        const currentIndex = displayedCategories.findIndex(cat => cat.id === selectedCategory.id);
        if (currentIndex === -1) { handleGoBackToCategories(); return; }
        let nextIndex = currentIndex + 1;
        while (nextIndex < displayedCategories.length) {
            const nextCat = displayedCategories[nextIndex];
            // Zor, boş veya tamamlanmışsa atla
            if (nextCat.isDifficultCategory || !nextCat.cards?.length || nextCat.cards.every(card => learnedCardIds.has(card.id))) {
                nextIndex++;
            } else { break; }
        }
        if (nextIndex >= displayedCategories.length) { toast.info("👏 Bu seviyedeki tüm normal kategoriler tamamlandı!"); handleGoBackToCategories(); return; }
        const nextCategory = displayedCategories[nextIndex];
        toast.info(`Sıradaki kategori: ${nextCategory.title}`); handleCategorySelect(nextCategory);
    }, [selectedCategory, displayedCategories, handleGoBackToCategories, handleCategorySelect, learnedCardIds]); // learnedCardIds eklendi
    // Diğer Handler'lar
    const showStatsPage = useCallback(() => { setActiveView('stats'); setSearch(''); setSelectedCategory(null); }, []);
    const handleLogout = useCallback(async () => { try { await api.post('/api/auth/logout'); } catch (e) { console.error("Logout API hatası:", e); } finally { authContextLogout(); navigate('/login'); } }, [authContextLogout, navigate]);
    // handleExport ve handleReset (Quiz reset de eklenmeli)
     const handleReset = useCallback(async () => {
        if (window.confirm("TÜM öğrenme, zor kart ve quiz ilerlemesi SİLİNECEK? Bu işlem geri alınamaz!")) { // Uyarıyı güçlendir
            const prevLearned = new Set(learnedCardIds); const prevDifficult = new Set(difficultCardIds);
            setLearnedCardIds(new Set()); setDifficultCardIds(new Set()); // İyimser UI
            try {
                const results = await Promise.allSettled([
                    api.delete('/api/progress/all'),  
                    api.delete('/api/progress/difficult/all'),  
                    api.delete('/api/quiz/results/all')    
                ]);
                let success = true;
                results.forEach((r, i) => { if (r.status === 'rejected') { console.error(`Reset hatası ${i}:`, r.reason); success = false; } });
                if (success) toast.success("Tüm veriler sıfırlandı!");
                else { toast.error("Sıfırlamada hata oluştu."); setLearnedCardIds(prevLearned); setDifficultCardIds(prevDifficult); }
            } catch (error) { console.error("Genel Reset hatası:", error); toast.error("Sıfırlama başarısız."); setLearnedCardIds(prevLearned); setDifficultCardIds(prevDifficult); }
        }
     }, [learnedCardIds, difficultCardIds]);

    // --- JSX Render ---
    const shouldShowContent = !authLoading && !loadingLevels && !loadingData && user;

    return (
        <div className={`container py-4`}>
            <h1 className="text-center mb-4">🇲🇪 Karadağca - Türkçe 🇹🇷 Pratik Dil Kartları (AI)</h1>

            {/* === Ayarlar Paneli === */}
            {user && !authLoading && (
                 <div className={`card p-3 mb-4 shadow-sm ${darkMode ? "bg-dark border-secondary" : "bg-light border-light"}`}>
                   <div className="row g-3 align-items-center">
                        {/* Buton Grubu */}
                        <div className="col-lg-auto col-md-12 d-flex flex-wrap gap-2 justify-content-center justify-content-lg-start">
                            <button className={`btn btn-sm ${darkMode ? 'btn-light' : 'btn-dark'}`} onClick={() => setDarkMode(!darkMode)} title={darkMode ? "Aydınlık Mod" : "Karanlık Mod"}>{darkMode ? <><i className="bi bi-sun-fill"></i> Aydınlık</> : <><i className="bi bi-moon-stars-fill"></i> Gece</>}</button>
                            <button className={`btn btn-sm ${voiceEnabled ? "btn-primary" : "btn-outline-secondary"}`} onClick={() => setVoiceEnabled(!voiceEnabled)} title={voiceEnabled ? "Sesi Kapat" : "Sesi Aç"}>{voiceEnabled ? <><i className="bi bi-volume-up-fill"></i> Ses Açık</> : <><i className="bi bi-volume-mute-fill"></i> Ses Kapalı</>}</button>
                            <button className={`btn btn-sm ${darkMode ? 'btn-outline-light' : 'btn-outline-secondary'}`} onClick={showStatsPage} title="İstatistikler"><i className="bi bi-bar-chart-line-fill"></i> İstatistikler</button>
                            {/* Sıfırlama Butonu (Dikkatli Kullanım!) */}
                            <button className="btn btn-sm btn-outline-warning" onClick={handleReset} title="Tüm İlerlemeyi Sıfırla"><i className="bi bi-trash3-fill"></i> Sıfırla</button>
                            {/* Çıkış Butonu */}
                            <button className="btn btn-sm btn-outline-danger ms-lg-auto" onClick={handleLogout} title="Çıkış Yap"><i className="bi bi-box-arrow-right"></i> Çıkış Yap ({user?.username})</button>
                        </div>
                        {/* İlerleme Çubuğu */}
                        {/* DÜZELTİLDİ: Hatalı sınıf kaldırıldı/düzeltildi */}
                        <div className="col-lg col-md-6 col-sm-12 order-md-first order-lg-auto mt-3 mt-lg-0">
                            <div className={`fw-bold text-center text-lg-start mb-1 ${darkMode ? 'text-light' : 'text-dark'}`}>İlerleme: {progress.learned} / {progress.total} Kart</div>
                            <div className="progress" style={{ height: '12px' }} role="progressbar" aria-label="Öğrenme İlerlemesi" aria-valuenow={progress.learned} aria-valuemin="0" aria-valuemax={progress.total}>
                                <div className="progress-bar bg-success progress-bar-striped progress-bar-animated" style={{ width: progress.percentage ? `${progress.percentage}%` : '0%' }}></div>
                            </div>
                        </div>
                    </div>
                 </div>
            )}

            {/* === Seviye Seçimi + Arama === */}
            {!authLoading && user && activeView === 'categorySelector' && (
                <div className="d-flex flex-wrap justify-content-center align-items-center gap-3 mb-4 p-2 rounded" style={{ backgroundColor: darkMode ? '#343a40' : '#f8f9fa' }}>
                    {loadingLevels ? ( <div className="p-2"><span className="spinner-border spinner-border-sm text-secondary"></span></div> ) :
                     availableLevels.length > 0 ? ( <div> <label htmlFor="levelSelect" className="me-2 fw-bold small">Seviye:</label> <select id="levelSelect" className={`form-select form-select-sm d-inline-block w-auto ${darkMode ? 'bg-secondary text-light border-secondary' : ''}`} value={selectedLevel} onChange={(e) => setSelectedLevel(e.target.value)}> {availableLevels.map((level) => ( <option key={level} value={level}>{level}</option>))} </select> </div> ) : <span className="text-muted small">Seviye Yok</span> }
                    {!loadingLevels && selectedLevel && ( <> <div> <input type="search" placeholder="Kategorilerde Ara..." className={`form-control form-control-sm d-inline-block w-auto ${darkMode ? 'bg-secondary text-light border-secondary placeholder-light' : ''}`} value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Kategorilerde ara"/> {search && ( <button onClick={() => setSearch('')} className={`btn btn-sm ${darkMode ? 'btn-outline-light' : 'btn-outline-secondary'} ms-1 p-0 px-1`} title="Aramayı Temizle" style={{ lineHeight: '1' }}><i className="bi bi-x-lg"></i></button> )} </div> {allCards.length >= 4 && ( <button className="btn btn-sm btn-info" onClick={startQuiz} title="Tüm kartlarla quiz"><i className="bi bi-question-circle-fill me-1"></i> Quiz Başlat</button> )} </> )}
                </div>
            )}

             {/* === Ana İçerik Alanı === */}
            <main>
                 {/* Yükleme Göstergesi */}
                 {(authLoading || loadingLevels || loadingData) && ( <div className="text-center mt-5 pt-5"> <div className="spinner-border text-primary" style={{ width: '3rem', height: '3rem' }} role="status"><span className="visually-hidden">Yükleniyor...</span></div> <p className="mt-3 text-muted">Yükleniyor...</p> </div> )}
                {/* İçerik Render */}
                 {shouldShowContent && (
                    <>
                        {/* 1. Kategori Seçici */}
                        {activeView === 'categorySelector' && (
                            (displayedCategories.length > 0) ? ( // Zor kategori varsa bile listeyi göster
                                <CategorySelector
                                    categories={displayedCategories} // Zor kategori dahil
                                    onSelectCategory={handleCategorySelect}
                                    learnedCardIds={learnedCardIds}
                                    searchTerm={search}
                                    // Zor kategori için farklı stil/ikon CategorySelector içinde halledilmeli
                                />
                            ) : !loadingData && ( <p className="text-center text-muted mt-4">"{selectedLevel}" seviyesi için kategori bulunamadı veya yüklenemedi.</p> ) // Yükleme bittikten sonra mesaj
                        )}
                        {/* 2. Kart Oturumu */}
                        {activeView === 'cardSession' && selectedCategory && (
                            <CardSession
                                categoryTitle={selectedCategory.title}
                                initialCards={selectedCategory.cards}
                                onGoBack={handleGoBackToCategories}
                                voiceEnabled={voiceEnabled}
                                darkMode={darkMode}
                                learnedCardIds={learnedCardIds}
                                difficultCardIds={difficultCardIds}
                                onLearnedToggle={handleLearnedToggle}
                                onDifficultToggle={handleDifficultToggle}
                                onGoToNextCategory={handleGoToNextCategory}
                                // Reset fonksiyonuna gerekli bilgileri aktar
                                onResetCategoryProgress={(cards) => handleResetCategoryProgress(cards, selectedCategory.id, selectedCategory.isDifficultCategory)}
                                isDifficultCategory={selectedCategory.isDifficultCategory} // Zor kategori mi?
                            />
                        )}
                         {/* 3. Genel Quiz */}
                         {activeView === 'quiz' && ( <Quiz cards={allCards} voiceEnabled={voiceEnabled} darkMode={darkMode} onGoBack={handleGoBackFromQuiz} quizId={`${selectedLevel}_all`} /> )}
                         {/* 4. İstatistikler Sayfası */}
                         {activeView === 'stats' && ( <StatsPage allCardsData={allCards} learnedCardIdsData={learnedCardIds} difficultCardIdsData={difficultCardIds} darkMode={darkMode} onGoBack={handleGoBackToCategories} /> )}
                    </>
                 )}
                 {/* Giriş Yapılmadı Mesajı */}
                  {!authLoading && !loadingLevels && !user && !['login', 'register'].includes(activeView) && ( <div className="text-center mt-5"> <p>Devam etmek için <Link to="/login">giriş yapın</Link> veya <Link to="/register">kayıt olun</Link>.</p> </div> )}
             </main>
            <ToastContainer position="bottom-right" autoClose={3000} theme={darkMode ? "dark" : "light"} />
        </div>
    );
}
 
function WrappedApp() { return ( <AuthProvider><SpeechProvider><Routes> <Route path="/login" element={<LoginPageWrapper />} /> <Route path="/register" element={<RegisterPageWrapper />} /> <Route element={<ProtectedRoute />}><Route path="/app/*" element={<AppContentWrapper />} /><Route path="/" element={<Navigate replace to="/app" />} /></Route> <Route path="*" element={<Navigate replace to="/" />} /></Routes></SpeechProvider></AuthProvider> ); }
function LoginPageWrapper() { const { loading } = useAuth(); const darkMode = localStorage.getItem("darkMode") === "true"; return loading ? <div className="vh-100 d-flex justify-content-center align-items-center"><div className="spinner-border text-primary" role="status"></div></div> : <LoginPage darkMode={darkMode} />; }
function RegisterPageWrapper() { const { loading } = useAuth(); const darkMode = localStorage.getItem("darkMode") === "true"; return loading ? <div className="vh-100 d-flex justify-content-center align-items-center"><div className="spinner-border text-success" role="status"></div></div> : <RegisterPage darkMode={darkMode} />; }
function AppContentWrapper() { const { loading, user } = useAuth(); return <AppContent authLoading={loading} user={user} />; }


export default WrappedApp;