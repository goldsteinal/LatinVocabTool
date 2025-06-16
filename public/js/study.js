// Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyCz-MajLlDobaPSk-_5p792EroOcR3cKb4",
  authDomain: "latin-vocabulary-database.firebaseapp.com",
  projectId: "latin-vocabulary-database",
  storageBucket: "latin-vocabulary-database.firebasestorage.app",
  messagingSenderId: "515141891328",
  appId: "1:515141891328:web:7baa0e1d41c8599865afe5",
  measurementId: "G-M7CRLB8LH6"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// Study session variables
let courseId = null;
let lessonId = null;
let studyMode = 'eng-lat'; // 'eng-lat' or 'lat-eng'
let words = [];
let currentQuestion = 0;
let correctAnswers = 0;
let incorrectWords = [];
let sessionWords = [];
let isWaitingForNext = false;

// Get parameters from URL
function getUrlParams() {
    const urlParams = new URLSearchParams(window.location.search);
    return {
        courseId: urlParams.get('courseId'),
        lessonId: urlParams.get('lessonId')
    };
}

// Initialize app
document.addEventListener('DOMContentLoaded', function() {
    const params = getUrlParams();
    courseId = params.courseId;
    lessonId = params.lessonId;
    
    if (!courseId) {
        showError('Invalid study parameters. Redirecting to courses.');
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 2000);
        return;
    }
    
    // Set back button URL
    if (lessonId) {
        document.getElementById('back-btn').href = `lesson.html?courseId=${courseId}&lessonId=${lessonId}`;
    } else {
        document.getElementById('back-btn').href = `course.html?id=${courseId}`;
    }
    
    loadWords();
    setupEventListeners();
});

// Setup event listeners
function setupEventListeners() {
    const answerInput = document.getElementById('answer-input');
    
    answerInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            if (isWaitingForNext) {
                nextQuestion();
            } else {
                checkAnswer();
            }
        }
    });
    
    answerInput.addEventListener('input', function() {
        // Reset input styling when user starts typing
        this.classList.remove('correct', 'incorrect');
        hideFeedback();
    });
}

// Load words from Firebase
async function loadWords() {
    try {
        let wordsQuery;
        
        if (lessonId) {
            // Study specific lesson
            wordsQuery = db.collection('courses').doc(courseId)
                .collection('lessons').doc(lessonId).collection('words');
        } else {
            // Study entire course - need to get all lessons first
            const lessonsSnapshot = await db.collection('courses').doc(courseId)
                .collection('lessons').get();
            
            words = [];
            for (const lessonDoc of lessonsSnapshot.docs) {
                const wordsSnapshot = await db.collection('courses').doc(courseId)
                    .collection('lessons').doc(lessonDoc.id).collection('words').get();
                
                wordsSnapshot.forEach(doc => {
                    words.push({ id: doc.id, lessonId: lessonDoc.id, ...doc.data() });
                });
            }
            
            if (words.length === 0) {
                showError('No words found for studying.');
                return;
            }
            
            startSession();
            return;
        }
        
        const snapshot = await wordsQuery.get();
        words = [];
        snapshot.forEach(doc => {
            words.push({ id: doc.id, lessonId: lessonId, ...doc.data() });
        });
        
        if (words.length === 0) {
            showError('No words found for studying.');
            return;
        }
        
        startSession();
    } catch (error) {
        showError('Failed to load words. Please check your connection.');
    }
}

// Start a new study session
function startSession() {
    // Reset session variables
    currentQuestion = 0;
    correctAnswers = 0;
    incorrectWords = [];
    isWaitingForNext = false;
    
    // Select words for this session using spaced repetition
    sessionWords = selectWordsForSession();
    
    if (sessionWords.length === 0) {
        showError('No words available for studying.');
        return;
    }
    
    // Hide loading screen and show question screen
    document.getElementById('loading-screen').style.display = 'none';
    document.getElementById('question-screen').style.display = 'block';
    document.getElementById('results-screen').style.display = 'none';
    
    // Start first question
    showQuestion();
    updateProgress();
}

