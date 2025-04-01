// components/Quiz.jsx
import React, { useState, useCallback, useEffect, useRef } from "react"; // useRef eklendi, useMemo kaldırıldı (gerekmiyorsa)
import 'bootstrap-icons/font/bootstrap-icons.css';
// import { useSpeech } from '../context/SpeechContext'; // KALDIRILDI
// import { speakText } from '../utils/speechUtils'; // KALDIRILDI
import { toast } from 'react-toastify';
import api from '../utils/api';

// Fisher-Yates Shuffle
function shuffleArray(array) {
    const newArray = Array.isArray(array) ? [...array] : [];
    if (newArray.length === 0) return [];
    let currentIndex = newArray.length, randomIndex;
    while (currentIndex !== 0) { randomIndex = Math.floor(Math.random() * currentIndex); currentIndex--; [newArray[currentIndex], newArray[randomIndex]] = [newArray[randomIndex], newArray[currentIndex]]; }
    return newArray;
}

// initialCards dizisindeki kartların audioFilename içerdiğini varsayıyoruz
function Quiz({ cards: initialCards, voiceEnabled, darkMode, onGoBack, quizId }) {
    // --- State Yönetimi ---
    const [question, setQuestion] = useState(null); // Mevcut soru kartı objesi (audioFilename içermeli)
    const [options, setOptions] = useState([]);
    const [selectedOption, setSelectedOption] = useState(null);
    const [isAnswered, setIsAnswered] = useState(false);
    const [unaskedCards, setUnaskedCards] = useState([]);
    const [score, setScore] = useState({ correct: 0, incorrect: 0 });
    const [isQuizFinished, setIsQuizFinished] = useState(false);
    const [totalQuestionsInRound, setTotalQuestionsInRound] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false); // Yeni ses state'i
    const [playbackSpeed, setPlaybackSpeed] = useState(1); // Yeni ses state'i
    const [quizCategoryTitle, setQuizCategoryTitle] = useState('');
    const [quizLevel, setQuizLevel] = useState('');

    // --- Ref ---
    const audioRef = useRef(null); // Audio elementi için ref

    // --- Fonksiyonlar ---

    // Ses Çalma Fonksiyonu (URL ve hız ile)
    const playAudio = useCallback((audioFilename, speed = 1) => {
        // question objesinden audioFilename'i alıp tam path oluştur
        const fullAudioPath = audioFilename ? `/audio/sr/${audioFilename}` : null;
        const canPlay = voiceEnabled && fullAudioPath && audioRef.current;

        if (!canPlay) {
            if (voiceEnabled && !fullAudioPath) toast.warn("Bu kart için ses dosyası bulunamadı.");
            return;
        }

        const audioElement = audioRef.current;
        const targetSrc = fullAudioPath;

        if (isPlaying && audioElement.playbackRate === speed && audioElement.src.endsWith(targetSrc)) {
            audioElement.pause();
            audioElement.currentTime = 0;
        } else {
            audioElement.pause();
            if (!audioElement.src || !audioElement.src.endsWith(targetSrc)) {
                audioElement.src = targetSrc;
                audioElement.load(); // Yeni src için load gerekebilir
            }
            audioElement.playbackRate = speed;
            audioElement.play().catch(error => {
                 console.error("Quiz Audio çalma hatası:", error);
                 toast.error("Ses çalınamadı.");
                 setIsPlaying(false);
            });
            setPlaybackSpeed(speed);
        }
    }, [voiceEnabled, isPlaying]); // audioFilename kaldırıldı, parametre olarak alınıyor

    // Sıradaki soruyu yükle
    const loadNextQuestion = useCallback(async (currentUnaskedCards) => {
        if (!currentUnaskedCards || currentUnaskedCards.length === 0) {
            setIsQuizFinished(true);
            // --- SONUÇ KAYDETME (API ile) ---
            const finalScore = score; const finalTotal = totalQuestionsInRound;
            if (quizId && finalTotal > 0 && quizCategoryTitle && quizLevel) {
                try {
                    const resultData = { quizId, categoryTitle: quizCategoryTitle, level: quizLevel, correct: finalScore.correct, incorrect: finalScore.incorrect, total: finalTotal };
                    await api.post('/api/quiz/results/save', resultData);
                    toast.info(`Quiz sonucu kaydedildi! Skor: ${finalScore.correct} / ${finalTotal}`);
                } catch (error) { console.error(/*...*/); toast.error("Quiz sonucu kaydedilirken hata."); }
            } else { toast.info(`Quiz tamamlandı! Skor: ${finalScore.correct} / ${finalTotal}`); /* ... */ }
            return;
        }
        // Soru ve seçenek hazırlama
        const nextQuestion = currentUnaskedCards[0]; const remainingCards = currentUnaskedCards.slice(1);
        setUnaskedCards(remainingCards); setQuestion(nextQuestion);
        const otherCards = initialCards.filter(card => card?.id && nextQuestion?.id && card.id !== nextQuestion.id);
        const shuffledOthers = shuffleArray(otherCards).slice(0, 3);
        const currentOptions = shuffleArray([...shuffledOthers, nextQuestion]);
        setOptions(currentOptions); setSelectedOption(null); setIsAnswered(false);
        // Yeni soruya geçince sesi durdur
        if (audioRef.current) { audioRef.current.pause(); audioRef.current.currentTime = 0; }
        setIsPlaying(false); setPlaybackSpeed(1);

    }, [initialCards, quizId, score, totalQuestionsInRound, quizCategoryTitle, quizLevel]);

    // Quiz'i başlat/sıfırla
    const startOrResetQuiz = useCallback(() => {
        if (!initialCards || !Array.isArray(initialCards) || initialCards.length < 4) { toast.error("Quiz başlatılamadı: En az 4 kart gereklidir."); setIsQuizFinished(true); return; }
        const validCards = initialCards.filter(c => c?.id);
        if (validCards.length < 4) { toast.error("Quiz başlatılamadı: En az 4 geçerli kart gereklidir."); setIsQuizFinished(true); return; }
        const firstCardCategory = validCards[0]?.category || 'Bilinmeyen Kategori';
        const firstCardLevel = validCards[0]?.level || 'Bilinmiyor';
        setQuizCategoryTitle(firstCardCategory); setQuizLevel(firstCardLevel);
        const shuffled = shuffleArray(validCards);
        setUnaskedCards(shuffled); setTotalQuestionsInRound(shuffled.length); setScore({ correct: 0, incorrect: 0 }); setIsQuizFinished(false); setSelectedOption(null); setIsAnswered(false);
        if (audioRef.current) { audioRef.current.pause(); audioRef.current.currentTime = 0; } // Sesi durdur
        setIsPlaying(false); setPlaybackSpeed(1);
        loadNextQuestion(shuffled);
    }, [initialCards, loadNextQuestion]);

    // Kullanıcı bir seçenek seçtiğinde (otomatik okuma için playAudio kullan)
    const handleSelect = useCallback((option) => {
        if (isAnswered || !question || !option?.id) return;

        setSelectedOption(option);
        setIsAnswered(true);

        const correct = option.id === question.id;
        setScore(prev => ({ ...prev, correct: prev.correct + (correct ? 1 : 0), incorrect: prev.incorrect + (correct ? 0 : 1) }));

        // Mevcut sesi durdur
        if (audioRef.current) { audioRef.current.pause(); audioRef.current.currentTime = 0;}
        setIsPlaying(false); setPlaybackSpeed(1);
 
            // question objesinin audioFilename içerdiğini varsayıyoruz
            const correctAudioFilename = question.audioFilename;
            if (correctAudioFilename) {
                 console.log("Yanlış cevap, doğru cevap çalınıyor:", correctAudioFilename);
                 setTimeout(() => {
                    playAudio(correctAudioFilename, 1); // Doğru cevabın dosya adını ve normal hızı gönder
                 }, 50);
            } else {
                 console.warn("Doğru cevap için ses dosyası bulunamadı:", question);
            }
        
    }, [isAnswered, question, playAudio]); // Bağımlılıklar güncellendi

    const handleNextQuestion = useCallback(() => { loadNextQuestion(unaskedCards); }, [loadNextQuestion, unaskedCards]);
