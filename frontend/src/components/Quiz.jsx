// components/Quiz.jsx
import React, { useState, useCallback, useEffect, useRef } from "react";
import 'bootstrap-icons/font/bootstrap-icons.css';
import { toast } from 'react-toastify';
import api from '../utils/api';

// Fisher-Yates Shuffle Algorithm
function shuffleArray(array) {
    const newArray = Array.isArray(array) ? [...array] : [];
    if (newArray.length === 0) return [];
    let currentIndex = newArray.length, randomIndex;

    // While there remain elements to shuffle.
    while (currentIndex !== 0) {
        // Pick a remaining element.
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex--;

        // And swap it with the current element.
        [newArray[currentIndex], newArray[randomIndex]] = [
            newArray[randomIndex], newArray[currentIndex]];
    }
    return newArray;
}


function Quiz({ cards: initialCards, voiceEnabled, darkMode, onGoBack, quizId }) {
    // --- State Management ---
    const [question, setQuestion] = useState(null); // Current question card object
    const [options, setOptions] = useState([]); // Array of options for the current question
    const [selectedOption, setSelectedOption] = useState(null); // The option the user selected
    const [isAnswered, setIsAnswered] = useState(false); // Flag if the current question has been answered
    const [unaskedCards, setUnaskedCards] = useState([]); // Array of cards yet to be asked
    const [score, setScore] = useState({ correct: 0, incorrect: 0 }); // Quiz score
    const [isQuizFinished, setIsQuizFinished] = useState(false); // Flag if the quiz is complete
    const [totalQuestionsInRound, setTotalQuestionsInRound] = useState(0); // Total questions in this quiz round
    const [isPlaying, setIsPlaying] = useState(false); // Flag if audio is currently playing
    const [playbackSpeed, setPlaybackSpeed] = useState(1); // Audio playback speed (1 or 0.7)
    const [quizCategoryTitle, setQuizCategoryTitle] = useState(''); // Category title for the quiz
    const [quizLevel, setQuizLevel] = useState(''); // Level for the quiz
    const [isSaving, setIsSaving] = useState(false); // Flag if the result is being saved to the backend

    // --- Refs ---
    const audioRef = useRef(null); // Ref for the <audio> element
    const hasSavedResult = useRef(false); // Ref to track if the result has been saved (prevents multiple saves)
    const quizContainerRef = useRef(null); // Ref for the main quiz container div (for scrolling)

    // --- Functions ---

    // Function to scroll the quiz container to the bottom
    const scrollToBottom = useCallback(() => {
        // Use setTimeout to ensure the DOM has updated before scrolling
        const timer = setTimeout(() => {
            if (quizContainerRef.current) {
                quizContainerRef.current.scrollTo({
                    top: quizContainerRef.current.scrollHeight,
                    behavior: 'smooth' // Use 'auto' for instant scroll if preferred
                });
                console.log("Scrolled to bottom");
            }
        }, 50); // Delay in ms, adjust if necessary
        return () => clearTimeout(timer); // Cleanup timer on unmount or re-run
    }, []); // No dependencies needed, relies on the ref

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

         // If already playing the same audio at the same speed, stop it
         if (isPlaying && audioElement.playbackRate === speed && audioElement.src.endsWith(targetSrc)) {
             audioElement.pause();
             audioElement.currentTime = 0;
         } else {
             // Pause any current audio
             audioElement.pause();
             // Set new source if different
             if (!audioElement.src || !audioElement.src.endsWith(targetSrc)) {
                 audioElement.src = targetSrc;
                 audioElement.load(); // Load the new source
             }
             // Set playback speed and play
             audioElement.playbackRate = speed;
             audioElement.play().catch(error => {
                  console.error("Quiz Audio playback error:", error);
                  toast.error("Ses dosyası çalınamadı.");
                  setIsPlaying(false); // Reset playing state on error
             });
             setPlaybackSpeed(speed); // Update state to reflect current speed
         }
    }, [voiceEnabled, isPlaying]); // Dependencies: voiceEnabled state, isPlaying state

    // Function to load the next question
    const loadNextQuestion = useCallback((currentUnaskedCards) => {
        // Check if there are any cards left to ask
        if (!currentUnaskedCards || currentUnaskedCards.length === 0) {
            if (!isQuizFinished) { // Only trigger finish state if not already finished
                setIsQuizFinished(true); // Set state to indicate quiz is finished
            }
            return; // Stop execution
        }

        // Get the next question and update the remaining cards
        const nextQuestion = currentUnaskedCards[0];
        const remainingCards = currentUnaskedCards.slice(1);
        setUnaskedCards(remainingCards);
        setQuestion(nextQuestion); // *** Setting the question triggers the scroll useEffect ***

        // Prepare options: Filter out the current question, shuffle others, add current question back, shuffle all
        const otherCards = initialCards.filter(card => card?.id && nextQuestion?.id && card.id !== nextQuestion.id);
        const shuffledOthers = shuffleArray(otherCards).slice(0, 3); // Get 3 other options
        const currentOptions = shuffleArray([...shuffledOthers, nextQuestion]); // Combine and shuffle
        setOptions(currentOptions);

        // Reset state for the new question
        setSelectedOption(null);
        setIsAnswered(false);

        // Stop any currently playing audio
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
        }
        setIsPlaying(false);
        setPlaybackSpeed(1);

    }, [initialCards, isQuizFinished]); // Dependencies: initialCards, isQuizFinished state

    // Function to start or reset the quiz
    const startOrResetQuiz = useCallback(() => {
         // Validate initial cards
         if (!initialCards || !Array.isArray(initialCards) || initialCards.length < 4) {
             toast.error("Quiz başlatılamadı: En az 4 kart gereklidir.");
             setIsQuizFinished(true); // Go directly to finished state if invalid
             return;
         }
         const validCards = initialCards.filter(c => c?.id); // Ensure cards have IDs
         if (validCards.length < 4) {
             toast.error("Quiz başlatılamadı: En az 4 geçerli kart gereklidir.");
             setIsQuizFinished(true);
             return;
         }

         // Get category and level from the first valid card (assuming consistency)
         const firstCardCategory = validCards[0]?.category || 'Bilinmeyen Kategori';
         const firstCardLevel = validCards[0]?.level || 'Bilinmiyor';
         setQuizCategoryTitle(firstCardCategory);
         setQuizLevel(firstCardLevel);

         // Shuffle cards and set initial state
         const shuffled = shuffleArray(validCards);
         setUnaskedCards(shuffled);
         setTotalQuestionsInRound(shuffled.length);
         setScore({ correct: 0, incorrect: 0 });
         setIsQuizFinished(false);
         setSelectedOption(null);
         setIsAnswered(false);

         // Reset audio state
         if (audioRef.current) {
             audioRef.current.pause();
             audioRef.current.currentTime = 0;
         }
         setIsPlaying(false);
         setPlaybackSpeed(1);

         // Reset save flag and indicator
         hasSavedResult.current = false;
         setIsSaving(false);

         // Load the first question
         loadNextQuestion(shuffled);

    }, [initialCards, loadNextQuestion]); // Dependencies: initialCards, loadNextQuestion function

    // Function to handle user selecting an option
    const handleSelect = useCallback((option) => {
        // Prevent action if already answered or invalid state
        if (isAnswered || !question || !option?.id) return;

        setSelectedOption(option); // Mark the selected option
        setIsAnswered(true); // Mark question as answered
        const correct = option.id === question.id; // Check if the answer is correct

        // Update score
        setScore(prev => ({
            ...prev,
            correct: prev.correct + (correct ? 1 : 0),
            incorrect: prev.incorrect + (correct ? 0 : 1)
        }));

        // Stop any currently playing audio
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
        }
        setIsPlaying(false);
        setPlaybackSpeed(1);

        // Get the audio filename for the correct answer (the question card)
        const correctAudioFilename = question.audioFilename;

        // Play the audio for the correct answer if available (regardless of user's correctness)
        if (correctAudioFilename) {
             console.log("Answer submitted, playing audio:", correctAudioFilename, "Was correct:", correct);
            // Play audio after a short delay to allow UI updates
            const playTimer = setTimeout(() => {
                 playAudio(correctAudioFilename, 1); // Play at normal speed
            }, 150); // Delay in ms
            // No need for cleanup here as it's a one-off timeout
        } else {
            console.warn("Audio file not found for this question, cannot play:", question);
        }

    }, [isAnswered, question, playAudio]); // Dependencies: isAnswered state, current question, playAudio function


    // Function to handle clicking the "Next" button
    const handleNextQuestion = useCallback(() => {
        loadNextQuestion(unaskedCards); // Load the next question using remaining cards
    }, [loadNextQuestion, unaskedCards]); // Dependencies: loadNextQuestion function, unaskedCards state


    // --- Effects ---

    // Effect to start the quiz when the component mounts or initialCards change
    useEffect(() => {
        startOrResetQuiz();
        // Cleanup function to stop audio if component unmounts mid-quiz
        return () => {
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current.src = ''; // Clear src to prevent potential issues
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [initialCards]); // Rerun only if initialCards prop changes


    // Effect to set up audio element event listeners
    useEffect(() => {
         const audioElement = audioRef.current;
         if (!audioElement) return; // Exit if ref is not set yet

         // Define event handlers
         const handlePlay = () => setIsPlaying(true);
         const handlePauseOrEnd = () => setIsPlaying(false);
         const handleError = (e) => {
             console.error("Quiz Audio Element Error:", e);
             toast.error(`Ses dosyası yüklenirken/çalınırken hata oluştu.`);
             setIsPlaying(false);
         };

         // Add event listeners
         audioElement.addEventListener('play', handlePlay);
         audioElement.addEventListener('playing', handlePlay); // Handles cases where 'play' fires before actual playback
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
    }, []); // Run only once on mount


    // Effect to save the quiz results when the quiz finishes
    useEffect(() => {
        // Conditions: Quiz must be finished, result not already saved, not currently saving
        if (isQuizFinished && !hasSavedResult.current && !isSaving) {
            const finalScore = score;
            const finalTotal = totalQuestionsInRound;

            // Validate necessary data before attempting API call
            if (quizId && finalTotal > 0 && quizCategoryTitle && quizLevel) {
                setIsSaving(true); // Set saving indicator
                hasSavedResult.current = true; // Mark as saved immediately to prevent multiple attempts

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
                        // Optional: Could reset hasSavedResult.current = false here to allow retry, but might lead to duplicates if API call actually succeeded but response failed.
                    })
                    .finally(() => {
                        setIsSaving(false); // Remove saving indicator regardless of success/failure
                    });
            } else {
                 // Log and notify user if data is missing for saving
                 console.warn("Quiz result not saved due to missing data or invalid state:", { quizId, finalTotal, quizCategoryTitle, quizLevel, score });
                 toast.info(`Quiz tamamlandı! Skor: ${finalScore.correct} / ${finalTotal}. (Sonuç kaydedilmedi - bilgi eksik)`);
                 // Still mark as saved conceptually to prevent retries in this session
                 hasSavedResult.current = true;
            }
        }
    }, [isQuizFinished, quizId, quizCategoryTitle, quizLevel, score, totalQuestionsInRound, isSaving]); // Dependencies for the save effect


    // Effect to scroll to the bottom when the question changes
    useEffect(() => {
        // Only scroll if a question is loaded (quiz active) and the container ref exists
        if (question && quizContainerRef.current) {
            scrollToBottom();
        }
        // Trigger this effect whenever the question state changes
    }, [question, scrollToBottom]); // Dependencies: current question, scrollToBottom function


    // --- JSX Render ---
    const quizContainerClasses = `my-5 p-4 border rounded shadow-sm ${darkMode ? 'bg-secondary bg-opacity-25 text-light border-secondary' : 'bg-light text-dark'}`;

    // -------------------------------------
    // 1. Render Quiz Finished Screen
    // -------------------------------------
    if (isQuizFinished) {
        return (
            // Attach ref for potential future use, though scrolling isn't needed here
            <div ref={quizContainerRef} className={quizContainerClasses}>
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
                    {/* Show saving indicator if saving */}
                    {isSaving && (
                        <div className="text-center mt-3">
                            <div className="spinner-border spinner-border-sm text-secondary" role="status"></div>
                            <span className="ms-2 text-muted">Sonuç kaydediliyor...</span>
                        </div>
                    )}
                </div>
                <div className="d-flex justify-content-center gap-3 mt-4">
                    {/* Disable buttons while saving */}
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

    // -------------------------------------
    // 2. Render Active Quiz Screen
    // -------------------------------------
    return (
        // Attach ref to the main container for scrolling control
        <div ref={quizContainerRef} className={quizContainerClasses}>
            {/* Hidden Audio Element */}
            <audio ref={audioRef} preload="metadata" />

            {/* Close Button */}
            <button className="btn btn-sm btn-outline-secondary mb-3 float-end" onClick={onGoBack} title="Quiz'den Çık">
                <i className="bi bi-x-lg"></i>
            </button>

             {/* Header: Title and Progress */}
             <h4 className="mb-4 text-center text-primary fw-bold pt-2">
                📚 Mini Quiz ({totalQuestionsInRound > 0 ? (totalQuestionsInRound - unaskedCards.length) : 0}/{totalQuestionsInRound})
                <small className={`d-block fw-normal mt-1 ${darkMode ? 'text-light' : 'text-muted'}`}>{quizCategoryTitle} - {quizLevel}</small>
            </h4>

            {/* Question Area */}
            {question ? (
                <>
                    {/* Question Text and Audio Buttons */}
                    <div className="text-center mb-4">
                         <p className="lead fs-5 mb-2">
                            "<strong className={darkMode ? 'text-info' : 'text-primary'}>{question.tr}</strong>" kelimesinin Karadağca karşılığı hangisidir?
                         </p>
                         {/* Show audio buttons only AFTER answer and if audio exists */}
                         {isAnswered && question.audioFilename && (
                              <div className="d-flex justify-content-center gap-2 mt-2">
                                   {/* Normal Speed Button */}
                                   <button
                                        type="button"
                                        className={`btn btn-sm ${darkMode ? 'btn-outline-light' : 'btn-outline-secondary'} ${isPlaying && playbackSpeed === 1 ? 'active' : ''}`}
                                        onClick={() => playAudio(question.audioFilename, 1)}
                                        disabled={isPlaying && playbackSpeed !== 1} // Disable if slow is playing
                                        title={isPlaying && playbackSpeed === 1 ? "Durdur" : "Cevabı dinle"}
                                    >
                                        <i className={`bi ${isPlaying && playbackSpeed === 1 ? 'bi-stop-circle-fill' : 'bi-volume-up-fill'}`}></i>
                                   </button>
                                   {/* Slow Speed Button */}
                                   <button
                                        type="button"
                                        className={`btn btn-sm ${darkMode ? 'btn-outline-light' : 'btn-outline-secondary'} ${isPlaying && playbackSpeed !== 1 ? 'active' : ''}`}
                                        onClick={() => playAudio(question.audioFilename, 0.7)}
                                        disabled={isPlaying && playbackSpeed === 1} // Disable if normal is playing
                                        title={isPlaying && playbackSpeed !== 1 ? "Durdur" : "Cevabı yavaş dinle"}
                                    >
                                        <i className={`bi ${isPlaying && playbackSpeed !== 1 ? 'bi-stop-circle-fill' : 'bi-hourglass-split'}`}></i>
                                        <span className="ms-1 d-none d-sm-inline">Yavaş</span>
                                   </button>
                              </div>
                         )}
                     </div>

                    {/* Options Buttons */}
                    <div className="d-grid gap-2 col-md-8 mx-auto mb-4">
                        {options.map((opt) => {
                            if (!opt?.id) return null; // Skip if option is invalid
                            const isCorrectAnswer = question?.id === opt.id;
                            const isSelectedAnswer = selectedOption?.id === opt.id;
                            // Determine button class based on answered state
                            let btnClass = `btn ${darkMode ? 'btn-outline-light' : 'btn-outline-primary'}`;
                            if (isAnswered) {
                                if (isCorrectAnswer) {
                                    btnClass = "btn btn-success"; // Correct answer always green
                                } else if (isSelectedAnswer) {
                                    btnClass = "btn btn-danger"; // Incorrect selected answer red
                                } else {
                                    // Unselected, incorrect options are muted/disabled
                                    btnClass = `btn ${darkMode ? 'btn-outline-secondary disabled text-muted' : 'btn-secondary disabled text-muted'}`;
                                }
                            }
                            return (
                                <button
                                    key={opt.id}
                                    className={btnClass}
                                    onClick={() => handleSelect(opt)}
                                    disabled={isAnswered} // Disable all buttons after answering
                                    aria-pressed={isSelectedAnswer} // Indicate selection for accessibility
                                >
                                    {opt.me}
                                </button>
                            );
                        })}
                    </div>

                    {/* Result Feedback and Next Button */}
                    {isAnswered && (
                         <div className="text-center mt-3 quiz-result-area">
                            {/* Correct/Incorrect Feedback */}
                            <div className={`mb-2 fw-bold ${selectedOption?.id === question?.id ? 'text-success' : 'text-danger'}`}>
                                {selectedOption?.id === question?.id ? (
                                    <><i className="bi bi-check-circle-fill me-1"></i>Doğru!</>
                                ) : (
                                    <>
                                        <i className="bi bi-x-octagon-fill me-1"></i>Yanlış!
                                        {/* Show the correct answer if wrong */}
                                        {question?.me && ` Doğrusu: ${question.me}`}
                                    </>
                                )}
                            </div>
                            {/* Next Question Button */}
                            <button className="btn btn-primary mt-2" onClick={handleNextQuestion}>
                                 Sonraki <i className="bi bi-arrow-right"></i>
                            </button>
                        </div>
                     )}
                </>
            ) : (
                 // Loading state while the first question is being prepared
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