// components/CardSession.jsx
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Card from './Card';
import Quiz from './Quiz';
import { toast } from 'react-toastify';
import 'bootstrap-icons/font/bootstrap-icons.css';
import Confetti from 'react-confetti';
import useWindowSize from 'react-use/lib/useWindowSize';

// Fisher-Yates Shuffle
function shuffleArray(array) {
    const newArray = Array.isArray(array) ? [...array] : [];
    if (newArray.length === 0) return [];
    let currentIndex = newArray.length, randomIndex;
    while (currentIndex !== 0) { randomIndex = Math.floor(Math.random() * currentIndex); currentIndex--; [newArray[currentIndex], newArray[randomIndex]] = [newArray[randomIndex], newArray[currentIndex]]; }
    return newArray;
}

// Props: categoryTitle, initialCards, onGoBack, voiceEnabled, darkMode,
//        learnedCardIds, difficultCardIds, onLearnedToggle, onDifficultToggle,
//        onGoToNextCategory, onResetCategoryProgress, isDifficultCategory (YENİ)
function CardSession({
    categoryTitle, initialCards, onGoBack, voiceEnabled, darkMode,
    learnedCardIds, difficultCardIds, onLearnedToggle, onDifficultToggle,
    onGoToNextCategory, onResetCategoryProgress, isDifficultCategory // Yeni prop alındı
}) {
    // State Tanımlamaları
    const [cards, setCards] = useState([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isSessionComplete, setIsSessionComplete] = useState(false); // UI için gerekli
    const [showCategoryQuiz, setShowCategoryQuiz] = useState(false);
    const { width, height } = useWindowSize();
    const [isLoading, setIsLoading] = useState(true);

    // --- Callback Fonksiyonları ---

    // Tamamlama durumunu kontrol et (Zor kategori hariç)
    const checkCompletion = useCallback(() => {
        // Zor kategorinin tamamlanma durumu olmaz (veya farklı tanımlanır)
        if (isDifficultCategory) {
             setIsSessionComplete(false); return; // Zor kategoriler asla tamamlanmış sayılmaz
        }
        if (!cards || cards.length === 0 || !(learnedCardIds instanceof Set)) {
            setIsSessionComplete(false); return;
        }
        const cardIds = cards.map(c => c?.id).filter(Boolean);
        if (cardIds.length === 0) { setIsSessionComplete(false); return; }
        const allLearned = cardIds.every(id => learnedCardIds.has(id));
        setIsSessionComplete(allLearned);
    }, [cards, learnedCardIds, isDifficultCategory]); // isDifficultCategory eklendi

    // Navigasyon
    const goToNext = useCallback(() => { if (!cards?.length) return; setCurrentIndex((prev) => (prev + 1) % cards.length); }, [cards]);
    const goToPrevious = useCallback(() => { if (!cards?.length) return; setCurrentIndex((prev) => (prev - 1 + cards.length) % cards.length); }, [cards]);

    // Sadece local UI'ı sıfırla ve karıştır
    const resetLocalSessionUI = useCallback(() => {
        const validCards = initialCards?.filter(c => c?.id) || [];
        setCards(shuffleArray(validCards));
        setCurrentIndex(0);
        setIsSessionComplete(false);
        setShowCategoryQuiz(false);
        console.log(`[CardSession] Local UI sıfırlandı: ${categoryTitle}`);
    }, [initialCards, categoryTitle]);

    // "Bu Kategoriyi Tekrarla" Butonu Handler'ı (Zor kategori kontrolü eklendi)
    const handleRepeatCategory = useCallback(async () => {
        console.log(`[CardSession] Tekrarla tıklandı: ${categoryTitle}, Zor mu: ${isDifficultCategory}`);
        // Zor kategorinin ilerlemesi sıfırlanamaz
        if (isDifficultCategory) {
             toast.warn("Kaydedilen kartlar listesi bu şekilde sıfırlanamaz. İşaretleri kaldırabilirsiniz.");
             return;
        }
        // Normal kategoriyi sıfırlama
        if (onResetCategoryProgress && initialCards?.length > 0) {
            try {
                // AppContent'e bildir (Orijinal kart listesini, ID'yi ve zor olmadığını gönder)
                await onResetCategoryProgress(initialCards, initialCards[0]?.id, false); // ID ve zorluk durumu iletiliyor
                resetLocalSessionUI();
                toast.info(`"${categoryTitle}" kategorisi tekrar ediliyor...`);
            } catch (error) { console.error("[CardSession] Kategori resetlenirken hata:", error); }
        } else {
            console.warn("[CardSession] onResetCategoryProgress eksik/kart yok, local'de karıştırılıyor.");
            resetLocalSessionUI();
            toast.info("Kartlar karıştırıldı!");
        }
    }, [onResetCategoryProgress, initialCards, categoryTitle, resetLocalSessionUI, isDifficultCategory]); // isDifficultCategory eklendi

    // Quiz Başlat/Bitir
    const startCategoryQuiz = useCallback(() => { if (cards.length < 4) { toast.warn("Quiz için yeterli kart yok."); return; } setShowCategoryQuiz(true); }, [cards]);
    const handleGoBackFromCategoryQuiz = useCallback(() => { setShowCategoryQuiz(false); checkCompletion(); }, [checkCompletion]);

    // --- Efektler ---
    useEffect(() => { // Kategori değişince
        setIsLoading(true); setShowCategoryQuiz(false); setIsSessionComplete(false); setCurrentIndex(0);
        if (initialCards?.length > 0) { const validCards = initialCards.filter(c => c?.id); setCards(shuffleArray(validCards)); }
        else { setCards([]); }
        setIsLoading(false);
    }, [initialCards, categoryTitle]);

    useEffect(() => { // Tamamlama kontrolü
        if (!isLoading) { checkCompletion(); }
    }, [isLoading, cards, learnedCardIds, checkCompletion]);

    useEffect(() => { // Klavye
        const handleKeyDown = (event) => { if (showCategoryQuiz || isSessionComplete || !cards?.length) return; if (event.key === 'ArrowRight') goToNext(); else if (event.key === 'ArrowLeft') goToPrevious(); else if (event.key === 'Escape') onGoBack(); };
        window.addEventListener('keydown', handleKeyDown); return () => window.removeEventListener('keydown', handleKeyDown);
    }, [goToNext, goToPrevious, onGoBack, cards, showCategoryQuiz, isSessionComplete]);

    // --- Memoized Değerler ---
    const currentCard = useMemo(() => cards?.[currentIndex], [cards, currentIndex]);

    // --- JSX Render ---
    if (isLoading) { /* ... loading ... */ }
    if (!initialCards || initialCards.length === 0) { /* ... no cards ... */ }
    const progressPercent = cards.length > 0 ? ((currentIndex + 1) / cards.length) * 100 : 0;

    return (
        <div className={`card-session-container mt-4 p-3 border rounded shadow-sm ${darkMode ? 'bg-dark text-light border-secondary' : 'bg-light'}`}>
            {/* Konfeti (Sadece normal kategori tamamlandıysa) */}
            {isSessionComplete && !showCategoryQuiz && !isDifficultCategory && <Confetti width={width} height={height} recycle={false} numberOfPieces={300} />}

            {/* Başlık ve Kontroller */}
            <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
                <button className="btn btn-sm btn-outline-secondary" onClick={onGoBack} title="Kategori Listesi (Esc)"> <i className="bi bi-arrow-left"></i> Geri </button>
                <h4 className="mb-0 text-primary text-center flex-grow-1 mx-2 text-truncate">{categoryTitle}</h4>
                <div className="d-flex gap-2">
                     {/* Quiz Butonu (Her zaman gösterilebilir, kart sayısı yeterliyse) */}
                    {!showCategoryQuiz && (
                        <button className="btn btn-sm btn-info" onClick={startCategoryQuiz} disabled={cards.length < 4} title="Quiz Yap">
                            <i className="bi bi-question-circle-fill me-1"></i> <span className="d-none d-sm-inline">Quiz Yap</span>
                        </button>
                    )}
                    {/* Tekrarla Butonu (Sadece normal kategoride ve tamamlanmamışsa) */}
                    {!showCategoryQuiz && !isSessionComplete && !isDifficultCategory && (
                         <button className={`btn btn-sm ${darkMode ? 'btn-outline-warning' : 'btn-outline-secondary'}`} onClick={handleRepeatCategory} title="Bu Kategoriyi Tekrarla">
                            <i className="bi bi-arrow-repeat"></i> <span className="d-none d-sm-inline ms-1">Tekrarla</span>
                        </button>
                    )}
                </div>
            </div>

            {/* İlerleme Çubuğu (Sadece normal kategoride ve tamamlanmamışsa) */}
            {!showCategoryQuiz && !isSessionComplete && !isDifficultCategory && (
                <div className="progress mb-4" style={{ height: '8px' }} title={`${Math.round(progressPercent)}% gösterildi`}>
                    <div className="progress-bar" role="progressbar" style={{ width: `${progressPercent}%` }}></div>
                </div>
            )}
             {/* Zor Kategori İçin Bilgi (Opsiyonel) */}
              {!showCategoryQuiz && isDifficultCategory && (
                  <div className="text-center text-muted small mb-3">
                      Bu listedeki kartlar farklı kategorilerden kaydedilmiştir.
                  </div>
              )}

            {/* Ana İçerik Alanı */}
            {/* Tamamlanma Ekranı (Sadece normal kategoriler için) */}
            {isSessionComplete && !showCategoryQuiz && !isDifficultCategory ? (
                <div className="text-center py-5 d-flex flex-column align-items-center justify-content-center" style={{ minHeight: '300px' }}>
                    <i className="bi bi-stars text-warning display-1 mb-3"></i>
                    <h3 className="text-success mb-3">Tebrikler!</h3>
                    <p>"{categoryTitle}" kategorisi tamamlandı.</p>
                    {onGoToNextCategory && ( <button className="btn btn-lg btn-success mt-3" onClick={onGoToNextCategory}> Sıradaki Kategori <i className="bi bi-arrow-right-circle"></i> </button> )}
                    {/* Tekrarla butonu burada da var, handleRepeatCategory zor kategoriyi engeller */}
                    <button className="btn btn-sm btn-outline-secondary mt-4" onClick={handleRepeatCategory}> Bu Kategoriyi Tekrarla <i className="bi bi-arrow-repeat"></i> </button>
                    {/* Tamamlanma ekranında da Quiz butonu */}
                     <button className="btn btn-sm btn-info mt-2" onClick={startCategoryQuiz} disabled={cards.length < 4} title="Quiz Yap"> <i className="bi bi-question-circle-fill me-1"></i> Tekrar Quiz Yap </button>
                </div>
             ) : showCategoryQuiz ? (
                 // Quiz Ekranı
                 <div className="mt-n3"> <Quiz cards={initialCards} voiceEnabled={voiceEnabled} darkMode={darkMode} onGoBack={handleGoBackFromCategoryQuiz} quizId={`${initialCards?.[0]?.level || 'unknownLevel'}_category_${categoryTitle.replace(/[^a-zA-Z0-9_]/g, '').replace(/\s+/g, '_')}`} /> </div>
             ) : currentCard ? (
                 // Kart Gösterim Ekranı
                 <>
                   <div className="d-flex justify-content-center align-items-center mb-4" style={{ minHeight: '300px' }}>
                     <button className="btn btn-lg btn-outline-secondary me-3 d-none d-md-block" onClick={goToPrevious} disabled={cards.length < 2} title="Önceki (Sol Ok)"> <i className="bi bi-chevron-left"></i> </button>
                     <div style={{ maxWidth: '400px', width: '100%' }}>
                       <Card
                         key={currentCard.id}
                         id={currentCard.id}
                         front={currentCard.tr}
                         back={currentCard.me}
                         okunus={currentCard.okunus}
                         voiceEnabled={voiceEnabled}
                         darkMode={darkMode}
                         isLearned={learnedCardIds?.has(currentCard.id)}
                         isDifficult={difficultCardIds?.has(currentCard.id)}
                         onLearnedToggle={onLearnedToggle}
                         onDifficultToggle={onDifficultToggle}
                         onLearnedAndGoNext={goToNext}
                         audioFilename={currentCard?.audioFilename}
                       />
                     </div>
                     <button className="btn btn-lg btn-outline-secondary ms-3 d-none d-md-block" onClick={goToNext} disabled={cards.length < 2} title="Sonraki (Sağ Ok)"> <i className="bi bi-chevron-right"></i> </button>
                   </div>
                   <div className="d-flex justify-content-between align-items-center d-md-none mb-2"> <button className="btn btn-outline-secondary" onClick={goToPrevious} disabled={cards.length < 2}><i className="bi bi-chevron-left"></i> Önceki</button> <button className="btn btn-outline-secondary" onClick={goToNext} disabled={cards.length < 2}>Sonraki <i className="bi bi-chevron-right"></i></button> </div>
                   {/* İlerleme Metni (Zor kategori için farklı olabilir) */}
                   <div className="text-center mt-2 text-muted small">
                       {isDifficultCategory ? `Kart ${currentIndex + 1} / ${cards.length}` : `Kart ${currentIndex + 1} / ${cards.length}`}
                       <span className="d-none d-md-inline"> (Ok tuşlarıyla gezinin)</span>
                   </div>
                 </>
               ) : ( /* Fallback */ <div className="text-center mt-5 pt-5"> <p className="text-warning">Kart gösterilirken bir sorun oluştu.</p> <button className="btn btn-outline-secondary mt-3" onClick={onGoBack}> <i className="bi bi-arrow-left"></i> Geri Dön </button> </div> )}
        </div>
    );
}

export default CardSession;