// Select words for session using spaced repetition
function selectWordsForSession() {
    const maxWords = Math.min(10, words.length);
    
    // Sort words by priority (incorrect words first, then by difficulty)
    const sortedWords = [...words].sort((a, b) => {
        const aDifficulty = (a.incorrectCount || 0) - (a.correctCount || 0);
        const bDifficulty = (b.incorrectCount || 0) - (b.correctCount || 0);
        
        // Prioritize words with higher difficulty (more incorrect answers)
        if (aDifficulty !== bDifficulty) {
            return bDifficulty - aDifficulty;
        }
        
        // Then by last studied (least recently studied first)
        const aLastStudied = a.lastStudied ? a.lastStudied.toDate() : new Date(0);
        const bLastStudied = b.lastStudied ? b.lastStudied.toDate() : new Date(0);
        
        return aLastStudied - bLastStudied;
    });
    
    return sortedWords.slice(0, maxWords);
}

// Show current question
function showQuestion() {
    if (currentQuestion >= sessionWords.length) {
        showResults();
        return;
    }
    
    const word = sessionWords[currentQuestion];
    const questionText = document.getElementById('question-text');
    const answerInput = document.getElementById('answer-input');
    
    // Clear previous state
    answerInput.value = '';
    answerInput.classList.remove('correct', 'incorrect');
    answerInput.disabled = false;
    hideFeedback();
    
    // Set question based on study mode
    if (studyMode === 'eng-lat') {
        questionText.textContent = word.english;
        answerInput.placeholder = 'Enter Latin translation...';
    } else {
        questionText.textContent = word.latin;
        answerInput.placeholder = 'Enter English translation...';
    }
    
    // Focus on input
    answerInput.focus();
    
    // Update progress
    updateProgress();
}

// Check the user's answer
function checkAnswer() {
    if (isWaitingForNext) return;
    
    const answerInput = document.getElementById('answer-input');
    const userAnswer = answerInput.value.trim().toLowerCase();
    
    if (!userAnswer) return;
    
    const word = sessionWords[currentQuestion];
    let isCorrect = false;
    
    if (studyMode === 'eng-lat') {
        // Exact match required for Latin
        isCorrect = userAnswer === word.latin.toLowerCase();
    } else {
        // Any word match for English
        const englishWords = word.english.toLowerCase().split(/[,;]/).map(w => w.trim());
        const userWords = userAnswer.split(/\s+/);
        
        // Check if any user word matches any English word
        isCorrect = userWords.some(userWord => 
            englishWords.some(engWord => 
                engWord.includes(userWord) || userWord.includes(engWord)
            )
        );
    }
    
    // Update UI and statistics
    if (isCorrect) {
        handleCorrectAnswer(word);
    } else {
        handleIncorrectAnswer(word);
    }
    
    // Update word statistics in Firebase
    updateWordStats(word, isCorrect);
}

// Handle correct answer
function handleCorrectAnswer(word) {
    const answerInput = document.getElementById('answer-input');
    answerInput.classList.add('correct');
    answerInput.disabled = true;
    
    correctAnswers++;
    isWaitingForNext = true;
    
    if (studyMode === 'eng-lat') {
        // Show success feedback and auto-advance after 1 second
        showFeedback('Correct!', 'correct');
        setTimeout(() => {
            nextQuestion();
        }, 1000);
    } else {
        // Show all possible translations and wait for user
        showFeedback('Correct!', 'correct');
        showAllTranslations(word);
        showNextButton();
    }
}

// Handle incorrect answer
function handleIncorrectAnswer(word) {
    const answerInput = document.getElementById('answer-input');
    answerInput.classList.add('incorrect');
    answerInput.disabled = true;
    
    incorrectWords.push(word);
    isWaitingForNext = true;
    
    const correctAnswer = studyMode === 'eng-lat' ? word.latin : word.english;
    showFeedback('Incorrect', 'incorrect', correctAnswer);
    showNextButton();
}

// Show feedback message
function showFeedback(message, type, correctAnswer = null) {
    const feedback = document.getElementById('feedback');
    const feedbackText = document.getElementById('feedback-text');
    const correctAnswerEl = document.getElementById('correct-answer');
    
    feedback.className = `feedback ${type}`;
    feedbackText.textContent = message;
    
    if (correctAnswer) {
        correctAnswerEl.textContent = `Correct answer: ${correctAnswer}`;
        correctAnswerEl.style.display = 'block';
    } else {
        correctAnswerEl.style.display = 'none';
    }
    
    feedback.style.display = 'block';
}

