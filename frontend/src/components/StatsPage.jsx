// src/components/StatsPage.jsx
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import 'bootstrap-icons/font/bootstrap-icons.css';
import { toast } from 'react-toastify';
import Collapse from 'react-bootstrap/Collapse'; // react-bootstrap kullanılıyorsa
import api from '../utils/api'; // api instance'ı import et

function StatsPage({ allCardsData, learnedCardIdsData, difficultCardIdsData, darkMode, onGoBack }) {
    const [quizStats, setQuizStats] = useState([]); // API'den gelen sonuçları tutacak
    const [loadingQuizStats, setLoadingQuizStats] = useState(true); // Quiz yükleme durumu
    const [openItems, setOpenItems] = useState({}); // Akordeon açık/kapalı durumu

    // Öğrenme İstatistiklerini Hesapla (Merkezi state'ten)
    // Zor kartları genel ilerlemeden hariç tutar
    const learningStats = useMemo(() => {
        const stats = {};
        if (!allCardsData || !learnedCardIdsData || !difficultCardIdsData) return stats;

        // Önce zor olmayan kartları filtrele
        const normalCards = allCardsData.filter(card => !difficultCardIdsData.has(card.id));

        normalCards.forEach(card => {
            if (!card?.id || !card.level || !card.category) return;
            const { id, level, category } = card;
            if (!stats[level]) stats[level] = { learned: 0, total: 0, percentage: 0, categories: {} };
            stats[level].total++;
            if (!stats[level].categories[category]) stats[level].categories[category] = { learned: 0, total: 0, percentage: 0 };
            stats[level].categories[category].total++;
            if (learnedCardIdsData.has(id)) {
                stats[level].learned++;
                stats[level].categories[category].learned++;
            }
        });

        // Yüzdeleri hesapla ve formatı düzenle
        Object.keys(stats).forEach(level => {
            const levelData = stats[level];
            levelData.percentage = levelData.total > 0 ? Math.round((levelData.learned / levelData.total) * 100) : 0;
            levelData.categories = Object.entries(levelData.categories).map(([title, catData]) => ({
                id: `stat_cat_${level}_${title.replace(/[^a-zA-Z0-9]/g, '_')}`, // Basit ID
                title,
                learned: catData.learned,
                total: catData.total,
                percentage: catData.total > 0 ? Math.round((catData.learned / catData.total) * 100) : 0,
            })).sort((a, b) => a.title.localeCompare(b.title)); // Alfabetik sırala
        });
        return stats;
     }, [allCardsData, learnedCardIdsData, difficultCardIdsData]); // difficultCardIdsData eklendi

    // Zor Kartları Filtrele (Ayrı liste için)
    const difficultCardsList = useMemo(() => {
        if (!allCardsData || !difficultCardIdsData) return [];
        // Zor kartları bul ve kategori/seviye bilgisiyle birlikte döndür
        return allCardsData
               .filter(card => difficultCardIdsData.has(card.id))
               .sort((a, b) => a.tr.localeCompare(b.tr)); // Türkçe'ye göre sırala (opsiyonel)
    }, [allCardsData, difficultCardIdsData]);

    // Quiz İstatistiklerini API'den Yükle
    const fetchQuizStats = useCallback(async () => {
        console.log("[StatsPage] Quiz istatistikleri API'den çekiliyor...");
        setLoadingQuizStats(true);
        try {
            const response = await api.get('/api/quiz/results/all'); // Backend route'una göre
            setQuizStats(response.data || []);
        } catch (error) {
            console.error("Quiz istatistikleri API'den çekilirken hata:", error);
            toast.error("Quiz sonuçları yüklenemedi.");
            setQuizStats([]);
        } finally {
            setLoadingQuizStats(false);
        }
    }, []);

    // Bileşen yüklendiğinde quiz istatistiklerini çek
    useEffect(() => {
        fetchQuizStats();
    }, [fetchQuizStats]);

    // Quiz İstatistiklerini API Üzerinden Sıfırla
    const handleResetQuizStats = useCallback(async () => {
        if (window.confirm("Kaydedilmiş tüm quiz sonuçları VERİTABANINDAN silinecek. Emin misiniz?")) {
            try {
                const response = await api.delete('/api/quiz/results/all'); // Backend route'una göre
                setQuizStats([]); // Local state'i temizle
                toast.success(response.data?.message || "Quiz istatistikleri başarıyla sıfırlandı!");
            } catch (error) {
                console.error("Quiz istatistikleri sıfırlanırken API hatası:", error);
                toast.error("Quiz istatistikleri sıfırlanamadı.");
            }
        }
    }, []);

    // Sıralamalar ve Akordeon Toggle
    const sortedLearningLevels = useMemo(() => Object.keys(learningStats).sort((a, b) => { const m={'A':1,'B':2,'C':3}, nA=parseInt(a.substring(1))||0, nB=parseInt(b.substring(1))||0, cA=m[a[0].toUpperCase()]||9, cB=m[b[0].toUpperCase()]||9; return cA!==cB ? cA-cB : nA-nB; }), [learningStats]);
    const groupedQuizStats = useMemo(() => quizStats.reduce((acc, stat) => { const lvl=stat.level||'Bilinmeyen'; acc[lvl]=(acc[lvl]||[]).concat(stat); return acc; }, {}), [quizStats]);
    const sortedQuizLevels = useMemo(() => Object.keys(groupedQuizStats).sort((a, b) => { const m={'A':1,'B':2,'C':3}, nA=parseInt(a.substring(1))||0, nB=parseInt(b.substring(1))||0, cA=m[a[0].toUpperCase()]||9, cB=m[b[0].toUpperCase()]||9; return cA!==cB ? cA-cB : nA-nB; }), [groupedQuizStats]);
    const toggleOpenItem = (key) => setOpenItems(prev => ({ ...prev, [key]: !prev[key] }));

    // --- JSX Render ---
    return (
        <div className={`stats-page-container mt-4 p-3 ${darkMode ? 'text-light' : 'text-dark'}`}>
            {/* Başlık ve Geri Butonu */}
             <div className="d-flex justify-content-between align-items-center mb-4">
                <button className="btn btn-sm btn-outline-secondary" onClick={onGoBack} title="Geri Dön"><i className="bi bi-arrow-left"></i> Geri</button>
                <h2 className={`mb-0 ${darkMode ? 'text-info' : 'text-primary'}`}>İstatistikler</h2>
                 {/* Quiz sıfırlama butonu */}
                 {quizStats.length > 0 && !loadingQuizStats && (<button className="btn btn-sm btn-outline-danger" onClick={handleResetQuizStats} title="Tüm Quiz İstatistiklerini Sıfırla"><i className="bi bi-trash3"></i> Quizleri Sıfırla</button>)}
                 {quizStats.length === 0 && !loadingQuizStats && (<div style={{ minWidth: '130px' }}></div>)} {/* Buton yoksa yer tutucu */}
            </div>

            {/* Öğrenme İstatistikleri */}
            <h3 className={`mb-3 ${darkMode ? 'text-white-50' : 'text-muted'}`}>Öğrenme İlerlemesi</h3>
            <div className="accordion" id="learningStatsAccordion">
                {sortedLearningLevels.length > 0 ? ( sortedLearningLevels.map((levelName) => {
                        const levelStat = learningStats[levelName]; if (!levelStat) return null; const levelKey = `learn_${levelName}`; const isOpen = !!openItems[levelKey];
                        return (
                             <div key={levelName} className={`accordion-item ${darkMode ? 'bg-dark border-secondary' : 'bg-light'}`}>
                                <h2 className="accordion-header" id={`h-${levelName}`}>
                                    <button className={`accordion-button ${isOpen?'':'collapsed'} ${darkMode?'bg-dark text-light':''}`} type="button" onClick={() => toggleOpenItem(levelKey)} aria-expanded={isOpen} aria-controls={`c-${levelName}`}>
                                        <div className="d-flex justify-content-between w-100 align-items-center pe-3">
                                            <span className="fw-bold fs-5">{levelName}</span>
                                            <span className={`badge rounded-pill ${levelStat.percentage===100?'bg-success':'bg-primary'}`}>{levelStat.learned}/{levelStat.total} (%{levelStat.percentage})</span>
                                        </div>
                                    </button>
                                </h2>
                                <Collapse in={isOpen}>
                                    <div id={`c-${levelName}`} aria-labelledby={`h-${levelName}`}>
                                        <div className="accordion-body py-2">
                                            {levelStat.categories?.length > 0 ? (
                                                <ul className="list-group list-group-flush">{levelStat.categories.map(catStat => (
                                                    <li key={catStat.id||catStat.title} className={`list-group-item px-0 py-2 ${darkMode?'bg-dark text-light border-secondary':''}`}>
                                                        <div className="d-flex justify-content-between align-items-center mb-1 flex-wrap gap-1">
                                                            <span className="text-truncate me-2 small" title={catStat.title}>{catStat.title}</span>
                                                            <small className={darkMode?'text-white-50':'text-muted'}>({catStat.learned}/{catStat.total})</small>
                                                        </div>
                                                        <div className="progress" style={{height:'6px',backgroundColor:darkMode?'var(--bs-secondary)':'#e9ecef'}}>
                                                            <div className={`progress-bar ${catStat.percentage===100?'bg-success':(darkMode?'bg-info':'bg-primary')}`} role="progressbar" style={{width:`${catStat.percentage}%`}} aria-valuenow={catStat.percentage} aria-valuemin="0" aria-valuemax="100"></div>
                                                        </div>
                                                    </li>
                                                ))}</ul>
                                            ) : (<p className="text-muted small mb-0">Bu seviyede kategori detayı yok.</p>)}
                                        </div>
                                    </div>
                                </Collapse>
                            </div>
                        );
                    }) ) : ( <p className={`text-center ${darkMode ? 'text-white-50' : 'text-muted'}`}>Öğrenme verisi bulunamadı.</p> )}
            </div>

            {/* Quiz İstatistikleri */}
            <hr className={`my-4 ${darkMode ? 'border-secondary' : ''}`} />
            <h3 className={`mb-3 ${darkMode ? 'text-white-50' : 'text-muted'}`}>Quiz Sonuçları</h3>
            {/* Yükleniyor göstergesi */}
            {loadingQuizStats && (
                 <div className="text-center my-3"> <span className="spinner-border spinner-border-sm text-secondary" role="status"></span> <span className="ms-2 text-muted">Quiz sonuçları yükleniyor...</span> </div>
            )}
            {/* Sonuçlar veya "Yok" mesajı */}
            {!loadingQuizStats && (
                <div className="accordion" id="quizStatsAccordion">
                    {sortedQuizLevels.length > 0 ? ( sortedQuizLevels.map((levelName) => {
                            const levelQuizzes = groupedQuizStats[levelName]; if (!levelQuizzes?.length) return null; const quizKey = `quiz_${levelName}`; const isOpen = !!openItems[quizKey];
                            return (
                                 <div key={`quiz-${levelName}`} className={`accordion-item ${darkMode ? 'bg-dark border-secondary' : 'bg-light'}`}>
                                    <h2 className="accordion-header" id={`qh-${levelName}`}> <button className={`accordion-button ${isOpen?'':'collapsed'} ${darkMode?'bg-dark text-light':''}`} type="button" onClick={() => toggleOpenItem(quizKey)} aria-expanded={isOpen} aria-controls={`qc-${levelName}`}><span className="fw-bold fs-5">{levelName} Quizleri</span></button></h2>
                                    <Collapse in={isOpen}>
                                        <div id={`qc-${levelName}`} aria-labelledby={`qh-${levelName}`}>
                                            <div className="accordion-body py-2">
                                                <ul className="list-group list-group-flush">{levelQuizzes.map((stat) => (
                                                    <li key={stat.id} className={`list-group-item d-flex justify-content-between align-items-center flex-wrap gap-2 ${darkMode?'bg-dark text-light border-secondary':''}`}>
                                                        <div className='flex-grow-1 me-2'>
                                                            <span className="fw-bold">{stat.category_title || stat.quiz_id}</span>
                                                            {stat.completed_at && (<small className={`d-block ${darkMode?'text-white-50':'text-muted'}`}>{new Date(stat.completed_at).toLocaleString([],{dateStyle:'short',timeStyle:'short'})}</small>)}
                                                        </div>
                                                        <div className='d-flex align-items-center'>
                                                            <span className={`badge fs-6 rounded-pill ${stat.accuracy>=80?'bg-success':stat.accuracy>=50?'bg-warning text-dark':'bg-danger'} me-2`} style={{minWidth:'55px'}} title={`${stat.accuracy}% Başarı`}>%{stat.accuracy}</span>
                                                            <small className={darkMode?'text-white-50':'text-muted'}>({stat.correct_count}/{stat.total_questions})</small>
                                                        </div>
                                                    </li>
                                                 ))}</ul>
                                             </div>
                                        </div>
                                    </Collapse>
                                </div>
                            );
                        }) ) : ( <p className={`text-center ${darkMode ? 'text-white-50' : 'text-muted'}`}>Kayıtlı quiz sonucu yok.</p> )}
                </div>
            )}

            {/* === Kaydedilen Zor Kartlar Bölümü === */}
            {/* difficultCardIdsData yerine hesaplanmış difficultCardsList kullanılır */}
            {difficultCardsList.length > 0 && (
                 <>
                    <hr className={`my-4 ${darkMode ? 'border-secondary' : ''}`} />
                    <h3 className={`mb-3 ${darkMode ? 'text-white-50' : 'text-muted'}`}>⭐ Kaydedilen Kartlar ({difficultCardsList.length})</h3>
                     <ul className="list-group list-group-flush">
                         {difficultCardsList.map(card => (
                             <li key={card.id} className={`list-group-item px-0 py-2 ${darkMode ? 'bg-dark text-light border-secondary' : ''}`}>
                                 <div className="d-flex justify-content-between">
                                     <span>{card.tr}</span>
                                     <span className={`fw-bold ${darkMode ? 'text-info-emphasis' : 'text-info'}`}>{card.me}</span>
                                 </div>
                                 {/* Kategori ve Seviye Bilgisi */}
                                  <small className='d-block text-muted'>{card.category} / {card.level}</small>
                                  {/* Opsiyonel: Öğrenilme Durumu */}
                                  {/* {learnedCardIdsData?.has(card.id) && <small className='d-block text-success'>Öğrenildi</small>} */}
                             </li>
                         ))}
                     </ul>
                 </>
             )}

        </div>
    );
}

export default StatsPage;