useEffect(() => {
    startOrResetQuiz();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialCards]);

    // Audio element olay dinleyicileri
    useEffect(() => {
         const audioElement = audioRef.current; if (!audioElement) return;
         const handlePlay = () => setIsPlaying(true);
         const handlePauseOrEnd = () => setIsPlaying(false);
         const handleError = (e) => { console.error("Quiz Audio Error:", e); toast.error(`Ses dosyası hatası`); setIsPlaying(false); };
         audioElement.addEventListener('play', handlePlay); audioElement.addEventListener('playing', handlePlay); audioElement.addEventListener('pause', handlePauseOrEnd); audioElement.addEventListener('ended', handlePauseOrEnd); audioElement.addEventListener('error', handleError);
         return () => { audioElement.removeEventListener('play', handlePlay); audioElement.removeEventListener('playing', handlePlay); audioElement.removeEventListener('pause', handlePauseOrEnd); audioElement.removeEventListener('ended', handlePauseOrEnd); audioElement.removeEventListener('error', handleError); };
    }, []);

    // --- JSX Render ---
    const quizContainerClasses = `my-5 p-4 border rounded shadow-sm ${darkMode ? 'bg-secondary bg-opacity-25 text-light border-secondary' : 'bg-light text-dark'}`;
    // canSpeak artık question.audioFilename varlığına da bağlı
    const canSpeak = voiceEnabled && question?.audioFilename;

    // 1. Quiz Bitti Ekranı
    if (isQuizFinished) { /* ... önceki gibi ... */ }

    // 2. Quiz Aktif Durumu
    return (
        <div className={quizContainerClasses}>
            {/* Gizli Audio Elementi */}
            <audio ref={audioRef} preload="metadata" />

            {/* Kapat Butonu */}
            <button className="btn btn-sm btn-outline-secondary mb-3 float-end" onClick={onGoBack} title="Quiz'den Çık"> <i className="bi bi-x-lg"></i> </button>
            {/* Başlık ve İlerleme */}
            <h4 className="mb-4 text-center text-primary fw-bold pt-2"> 📚 Mini Quiz ({totalQuestionsInRound > 0 ? totalQuestionsInRound - unaskedCards.length : 0}/{totalQuestionsInRound}) <small className={`d-block fw-normal mt-1 ${darkMode ? 'text-light' : 'text-muted'}`}>{quizCategoryTitle}</small> </h4>
            {/* Ses Uyarısı kaldırıldı */}

            {/* Soru Alanı */}
            {question ? (
                <>
                    <div className="text-center mb-4">
                         {/* Soru Metni */}
                         <p className="lead fs-5 mb-2"> "<strong className={darkMode ? 'text-info' : 'text-primary'}>{question.tr}</strong>" kelimesinin Karadağca karşılığı hangisidir? </p>
                         {/* Seslendirme Butonları (Doğru Cevap İçin - playAudio kullanır) */}
                         {isAnswered && canSpeak && ( // canSpeak kontrolü güncellendi
                              <div className="d-flex justify-content-center gap-2 mt-2">
                                   {/* Normal Hızda Dinle */}
                                   <button type="button" className={`btn btn-sm ${darkMode ? 'btn-outline-light' : 'btn-outline-secondary'} ${isPlaying && playbackSpeed === 1 ? 'active' : ''}`} onClick={() => playAudio(question.audioFilename, 1)} // audioFilename'i gönder
                                       disabled={isPlaying && playbackSpeed !== 1} title={isPlaying && playbackSpeed === 1 ? "Durdur" : "Normal hızda dinle"}> <i className={`bi ${isPlaying && playbackSpeed === 1 ? 'bi-stop-circle-fill' : 'bi-volume-up-fill'}`}></i> </button>
                                   {/* Yavaş Hızda Dinle */}
                                   <button type="button" className={`btn btn-sm ${darkMode ? 'btn-outline-light' : 'btn-outline-secondary'} ${isPlaying && playbackSpeed !== 1 ? 'active' : ''}`} onClick={() => playAudio(question.audioFilename, 0.7)} // audioFilename'i gönder
                                       disabled={isPlaying && playbackSpeed === 1} title={isPlaying && playbackSpeed !== 1 ? "Durdur" : "Yavaş dinle"}> <i className={`bi ${isPlaying && playbackSpeed !== 1 ? 'bi-stop-circle-fill' : 'bi-hourglass-split'}`}></i> <span className="ms-1 d-none d-sm-inline">Yavaş</span> </button>
                              </div>
                         )}
                     </div>
                    {/* Seçenek Butonları */}
                    <div className="d-grid gap-2 col-md-8 mx-auto mb-4"> {options.map((opt) => { if (!opt?.id) return null; const isCorrect = question?.id === opt.id; const isSelected = selectedOption?.id === opt.id; let btnClass = `btn ${darkMode ? 'btn-outline-light' : 'btn-outline-primary'}`; if (isAnswered) { btnClass = isCorrect ? "btn btn-success" : (isSelected ? "btn btn-danger" : `btn ${darkMode ? 'btn-outline-secondary disabled text-muted' : 'btn-secondary disabled text-muted'}`); } return ( <button key={opt.id} className={btnClass} onClick={() => handleSelect(opt)} disabled={isAnswered} aria-pressed={isSelected}>{opt.me}</button> ); })} </div>
                    {/* Sonuç ve Sonraki Buton */}
                    {isAnswered && ( <div className="text-center mt-3 quiz-result-area"> <div className={`mb-2 fw-bold ${selectedOption?.id === question?.id ? 'text-success' : 'text-danger'}`}> {selectedOption?.id === question?.id ? 'Doğru!' : `Yanlış!`} {selectedOption?.id !== question?.id && question?.me && ` Doğrusu: ${question.me}`} </div> <button className="btn btn-primary mt-2" onClick={handleNextQuestion}> Sonraki <i className="bi bi-arrow-right"></i> </button> </div> )}
                </>
            ) : ( <p className="text-center text-warning">Soru yükleniyor...</p> )}
        </div>
    );
}

export default Quiz;