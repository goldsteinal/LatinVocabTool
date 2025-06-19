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

let courseId = null;
let lessonId = null;
let nouns = [];
let currentQuestion = 0;
let totalQuestions = 10;
let score = 0;
let currentWord = null;
let currentForm = null;
let hasAnswered = false;

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
    document.getElementById('back-btn').href = `course.html?id=${courseId}`;
    
    loadNouns();
    setupEventListeners();
});

// Setup event listeners
function setupEventListeners() {
    document.getElementById('check-answer-btn').addEventListener('click', checkAnswer);
    document.getElementById('next-question-btn').addEventListener('click', nextQuestion);
    
    // Handle Enter key in nominative input
    document.getElementById('nominative-answer').addEventListener('keypress', function(e) {
        if (e.key === 'Enter' && !hasAnswered) {
            checkAnswer();
        }
    });
    
    // Handle case option clicks
    document.querySelectorAll('.case-option').forEach(option => {
        option.addEventListener('click', function() {
            if (!hasAnswered) {
                const checkbox = this.querySelector('input[type="checkbox"]');
                checkbox.checked = !checkbox.checked;
                this.classList.toggle('selected', checkbox.checked);
            }
        });
    });
}

// Load nouns from Firebase
async function loadNouns() {
    try {
        nouns = [];
        
        if (lessonId) {
            // Load nouns from specific lesson
            const snapshot = await db.collection('courses').doc(courseId)
                .collection('lessons').doc(lessonId).collection('words')
                .where('isNoun', '==', true).get();
            
            snapshot.forEach(doc => {
                const wordData = { id: doc.id, ...doc.data() };
                if (wordData.declension && Object.keys(wordData.declension).length > 0) {
                    nouns.push(wordData);
                }
            });
        } else {
            // Load nouns from all lessons in the course
            const lessonsSnapshot = await db.collection('courses').doc(courseId)
                .collection('lessons').get();
            
            for (const lessonDoc of lessonsSnapshot.docs) {
                const wordsSnapshot = await db.collection('courses').doc(courseId)
                    .collection('lessons').doc(lessonDoc.id).collection('words')
                    .where('isNoun', '==', true).get();
                
                wordsSnapshot.forEach(doc => {
                    const wordData = { id: doc.id, ...doc.data() };
                    if (wordData.declension && Object.keys(wordData.declension).length > 0) {
                        nouns.push(wordData);
                    }
                });
            }
        }
        
        if (nouns.length === 0) {
            const context = lessonId ? 'this lesson' : 'this course';
            showError(`No nouns with declensions found in ${context}.`);
            return;
        }
        
        // Adjust total questions if we have fewer nouns
        totalQuestions = Math.min(10, nouns.length * 3); // Up to 3 questions per noun
        
        document.getElementById('loading').style.display = 'none';
        document.getElementById('study-card').style.display = 'flex';
        
        startNewQuestion();
    } catch (error) {
        showError('Failed to load nouns. Please check your connection.');
    }
}

// Start a new question
function startNewQuestion() {
    currentQuestion++;
    hasAnswered = false;
    
    // Update progress
    updateProgress();
    
    // Reset UI
    resetQuestionUI();
    
    // Generate new question
    generateQuestion();
    
    // Show check answer button, hide next button
    document.getElementById('check-answer-btn').style.display = 'inline-block';
    document.getElementById('next-question-btn').style.display = 'none';
}

// Generate a random question
function generateQuestion() {
    // Select random noun
    currentWord = nouns[Math.floor(Math.random() * nouns.length)];
    
    // Get all available declension forms
    const availableForms = [];
    const cases = ['nominative', 'genitive', 'dative', 'accusative', 'ablative'];
    const numbers = ['singular', 'plural'];
    
    cases.forEach(caseName => {
        if (currentWord.declension[caseName]) {
            numbers.forEach(number => {
                const form = currentWord.declension[caseName][number];
                if (form && form.trim()) {
                    availableForms.push({
                        case: caseName,
                        number: number,
                        form: form.trim(),
                        latin: currentWord.latin
                    });
                }
            });
        }
    });
    
    if (availableForms.length === 0) {
        // If no forms available, try another noun
        generateQuestion();
        return;
    }
    
    // Select random form
    currentForm = availableForms[Math.floor(Math.random() * availableForms.length)];
    
    // Display the question
    document.getElementById('latin-word-display').textContent = currentForm.form;
}

// Reset question UI
function resetQuestionUI() {
    // Clear nominative input
    const nominativeInput = document.getElementById('nominative-answer');
    nominativeInput.value = '';
    nominativeInput.style.borderColor = '';
    nominativeInput.style.backgroundColor = '';
    nominativeInput.placeholder = 'e.g., puella, rex, corpus';
    
    // Reset all checkboxes and styling
    document.querySelectorAll('.case-option').forEach(option => {
        const checkbox = option.querySelector('input[type="checkbox"]');
        checkbox.checked = false;
        option.classList.remove('selected', 'correct', 'incorrect', 'missed');
    });
}

