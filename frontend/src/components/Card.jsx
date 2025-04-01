// components/Card.jsx
import React, { useState, useEffect, useCallback, useRef } from "react";
import 'bootstrap-icons/font/bootstrap-icons.css';
import './Card.css';
import { toast } from 'react-toastify';

function Card({
    id, front, back, okunus, voiceEnabled, darkMode,
    isLearned, isDifficult, onLearnedToggle, onDifficultToggle, onLearnedAndGoNext,
    audioFilename // Backend'den gelen göreli yol (örn: "a1/avgust.mp3")
}) {
    // --- State'ler ---
    const [flipped, setFlipped] = useState(false);
    const [isPlaying, setIsPlaying] = useState(false);
    const [playbackSpeed, setPlaybackSpeed] = useState(1);
    const [isTogglingLearned, setIsTogglingLearned] = useState(false);
    const [isTogglingDifficult, setIsTogglingDifficult] = useState(false);
    // console.log(`[Card Render] ID: ${id}, Gelen audioFilename: ${audioFilename}, isPlaying: ${isPlaying}`); // Render logu

    // --- Ref ---
    const audioRef = useRef(null);

    // --- Değişkenler ---
    const isValidId = id && typeof id === 'string';
    const fullAudioPath = audioFilename ? `/audio/sr/${audioFilename}` : null;
    const canPlayAudio = voiceEnabled && fullAudioPath && audioRef.current; // Oynatılabilir mi?

    // --- Efektler ---

    // Kart ID'si değiştiğinde
    useEffect(() => {
        setFlipped(false);
        if (audioRef.current) { audioRef.current.pause(); audioRef.current.currentTime = 0; }
        setIsPlaying(false); setPlaybackSpeed(1);
    }, [id]);

    // Ses Çalma Fonksiyonu (useCallback ile, isPlaying bağımlılığı kaldırıldı)
    const playAudio = useCallback((speed = 1) => {
        if (!canPlayAudio) { // Oynatılamıyorsa çık
             if (!voiceEnabled) console.warn("[playAudio] Ses kapalı.");
             else if (!fullAudioPath) console.warn("[playAudio] Ses dosyası yolu yok.");
             else if (!audioRef.current) console.warn("[playAudio] Audio ref henüz ayarlanmadı.");
             return;
        }

        const audioElement = audioRef.current;
        const targetSrc = fullAudioPath; // Zaten hesaplanmış

        // Mevcut kaynağın doğru olduğundan emin ol
        if (!audioElement.src || !audioElement.src.endsWith(targetSrc)) {
            console.log("[playAudio] src ayarlanıyor:", targetSrc);
            audioElement.src = targetSrc;
             // src değiştikten sonra load etmek gerekebilir (bazı tarayıcılarda)
             audioElement.load();
        }

        // Eğer çalıyorSA ve istenen hız ZATEN AYARLIYSA => Durdur
        // VEYA ZATEN ÇALIYORSA VE YENİDEN BAŞLATMAK İSTEMİYORSAK (manuel tıklama hariç)
        // Manuel tıklama playAudio'yu çağırır, zaten çalıyorsa durdurur.
        // Otomatik çalma sadece çalmıyorsa başlatır.
        if (audioElement.currentTime > 0 && !audioElement.paused && !audioElement.ended && audioElement.readyState > 2) { // Daha güvenilir çalıyor kontrolü
             if (audioElement.playbackRate === speed) {
                 console.log(`[playAudio] Durduruluyor (aynı hız). Hız: ${speed}`);
                 audioElement.pause();
                 audioElement.currentTime = 0; // Başa sar
                 // setIsPlaying(false); // Olay dinleyici yapar
                 return; // Durdurduktan sonra tekrar başlatma
             }
             // Farklı hız isteniyorsa aşağı devam edecek (önce pause edilecek)
        }

        // Başlat veya hızı değiştir
        console.log(`[playAudio] Başlatılıyor/Hız Değiştiriliyor. Hız: ${speed}, Kaynak: ${targetSrc}`);
        audioElement.pause(); // Önce durdur
        audioElement.playbackRate = speed;
        setPlaybackSpeed(speed); // State'i hemen güncelle
        // Oynatmaya hazır mı diye kontrol edilebilir (readyState > 2 veya 3)
        // Play promise döndürür, yakalamak iyi olur.
        const playPromise = audioElement.play();
        if (playPromise !== undefined) {
            playPromise.then(_ => {
                 // Başarıyla çalmaya başladı (isPlaying state'i olay dinleyici ile ayarlanacak)
                 // console.log("[playAudio] Çalma başladı (promise).");
            }).catch(error => {
                console.error("Audio çalma hatası (promise):", error);
                toast.error("Ses çalınamadı.");
                setIsPlaying(false); // Hata durumunda state'i düzelt
                setPlaybackSpeed(1); // Hızı sıfırla
            });
        }

    // fullAudioPath ve voiceEnabled değiştiğinde fonksiyon yeniden oluşmalı
    }, [fullAudioPath, voiceEnabled, canPlayAudio]); // isPlaying kaldırıldı

    // Kart çevrildiğinde otomatik çalma (isPlaying bağımlılığı kaldırıldı)
    useEffect(() => {
      // Sadece arkaya çevrildiğinde VE oynatılabiliyorsa
      if (flipped && canPlayAudio) {
          // VE o anda çalmıyorsa, başlat
          if (!isPlaying) {
               console.log("[Card useEffect Flip] Kart çevrildi, otomatik çalma tetikleniyor.");
               playAudio(1); // Normal hızda çal
          }
          // Eğer zaten çalıyorsa bir şey yapma (döngüyü engeller)
      }
      // Öne çevrildiğinde sesi durdur (isPlaying kontrolü önemli)
      else if (!flipped && audioRef.current && isPlaying) {
           console.log("[Card useEffect Flip] Kart öne çevrildi, ses durduruluyor.");
           audioRef.current.pause();
           // setIsPlaying(false); // Olay dinleyici yapar
      }
  // playAudio fonksiyon referansı useCallback ile sabit olduğu için eklenebilir veya çıkarılabilir.
  // canPlayAudio, voiceEnabled ve fullAudioPath'e bağlı olduğu için onları eklemek yeterli.
  }, [flipped, voiceEnabled, fullAudioPath, canPlayAudio, playAudio]); 

    // Audio element olay dinleyicileri (state'i güncellemek için)
    useEffect(() => {
        const audioElement = audioRef.current; if (!audioElement) return;
        const handlePlay = () => { console.log("Audio Event: play/playing"); setIsPlaying(true); }
        const handlePauseOrEnd = () => { console.log("Audio Event: pause/ended"); setIsPlaying(false); }
        const handleError = (e) => { console.error("Audio Element Error:", e); toast.error(`Ses hatası: ${audioElement.error?.message || 'Bilinmeyen'}`); setIsPlaying(false); };
        audioElement.addEventListener('play', handlePlay); audioElement.addEventListener('playing', handlePlay); audioElement.addEventListener('pause', handlePauseOrEnd); audioElement.addEventListener('ended', handlePauseOrEnd); audioElement.addEventListener('error', handleError);
        return () => { audioElement.removeEventListener('play', handlePlay); audioElement.removeEventListener('playing', handlePlay); audioElement.removeEventListener('pause', handlePauseOrEnd); audioElement.removeEventListener('ended', handlePauseOrEnd); audioElement.removeEventListener('error', handleError); };
    }, []); // Sadece mount/unmount'ta

    // --- Diğer Fonksiyonlar ---
    const handleLearnedClick = useCallback(/*...*/ async (e) => { e.stopPropagation(); if (!isValidId || !onLearnedToggle || isTogglingLearned) return; setIsTogglingLearned(true); const newState = !isLearned; try { await onLearnedToggle(id, newState); if (newState === true && onLearnedAndGoNext) { setTimeout(onLearnedAndGoNext, 200); } } catch (error) { console.error("handleLearnedClick error:", error); } finally { setIsTogglingLearned(false); } }, [id, isValidId, isLearned, onLearnedToggle, isTogglingLearned, onLearnedAndGoNext]);
    const handleDifficultClick = useCallback(/*...*/ async (e) => { e.stopPropagation(); if (!isValidId || !onDifficultToggle || isTogglingDifficult) return; setIsTogglingDifficult(true); const newState = !isDifficult; try { await onDifficultToggle(id, newState); } catch (error) { console.error("handleDifficultClick error:", error); } finally { setIsTogglingDifficult(false); } }, [id, isValidId, isDifficult, onDifficultToggle, isTogglingDifficult]);
    const flipCard = useCallback((e) => { if (e.target.closest('button')) return; setFlipped(f => !f); }, []);

    // --- Stil ve Durum Hesaplamaları ---
    const btnBase = "btn btn-sm";
    const btnPrimary = `${btnBase} ${darkMode ? 'btn-outline-info' : 'btn-outline-primary'}`;
    const btnSuccess = `${btnBase} ${isLearned ? 'btn-success' : (darkMode ? 'btn-outline-success' : 'btn-outline-success')}`;
    const btnWarning = `${btnBase} ${isDifficult ? 'btn-warning' : (darkMode ? 'btn-outline-warning' : 'btn-outline-secondary')}`;
    const innerCardClasses = `card card-flip-inner h-100 shadow-sm ${flipped ? 'is-flipped' : ''} ${ isLearned ? 'border-success border-2' : (darkMode ? 'border-secondary' : '') } ${darkMode ? 'bg-dark text-light' : 'bg-white text-dark'}`;

    // --- JSX Render ---
    return (
        <div className="card-flip-container h-100" onClick={flipCard} style={{ cursor: 'pointer' }} role="button" tabIndex={0} aria-pressed={flipped} aria-label={`${front} kartı.`}>
            <audio ref={audioRef} preload="metadata" />
            <div className={innerCardClasses} style={{ borderRadius: 'var(--bs-card-border-radius)' }}>
                <div className="card-flip-face card-flip-front" aria-hidden={flipped}> <div className="card-front-text">{front}</div> </div>
                <div className="card-flip-face card-flip-back" aria-hidden={!flipped}>
                    <div className="card-flip-back-content">
                        <div className="fw-bold text-info mb-1 fs-5">{back}</div>
                        {okunus && ( <div className={`${darkMode ? 'text-white-50' : 'text-muted'} fst-italic mb-3 small`}>{okunus}</div> )}
                    </div>
                    <div className="card-flip-back-actions">
                        {/* Normal Hız Butonu */}
                        <button
                            type="button"
                            className={`${btnPrimary} d-flex align-items-center ${isPlaying && playbackSpeed === 1 ? 'active' : ''}`}
                            onClick={(e) => { e.stopPropagation(); playAudio(1); }}
                            disabled={!canPlayAudio || (isPlaying && playbackSpeed !== 1)} // canPlayAudio kontrolü
                            title={!voiceEnabled ? "Ses kapalı" : (!fullAudioPath ? "Ses dosyası yok" : (isPlaying && playbackSpeed === 1 ? "Durdur" : "Seslendir"))}
                            aria-live="polite"
                            aria-pressed={isPlaying && playbackSpeed === 1}
                        >
                            {isPlaying && playbackSpeed === 1 ? <i className="bi bi-stop-circle-fill me-1"></i> : <i className="bi bi-volume-up-fill me-1"></i>}
                           <span className="d-none d-md-inline">{isPlaying && playbackSpeed === 1 ? "Durdur" : "Seslendir"}</span>
                        </button>
                        {/* Yavaş Hız Butonu */}
                        <button
                            type="button"
                            className={`${btnPrimary} d-flex align-items-center ${isPlaying && playbackSpeed !== 1 ? 'active' : ''}`}
                            onClick={(e) => { e.stopPropagation(); playAudio(0.7); }}
                            disabled={!canPlayAudio || (isPlaying && playbackSpeed === 1)} // canPlayAudio kontrolü
                            title={!voiceEnabled ? "Ses kapalı" : (!fullAudioPath ? "Ses dosyası yok" : (isPlaying && playbackSpeed !== 1 ? "Durdur" : "Yavaş Seslendir"))}
                            aria-live="polite"
                            aria-pressed={isPlaying && playbackSpeed !== 1}
                        >
                           {isPlaying && playbackSpeed !== 1 ? <i className="bi bi-stop-circle-fill me-1"></i> : <i className="bi bi-hourglass-split me-1"></i>}
                           <span className="d-none d-md-inline">{isPlaying && playbackSpeed !== 1 ? "Durdur" : "Yavaşlat"}</span>
                        </button>
                        {/* Öğrendim Butonu */}
                        <button type="button" className={`${btnSuccess} d-flex align-items-center`} onClick={handleLearnedClick} disabled={!isValidId || isTogglingLearned} title={!isValidId ? "ID Hatalı" : (isLearned ? "Öğrenildi İşaretini Kaldır" : "Öğrendim Olarak İşaretle")} aria-pressed={isLearned}> {isTogglingLearned ? <span className="spinner-border spinner-border-sm"></span> : (isLearned ? <><i className="bi bi-check-circle-fill me-1"></i>Öğrenildi</> : <><i className="bi bi-plus-circle me-1"></i>Öğrendim</>)} </button>
                        {/* Zor İşaretleme Butonu */}
                        <button type="button" className={`${btnWarning} d-flex align-items-center`} onClick={handleDifficultClick} disabled={!isValidId || isTogglingDifficult} title={isDifficult ? "Zor işaretini kaldır" : "Zor olarak işaretle"} aria-pressed={isDifficult}> {isTogglingDifficult ? <span className="spinner-border spinner-border-sm"></span> : (isDifficult ? <i className="bi bi-star-fill"></i> : <i className="bi bi-star"></i>)} </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default Card;