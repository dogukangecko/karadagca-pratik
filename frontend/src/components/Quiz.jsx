// src/components/Quiz.jsx
import React, { useState, useCallback, useEffect, useRef } from "react";
import 'bootstrap-icons/font/bootstrap-icons.css';
import { toast } from 'react-toastify';
import api from '../utils/api'; // Keep this import - it IS used in the save results effect

// Fisher-Yates Shuffle Algorithm
function shuffleArray(array) {
    const newArray = Array.isArray(array) ? [...array] : [];
    if (newArray.length === 0) return [];
    let currentIndex = newArray.length, randomIndex;
    while (currentIndex !== 0) {
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex--;
        [newArray[currentIndex], newArray[randomIndex]] = [
            newArray[randomIndex], newArray[currentIndex]];
    }
    return newArray;
}


function Quiz({ cards: initialCards, voiceEnabled, darkMode, onGoBack, quizId }) {
    // --- State Management ---
    const [question, setQuestion] = useState(null);
    const [options, setOptions] = useState([]);
    const [selectedOption, setSelectedOption] = useState(null);
    const [isAnswered, setIsAnswered] = useState(false);
    const [unaskedCards, setUnaskedCards] = useState([]);
    const [score, setScore] = useState({ correct: 0, incorrect: 0 });
    const [isQuizFinished, setIsQuizFinished] = useState(false);
    const [totalQuestionsInRound, setTotalQuestionsInRound] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [playbackSpeed, setPlaybackSpeed] = useState(1);
    const [quizCategoryTitle, setQuizCategoryTitle] = useState('');
    const [quizLevel, setQuizLevel] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    // --- Refs ---
    const audioRef = useRef(null);
    const hasSavedResult = useRef(false);
    const quizContainerRef = useRef(null);
    const nextButtonRef = useRef(null);

    // --- Functions ---

    // Function to play audio
    const playAudio = useCallback((audioFilename, speed = 1) => {
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
                audioElement.load();
            }
            audioElement.playbackRate = speed;
            audioElement.play().catch(error => {
                 console.error("Quiz Audio playback error:", error);
                 toast.error("Ses dosyası çalınamadı.");
                 setIsPlaying(false);
            });
            setPlaybackSpeed(speed);
        }
   }, [voiceEnabled, isPlaying]);

    // Function to load the next question
    const loadNextQuestion = useCallback((currentUnaskedCards) => {
        if (!currentUnaskedCards || currentUnaskedCards.length === 0) {
            if (!isQuizFinished) {
                setIsQuizFinished(true);
            }
            return;
        }
        const nextQuestion = currentUnaskedCards[0];
        const remainingCards = currentUnaskedCards.slice(1);
        setUnaskedCards(remainingCards);
        setQuestion(nextQuestion); // Set the new question state
        const otherCards = initialCards.filter(card => card?.id && nextQuestion?.id && card.id !== nextQuestion.id);
        const shuffledOthers = shuffleArray(otherCards).slice(0, 3);
        const currentOptions = shuffleArray([...shuffledOthers, nextQuestion]);
        setOptions(currentOptions);
        setSelectedOption(null);
        setIsAnswered(false); // Reset answered state for the new question
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
        }
        setIsPlaying(false);
        setPlaybackSpeed(1);
   }, [initialCards, isQuizFinished]);

    // Function to start or reset the quiz
    const startOrResetQuiz = useCallback(() => {
        if (!initialCards || !Array.isArray(initialCards) || initialCards.length < 4) { toast.error("Quiz başlatılamadı: En az 4 kart gereklidir."); setIsQuizFinished(true); return; }
        const validCards = initialCards.filter(c => c?.id);
        if (validCards.length < 4) { toast.error("Quiz başlatılamadı: En az 4 geçerli kart gereklidir."); setIsQuizFinished(true); return; }
        const firstCardCategory = validCards[0]?.category || 'Bilinmeyen Kategori';
        const firstCardLevel = validCards[0]?.level || 'Bilinmiyor';
        setQuizCategoryTitle(firstCardCategory);
        setQuizLevel(firstCardLevel);
        const shuffled = shuffleArray(validCards);
        setUnaskedCards(shuffled);
        setTotalQuestionsInRound(shuffled.length);
        setScore({ correct: 0, incorrect: 0 });
        setIsQuizFinished(false);
        setSelectedOption(null);
        setIsAnswered(false);
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
        }
        setIsPlaying(false);
        setPlaybackSpeed(1);
        hasSavedResult.current = false;
        setIsSaving(false);
        loadNextQuestion(shuffled);
   }, [initialCards, loadNextQuestion]);

    // Function to handle user selecting an option
    const handleSelect = useCallback((option) => {
        if (isAnswered || !question || !option?.id) return;
        setSelectedOption(option);
        setIsAnswered(true); // This state change triggers the answer scroll effect
        const correct = option.id === question.id;
        setScore(prev => ({ correct: prev.correct + (correct ? 1 : 0), incorrect: prev.incorrect + (correct ? 0 : 1) }));
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
        }
        setIsPlaying(false);
        setPlaybackSpeed(1);
        const correctAudioFilename = question.audioFilename;
        if (correctAudioFilename) {
            // console.log("Answer submitted, playing audio:", correctAudioFilename, "Was correct:", correct);
            // Directly call setTimeout without assigning its ID
            setTimeout(() => {
                 playAudio(correctAudioFilename, 1);
            }, 150);
        } else {
            console.warn("Audio file not found for this question, cannot play:", question);
        }
   }, [isAnswered, question, playAudio]);

    // Function to handle clicking the "Next" button
    const handleNextQuestion = useCallback(() => {
        loadNextQuestion(unaskedCards);
    }, [loadNextQuestion, unaskedCards]);


    // --- Effects ---

    // Effect to start the quiz
    useEffect(() => {
        startOrResetQuiz();
        return () => {
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current.src = ''; // Clear src to prevent potential issues
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [initialCards]);


    // Effect for audio element event listeners
    useEffect(() => {
        const audioElement = audioRef.current;
        if (!audioElement) return;
        const handlePlay = () => setIsPlaying(true);
        const handlePauseOrEnd = () => setIsPlaying(false);
        const handleError = (e) => {
            console.error("Quiz Audio Element Error:", e);
            toast.error(`Ses dosyası yüklenirken/çalınırken hata oluştu.`);
            setIsPlaying(false);
        };
        audioElement.addEventListener('play', handlePlay);
        audioElement.addEventListener('playing', handlePlay);
        audioElement.addEventListener('pause', handlePauseOrEnd);
        audioElement.addEventListener('ended', handlePauseOrEnd);
        audioElement.addEventListener('error', handleError);
        // Cleanup function to remove listeners when component unmounts
        return () => {
            audioElement.removeEventListener('play', handlePlay);
            audioElement.removeEventListener('playing', handlePlay);
            audioElement.removeEventListener('pause', handlePauseOrEnd);
            audioElement.removeEventListener('ended', handlePauseOrEnd);
            audioElement.removeEventListener('error', handleError);
        };
    }, []);


    // Effect to save results when quiz finishes
    useEffect(() => {
        // Conditions: Quiz must be finished, result not already saved, not currently saving
        if (isQuizFinished && !hasSavedResult.current && !isSaving) {
            const finalScore = score;
            const finalTotal = totalQuestionsInRound;

            // Validate necessary data before attempting API call
            if (quizId && finalTotal > 0 && quizCategoryTitle && quizLevel) {
                setIsSaving(true); // Set saving indicator
                hasSavedResult.current = true; // Mark as saved immediately

                const resultData = {
                    quizId,
                    categoryTitle: quizCategoryTitle,
                    level: quizLevel,
                    correct: finalScore.correct,
                    incorrect: finalScore.incorrect,
                    total: finalTotal
                };
                console.log("Attempting to save quiz result:", resultData);

                // Make API call to save results
                api.post('/api/quiz/results/save', resultData)
                    .then(response => {
                        toast.success(`Quiz sonucu başarıyla kaydedildi!`);
                        console.log("Quiz result saved successfully:", response.data);
                    })
                    .catch(error => {
                        console.error("Error saving quiz result:", error.response?.data || error.message);
                        toast.error("Quiz sonucu kaydedilirken bir hata oluştu.");
                    })
                    .finally(() => {
                        setIsSaving(false); // Remove saving indicator
                    });
            } else {
                 // Log and notify user if data is missing for saving
                 console.warn("Quiz result not saved due to missing data or invalid state:", { quizId, finalTotal, quizCategoryTitle, quizLevel, score });
                 toast.info(`Quiz tamamlandı! Skor: ${finalScore.correct} / ${finalTotal}. (Sonuç kaydedilmedi - bilgi eksik)`);
                 hasSavedResult.current = true; // Still mark as "handled"
            }
        }
    }, [isQuizFinished, quizId, quizCategoryTitle, quizLevel, score, totalQuestionsInRound, isSaving]);


    // Effect to scroll "Next" button into CENTER view when answer is submitted
    useEffect(() => {
        // Only scroll if the question *has just been answered* and the next button ref exists
        if (isAnswered && nextButtonRef.current) {
            // console.log("Scrolling Next button into center view due to answer"); // Debugging log
            const scrollTimer = setTimeout(() => {
                // Use scrollIntoView on the button itself, aiming for the center
                nextButtonRef.current.scrollIntoView({
                    behavior: 'smooth',
                    block: 'center' // <<< Try centering the button in the viewport
                });
            }, 50); // Short delay to ensure button is rendered
             return () => clearTimeout(scrollTimer); // Cleanup timer
        }
    }, [isAnswered]); // Dependency is only isAnswered


    // --- JSX Render ---
    const quizContainerClasses = `my-5 p-4 border rounded shadow-sm ${darkMode ? 'bg-secondary bg-opacity-25 text-light border-secondary' : 'bg-light text-dark'}`;

    // 1. Render Quiz Finished Screen
    if (isQuizFinished) {
        return (
            <div ref={quizContainerRef} className={quizContainerClasses}>
                {/* --- Finished Screen Content --- */}
                <h4 className="text-center mb-3 text-success fw-bold">🎉 Quiz Tamamlandı! 🎉</h4>
                <div className="text-center mb-4">
                    <p className="fs-5 mb-1">Kategori: <strong>{quizCategoryTitle}</strong></p>
                    <p className="fs-5">Seviye: <strong>{quizLevel}</strong></p>
                    <hr className="my-3"/>
                    <p className="fs-4">Skorunuz:
                       <strong className="mx-2 text-primary">{score.correct} / {totalQuestionsInRound}</strong>
                       ({totalQuestionsInRound > 0 ? Math.round((score.correct / totalQuestionsInRound) * 100) : 0}%)
                    </p>
                    <div className="d-flex justify-content-center gap-4 mt-2">
                         <span className="text-success"><i className="bi bi-check-circle-fill me-1"></i>Doğru: {score.correct}</span>
                         <span className="text-danger"><i className="bi bi-x-octagon-fill me-1"></i>Yanlış: {score.incorrect}</span>
                    </div>
                    {isSaving && (
                        <div className="text-center mt-3">
                            <div className="spinner-border spinner-border-sm text-secondary" role="status"></div>
                            <span className="ms-2 text-muted">Sonuç kaydediliyor...</span>
                        </div>
                    )}
                </div>
                <div className="d-flex justify-content-center gap-3 mt-4">
                    <button className="btn btn-info" onClick={startOrResetQuiz} disabled={isSaving}>
                        <i className="bi bi-arrow-clockwise"></i> Tekrar Başla
                    </button>
                    <button className="btn btn-secondary" onClick={onGoBack} disabled={isSaving}>
                         <i className="bi bi-arrow-left-circle"></i> Geri Dön
                    </button>
                </div>
            </div>
        );
    }

    // 2. Render Active Quiz Screen
    return (
        <div ref={quizContainerRef} className={quizContainerClasses}>
             {/* Hidden Audio Element */}
             <audio ref={audioRef} preload="metadata" />
             {/* Close Button */}
            <button className="btn btn-sm btn-outline-secondary mb-3 float-end" onClick={onGoBack} title="Quiz'den Çık">
                <i className="bi bi-x-lg"></i>
            </button>
              {/* Header */}
             <h4 className="mb-4 text-center text-primary fw-bold pt-2">
                📚 Mini Quiz ({totalQuestionsInRound > 0 ? (totalQuestionsInRound - unaskedCards.length) : 0}/{totalQuestionsInRound})
                <small className={`d-block fw-normal mt-1 ${darkMode ? 'text-light' : 'text-muted'}`}>{quizCategoryTitle} - {quizLevel}</small>
            </h4>
             {/* Question Area */}
             {question ? (
                <>
                    {/* Question Text & Audio Buttons */}
                    <div className="text-center mb-4">
                         <p className="lead fs-5 mb-2">
                            "<strong className={darkMode ? 'text-info' : 'text-primary'}>{question.tr}</strong>" kelimesinin Karadağca karşılığı hangisidir?
                         </p>
                         {isAnswered && question.audioFilename && (
                              <div className="d-flex justify-content-center gap-2 mt-2">
                                   {/* Normal Speed Button */}
                                   <button type="button" className={`btn btn-sm ${darkMode ? 'btn-outline-light' : 'btn-outline-secondary'} ${isPlaying && playbackSpeed === 1 ? 'active' : ''}`} onClick={() => playAudio(question.audioFilename, 1)} disabled={isPlaying && playbackSpeed !== 1} title={isPlaying && playbackSpeed === 1 ? "Durdur" : "Cevabı dinle"}> <i className={`bi ${isPlaying && playbackSpeed === 1 ? 'bi-stop-circle-fill' : 'bi-volume-up-fill'}`}></i> </button>
                                   {/* Slow Speed Button */}
                                   <button type="button" className={`btn btn-sm ${darkMode ? 'btn-outline-light' : 'btn-outline-secondary'} ${isPlaying && playbackSpeed !== 1 ? 'active' : ''}`} onClick={() => playAudio(question.audioFilename, 0.7)} disabled={isPlaying && playbackSpeed === 1} title={isPlaying && playbackSpeed !== 1 ? "Durdur" : "Cevabı yavaş dinle"}> <i className={`bi ${isPlaying && playbackSpeed !== 1 ? 'bi-stop-circle-fill' : 'bi-hourglass-split'}`}></i> <span className="ms-1 d-none d-sm-inline">Yavaş</span> </button>
                              </div>
                         )}
                     </div>
                      {/* Options Buttons */}
                    <div className="d-grid gap-2 col-md-8 mx-auto mb-4">
                        {options.map((opt) => {
                            if (!opt?.id) return null;
                            const isCorrectAnswer = question?.id === opt.id;
                            const isSelectedAnswer = selectedOption?.id === opt.id;
                            let btnClass = `btn ${darkMode ? 'btn-outline-light' : 'btn-outline-primary'}`;
                            if (isAnswered) {
                                if (isCorrectAnswer) { btnClass = "btn btn-success"; }
                                else if (isSelectedAnswer) { btnClass = "btn danger"; } // Typo fixed: btn-danger
                                else { btnClass = `btn ${darkMode ? 'btn-outline-secondary disabled text-muted' : 'btn-secondary disabled text-muted'}`; }
                            }
                            return ( <button key={opt.id} className={btnClass} onClick={() => handleSelect(opt)} disabled={isAnswered} aria-pressed={isSelectedAnswer}>{opt.me}</button> );
                        })}
                    </div>
                      {/* Result Feedback and Next Button */}
                    {isAnswered && (
                         <div className="text-center mt-3 quiz-result-area">
                            <div className={`mb-2 fw-bold ${selectedOption?.id === question?.id ? 'text-success' : 'text-danger'}`}>
                                {selectedOption?.id === question?.id ? ( <><i className="bi bi-check-circle-fill me-1"></i>Doğru!</> ) : ( <> <i className="bi bi-x-octagon-fill me-1"></i>Yanlış! {question?.me && ` Doğrusu: ${question.me}`} </> )}
                            </div>
                            {/* Attach ref to the Next Button */}
                            <button
                                ref={nextButtonRef} // Ref is attached here
                                className="btn btn-primary mt-2"
                                onClick={handleNextQuestion}
                            >
                                 Sonraki <i className="bi bi-arrow-right"></i>
                            </button>
                        </div>
                     )}
                </>
            ) : (
                 // Loading state
                 <div className="text-center py-5">
                     <div className="spinner-border text-primary" role="status">
                         <span className="visually-hidden">Yükleniyor...</span>
                     </div>
                     <p className="mt-2">Quiz yükleniyor...</p>
                 </div>
             )}
        </div>
    );
}

export default Quiz;