// Check the user's answer
function checkAnswer() {
    if (hasAnswered) return;
    hasAnswered = true;
    
    const nominativeAnswer = document.getElementById('nominative-answer').value.trim().toLowerCase();
    const expectedNominative = currentWord.latin.toLowerCase();
    
    // Check nominative form
    const nominativeCorrect = nominativeAnswer === expectedNominative;
    
    // Get user's selected cases
    const userSelections = [];
    document.querySelectorAll('.case-option input[type="checkbox"]:checked').forEach(checkbox => {
        const option = checkbox.closest('.case-option');
        userSelections.push({
            case: option.dataset.case,
            number: option.dataset.number
        });
    });
    
    // Get correct cases for the displayed form
    const correctSelections = getCorrectCases(currentForm.form, currentWord.declension);
    
    // Check case selections
    const caseCorrect = arraysEqual(
        userSelections.sort((a, b) => a.case.localeCompare(b.case) || a.number.localeCompare(b.number)),
        correctSelections.sort((a, b) => a.case.localeCompare(b.case) || a.number.localeCompare(b.number))
    );
    
    // Update UI with feedback
    provideFeedback(nominativeCorrect, caseCorrect, correctSelections);
    
// Update score - both nominative AND all cases must be correct
    if (nominativeCorrect && caseCorrect) {
        score++;
    }

    // Show next button or finish session
    if (currentQuestion >= totalQuestions) {
        setTimeout(() => {
            showResults();
        }, 2000);
    } else {
        document.getElementById('check-answer-btn').style.display = 'none';
        document.getElementById('next-question-btn').style.display = 'inline-block';
    }
}

// Get all correct cases for a given form
function getCorrectCases(form, declension) {
    const correctCases = [];
    const cases = ['nominative', 'genitive', 'dative', 'accusative', 'ablative'];
    const numbers = ['singular', 'plural'];
    
    cases.forEach(caseName => {
        if (declension[caseName]) {
            numbers.forEach(number => {
                const declensionForm = declension[caseName][number];
                if (declensionForm && declensionForm.trim().toLowerCase() === form.toLowerCase()) {
                    correctCases.push({
                        case: caseName,
                        number: number
                    });
                }
            });
        }
    });
    
    return correctCases;
}

// Provide visual feedback on the answer
function provideFeedback(nominativeCorrect, caseCorrect, correctSelections) {
    // Color nominative input
    const nominativeInput = document.getElementById('nominative-answer');
    nominativeInput.style.borderColor = nominativeCorrect ? '#27ae60' : '#e74c3c';
    nominativeInput.style.backgroundColor = nominativeCorrect ? '#d4edda' : '#f8d7da';
    
    // If nominative is wrong, show correct answer
    if (!nominativeCorrect) {
        nominativeInput.placeholder = `Correct: ${currentWord.latin}`;
    }
    
// Color case options
    document.querySelectorAll('.case-option').forEach(option => {
        const checkbox = option.querySelector('input[type="checkbox"]');
        const isSelected = checkbox.checked;
        const isCorrect = correctSelections.some(correct => 
            correct.case === option.dataset.case && correct.number === option.dataset.number
        );
        
        if (isSelected && isCorrect) {
            option.classList.add('correct');
        } else if (isSelected && !isCorrect) {
            option.classList.add('incorrect');
        } else if (!isSelected && isCorrect) {
            option.classList.add('missed');
            // Check the box to show what should have been selected
            checkbox.checked = true;
        }
    });
}

// Compare two arrays for equality - must have exactly the same selections
function arraysEqual(arr1, arr2) {
    if (arr1.length !== arr2.length) return false;
    
    // Check if every item in arr1 exists in arr2
    for (let item1 of arr1) {
        const found = arr2.some(item2 => 
            item1.case === item2.case && item1.number === item2.number
        );
        if (!found) return false;
    }
    
    // Check if every item in arr2 exists in arr1
    for (let item2 of arr2) {
        const found = arr1.some(item1 => 
            item1.case === item2.case && item1.number === item2.number
        );
        if (!found) return false;
    }
    
    return true;
}

// Move to next question
function nextQuestion() {
    startNewQuestion();
}

// Update progress bar and text
function updateProgress() {
    const progressPercent = (currentQuestion / totalQuestions) * 100;
    document.getElementById('progress-fill').style.width = `${progressPercent}%`;
    document.getElementById('progress-text').textContent = `Question ${currentQuestion} of ${totalQuestions}`;
    document.getElementById('score-text').textContent = `Score: ${score}/${currentQuestion - 1}`;
}

// Show final results
function showResults() {
    document.getElementById('study-card').style.display = 'none';
    document.getElementById('results-section').style.display = 'block';
    
    const percentage = Math.round((score / totalQuestions) * 100);
    const finalScoreEl = document.getElementById('final-score');
    const feedbackEl = document.getElementById('feedback-message');
    
    finalScoreEl.textContent = `${score}/${totalQuestions} (${percentage}%)`;
    
    if (percentage >= 90) {
        finalScoreEl.className = 'score-display excellent';
        feedbackEl.textContent = 'Excellent work! You have mastered these declensions.';
    } else if (percentage >= 70) {
        finalScoreEl.className = 'score-display good';
        feedbackEl.textContent = 'Good job! Keep practicing to improve your accuracy.';
    } else {
        finalScoreEl.className = 'score-display needs-practice';
        feedbackEl.textContent = 'Keep studying! Regular practice will help you improve.';
    }
}

// Start a new study session
function startNewSession() {
    currentQuestion = 0;
    score = 0;
    hasAnswered = false;
    
    document.getElementById('results-section').style.display = 'none';
    document.getElementById('study-card').style.display = 'flex';
    
    startNewQuestion();
}

// Go back to course
function goBackToCourse() {
    window.location.href = `course.html?id=${courseId}`;
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