// Show all possible translations for Latin->English mode
function showAllTranslations(word) {
    const translationList = document.getElementById('translation-list');
    const translations = document.getElementById('translations');
    
    const englishTranslations = word.english.split(/[,;]/).map(t => t.trim());
    
    translations.innerHTML = '';
    englishTranslations.forEach(translation => {
        const div = document.createElement('div');
        div.className = 'translation-item';
        div.textContent = translation;
        translations.appendChild(div);
    });
    
    translationList.style.display = 'block';
}

// Hide feedback
function hideFeedback() {
    document.getElementById('feedback').style.display = 'none';
    document.getElementById('translation-list').style.display = 'none';
    document.getElementById('next-btn').style.display = 'none';
}

// Show next button
function showNextButton() {
    const nextBtn = document.getElementById('next-btn');
    nextBtn.style.display = 'block';
    nextBtn.focus();
}

// Go to next question
function nextQuestion() {
    currentQuestion++;
    isWaitingForNext = false;
    showQuestion();
}

// Update progress display
function updateProgress() {
    document.getElementById('progress-counter').textContent = 
        `Question ${currentQuestion + 1} of ${sessionWords.length}`;
    document.getElementById('score-display').textContent = 
        `Score: ${correctAnswers}/${currentQuestion}`;
}

// Set study mode
function setMode(mode) {
    if (isWaitingForNext) return; // Don't allow mode change during feedback
    
    studyMode = mode;
    
    // Update UI
    document.querySelectorAll('.mode-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');
    
    // Restart current question with new mode
    showQuestion();
}

// Update word statistics in Firebase
async function updateWordStats(word, isCorrect) {
    try {
        const wordRef = db.collection('courses').doc(courseId)
            .collection('lessons').doc(word.lessonId)
            .collection('words').doc(word.id);
        
        const updateData = {
            lastStudied: firebase.firestore.FieldValue.serverTimestamp()
        };
        
        if (isCorrect) {
            updateData.correctCount = firebase.firestore.FieldValue.increment(1);
        } else {
            updateData.incorrectCount = firebase.firestore.FieldValue.increment(1);
        }
        
        await wordRef.update(updateData);
    } catch (error) {
        console.log('Failed to update word stats:', error);
    }
}

// Show results screen
function showResults() {
    document.getElementById('question-screen').style.display = 'none';
    document.getElementById('results-screen').style.display = 'block';
    
    const finalScore = document.getElementById('final-score');
    const percentage = Math.round((correctAnswers / sessionWords.length) * 100);
    
    finalScore.textContent = `${correctAnswers}/${sessionWords.length} (${percentage}%)`;
    
    // Set score color based on performance
    if (percentage >= 80) {
        finalScore.className = 'score excellent';
    } else if (percentage >= 60) {
        finalScore.className = 'score good';
    } else {
        finalScore.className = 'score needs-work';
    }
    
    // Show incorrect words if any
    if (incorrectWords.length > 0) {
        const incorrectContainer = document.getElementById('incorrect-words');
        const incorrectList = document.getElementById('incorrect-list');
        
        incorrectList.innerHTML = '';
        incorrectWords.forEach(word => {
            const div = document.createElement('div');
            div.className = 'incorrect-word';
            div.innerHTML = `
                <span><strong>${word.latin}</strong></span>
                <span>${word.english}</span>
            `;
            incorrectList.appendChild(div);
        });
        
        incorrectContainer.style.display = 'block';
    }
}

// Start new session
function startNewSession() {
    startSession();
}

// Finish study and return
function finishStudy() {
    if (lessonId) {
        window.location.href = `lesson.html?courseId=${courseId}&lessonId=${lessonId}`;
    } else {
        window.location.href = `course.html?id=${courseId}`;
    }
}

// Utility functions
function showError(message) {
    const errorDiv = document.getElementById('error-message');
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
    setTimeout(() => {
        errorDiv.style.display = 'none';
    }, 5000);
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}