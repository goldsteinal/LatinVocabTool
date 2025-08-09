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
const auth = firebase.auth();
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
let studyDifficultMode = false;

// Get parameters from URL
function getUrlParams() {
    const urlParams = new URLSearchParams(window.location.search);
    return {
        courseId: urlParams.get('courseId'),
        lessonId: urlParams.get('lessonId'),
        mode: urlParams.get('mode')
    };
}

// Initialize app with authentication
document.addEventListener('DOMContentLoaded', function() {
    auth.onAuthStateChanged((user) => {
        if (user) {
            console.log('User signed in:', user.uid);
            showApp();
            initializeStudy();
        } else {
            console.log('No user, signing in anonymously...');
            autoSignIn();
        }
    });
});

// Automatic anonymous sign-in
function autoSignIn() {
    auth.signInAnonymously()
        .then(() => {
            console.log('Anonymous sign-in successful');
            showApp();
            initializeStudy();
        })
        .catch((error) => {
            console.error('Anonymous sign-in failed:', error.message);
            document.getElementById('auth-loading').innerHTML = 'Sign-in failed. Please refresh the page.';
        });
}

// Show the app content
function showApp() {
    document.getElementById('auth-loading').style.display = 'none';
    document.getElementById('app-content').style.display = 'block';
}

// Initialize study after authentication
function initializeStudy() {

const params = getUrlParams();
courseId = params.courseId;
lessonId = params.lessonId;
studyDifficultMode = params.mode === 'difficult';

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
}

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
                    const wordData = { id: doc.id, lessonId: lessonDoc.id, ...doc.data() };
                    // Filter for difficult words if in difficult mode
                    if (!studyDifficultMode || wordData.isDifficult === true) {
                        words.push(wordData);
                    }
                });
            }
            
            if (words.length === 0) {
                const errorMsg = studyDifficultMode ? 
                    'No difficult words found for studying.' : 
                    'No words found for studying.';
                showError(errorMsg);
                return;
            }
            
            startSession();
            return;
        }
        
        const snapshot = await wordsQuery.get();
        words = [];
        snapshot.forEach(doc => {
            const wordData = { id: doc.id, lessonId: lessonId, ...doc.data() };
            // Filter for difficult words if in difficult mode
            if (!studyDifficultMode || wordData.isDifficult === true) {
                words.push(wordData);
            }
        });
        
        if (words.length === 0) {
            const errorMsg = studyDifficultMode ? 
                'No difficult words found for studying.' : 
                'No words found for studying.';
            showError(errorMsg);
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

    // Update page title based on study mode
if (studyDifficultMode) {
    document.title = 'Studying Difficult Words - Latin Vocabulary';
    // You could also update a header element if you have one
}

    // Start first question
    showQuestion();
    updateProgress();
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
    
    // Only add to incorrect words if it's not already there (to handle repeated words)
    const existingIncorrect = incorrectWords.find(w => w.id === word.id);
    if (!existingIncorrect) {
        incorrectWords.push(word);
    }
    
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

// Enhanced spaced repetition algorithm for vocabulary learning


// Calculate word priority for selection with more balanced weighting
function calculateWordPriority(word) {
    const now = new Date();
    const timesAsked = word.timesAsked || 0;
    const correctCount = word.correctCount || 0;
    const incorrectCount = word.incorrectCount || 0;
    const lastStudied = word.lastStudied ? word.lastStudied.toDate() : new Date(0);
    
    // Start with base priority
    let priority = 100;
    
    // 1. Never studied words get moderate boost (not overwhelming)
    if (timesAsked === 0) {
        priority += 50;
    }
    
    // 2. Recently incorrect words get priority
    if (incorrectCount > correctCount) {
        priority += 30;
    }
    
    // 3. Words not studied recently get priority
    const daysSinceStudied = (now - lastStudied) / (1000 * 60 * 60 * 24);
    if (daysSinceStudied > 1) {
        priority += Math.min(daysSinceStudied * 5, 25);
    }
    
    // 4. Low success rate words get some priority
    if (timesAsked > 0) {
        const successRate = correctCount / timesAsked;
        if (successRate < 0.5) {
            priority += 20;
        } else if (successRate < 0.7) {
            priority += 10;
        }
    }
    
    // 5. Large random component for variety (most important!)
    priority += Math.random() * 100;
    
    return priority;
}
// Select words for session using spaced repetition - ALWAYS 10 questions
function selectWordsForSession() {
    const targetQuestions = 10;
    
    if (words.length === 0) {
        return [];
    }
    
    // Track words used in recent sessions (simulate session memory)
    if (!window.recentlyUsedWords) {
        window.recentlyUsedWords = new Map();
    }
    
    // Clean up old entries (older than 10 minutes)
    const currentSession = Date.now();
    for (let [wordId, sessionTime] of window.recentlyUsedWords.entries()) {
        if (currentSession - sessionTime > 1000 * 60 * 10) { // 10 minutes ago
            window.recentlyUsedWords.delete(wordId);
        }
    }
    
    // Calculate priority for each word with recency penalty
    const wordsWithPriority = words.map(word => {
        let priority = calculateWordPriority(word);
        
        // Reduce priority for recently used words
        if (window.recentlyUsedWords.has(word.id)) {
            priority *= 0.3; // Strong penalty for recently used words
        }
        
        return {
            ...word,
            priority
        };
    });
    
    // Sort by priority (highest first)
    wordsWithPriority.sort((a, b) => b.priority - a.priority);
    
    const selectedWords = [];
    const usedWordIds = new Set();
    
    // First pass: select unique words up to target or available words
    for (const word of wordsWithPriority) {
        if (selectedWords.length >= targetQuestions) break;
        if (usedWordIds.has(word.id)) continue;
        
        selectedWords.push({
            ...word,
            instanceId: `${word.id}_0`
        });
        usedWordIds.add(word.id);
        
        // Mark as recently used
        window.recentlyUsedWords.set(word.id, currentSession);
    }
    
    // Second pass: if we need more questions, allow repeats of high-priority words
    if (selectedWords.length < targetQuestions && words.length > 0) {
        let attempts = 0;
        const maxAttempts = targetQuestions * 2;
        
        while (selectedWords.length < targetQuestions && attempts < maxAttempts) {
            // Re-randomize priorities for variety
            const randomizedWords = wordsWithPriority.map(word => ({
                ...word,
                priority: calculateWordPriority(word) // Recalculate with new random component
            })).sort((a, b) => b.priority - a.priority);
            
            for (const word of randomizedWords) {
                if (selectedWords.length >= targetQuestions) break;
                
                // Count how many times this word is already selected
                const currentCount = selectedWords.filter(w => w.id === word.id).length;
                const maxRepetitions = Math.min(3, Math.ceil(targetQuestions / words.length) + 1);
                
                if (currentCount < maxRepetitions) {
                    selectedWords.push({
                        ...word,
                        instanceId: `${word.id}_${currentCount}`
                    });
                }
            }
            attempts++;
        }
    }
    
    // Final shuffle for question order variety
    return shuffleArray(selectedWords.slice(0, targetQuestions));
}

// Utility function to shuffle array
function shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

// Enhanced function to update word statistics (simplified for better real-time performance)
async function updateWordStats(word, isCorrect) {
    try {
        const wordRef = db.collection('courses').doc(courseId)
            .collection('lessons').doc(word.lessonId)
            .collection('words').doc(word.id);
        
        const updateData = {
            lastStudied: firebase.firestore.FieldValue.serverTimestamp(),
            timesAsked: firebase.firestore.FieldValue.increment(1)
        };
        
        if (isCorrect) {
            updateData.correctCount = firebase.firestore.FieldValue.increment(1);
            
            // Handle difficult word tracking for correct answers
            const consecutiveCorrect = (word.consecutiveCorrect || 0) + 1;
            updateData.consecutiveCorrect = consecutiveCorrect;
            
            // Remove from difficult if 3 consecutive correct answers
            if (consecutiveCorrect >= 3 && word.isDifficult === true) {
                updateData.isDifficult = false;
                updateData.consecutiveCorrect = 0;
            }
        } else {
            updateData.incorrectCount = firebase.firestore.FieldValue.increment(1);
            
            // Mark as difficult and reset consecutive correct count
            updateData.isDifficult = true;
            updateData.consecutiveCorrect = 0;
        }
        
        // Update Firebase (async, don't wait)
        wordRef.update(updateData).catch(error => {
            console.log('Failed to update word stats:', error);
        });
        
        // Update local word object immediately for better selection
        word.timesAsked = (word.timesAsked || 0) + 1;
        word.lastStudied = { toDate: () => new Date() };
        
        if (isCorrect) {
            word.correctCount = (word.correctCount || 0) + 1;
            word.consecutiveCorrect = (word.consecutiveCorrect || 0) + 1;
            
            // Update difficult status locally
            if (word.consecutiveCorrect >= 3 && word.isDifficult === true) {
                word.isDifficult = false;
                word.consecutiveCorrect = 0;
            }
        } else {
            word.incorrectCount = (word.incorrectCount || 0) + 1;
            word.isDifficult = true;
            word.consecutiveCorrect = 0;
        }
        
    } catch (error) {
        console.log('Failed to update word stats:', error);
    }
}