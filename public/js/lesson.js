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
let lesson = null;
let words = {};

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
    
    if (!courseId || !lessonId) {
        showError('Invalid lesson parameters. Redirecting to courses.');
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 2000);
        return;
    }
    
    // Set back button URL
    document.getElementById('back-btn').href = `course.html?id=${courseId}`;
    
    loadLesson();
    loadWords();
});

// Load lesson information
async function loadLesson() {
    try {
        const doc = await db.collection('courses').doc(courseId)
            .collection('lessons').doc(lessonId).get();
        
        if (!doc.exists) {
            showError('Lesson not found. Redirecting to course.');
            setTimeout(() => {
                window.location.href = `course.html?id=${courseId}`;
            }, 2000);
            return;
        }
        
        lesson = { id: doc.id, ...doc.data() };
        document.getElementById('lesson-name').textContent = lesson.name;
        updateLessonStats();
    } catch (error) {
        showError('Failed to load lesson information.');
    }
}

// Load words from Firebase
async function loadWords() {
    try {
        // Order by timestamp to maintain consistent order
        const snapshot = await db.collection('courses').doc(courseId)
            .collection('lessons').doc(lessonId).collection('words')
            .orderBy('timestamp', 'asc').get();
        
        words = {};
        snapshot.forEach(doc => {
            words[doc.id] = { id: doc.id, ...doc.data() };
        });
        
        displayWords();
        updateLessonStats();
    } catch (error) {
        showError('Failed to load words. Please check your connection.');
    }
}

// Display words in the UI
function displayWords() {
    const container = document.getElementById('words-container');
    const loading = document.getElementById('loading');
    
    loading.style.display = 'none';
    container.innerHTML = '';

    if (Object.keys(words).length === 0) {
        container.innerHTML = '<div class="loading">No words yet. Add your first word pair above!</div>';
        return;
    }

    // Sort words by timestamp to maintain consistent order
    const sortedWords = Object.values(words).sort((a, b) => {
        // Use timestamp for reliable ordering
        const timeA = a.timestamp || 0;
        const timeB = b.timestamp || 0;
        return timeA - timeB;
    });

    sortedWords.forEach(word => {
        const wordElement = createWordElement(word);
        container.appendChild(wordElement);
    });
}

// Create word element
function createWordElement(word) {
    const div = document.createElement('div');
    div.className = 'word-item';
    div.innerHTML = `
        <div class="latin-word">${escapeHtml(word.latin)}</div>
        <div class="english-word">${escapeHtml(word.english)}</div>
        <div class="word-actions">
            <button class="edit" onclick="editWord('${word.id}')">Edit</button>
            <button class="delete" onclick="deleteWord('${word.id}')">Delete</button>
        </div>
    `;
    return div;
}

// Update lesson statistics
function updateLessonStats() {
    const wordCount = Object.keys(words).length;
    
    const statsElement = document.getElementById('lesson-stats');
    statsElement.textContent = `${wordCount} word pairs`;
    
    // Enable/disable buttons based on word count
    const studyBtn = document.getElementById('study-btn');
    const exportBtn = document.getElementById('export-btn');
    
    studyBtn.disabled = wordCount === 0;
    exportBtn.disabled = wordCount === 0;
    
    // Update lesson word count in Firebase
    if (lesson) {
        db.collection('courses').doc(courseId)
            .collection('lessons').doc(lessonId).update({
                wordCount: wordCount
            }).catch(error => {
                console.log('Failed to update lesson stats:', error);
            });
    }
}

// Add new word pair
async function addWord() {
    const latinInput = document.getElementById('latin-input');
    const englishInput = document.getElementById('english-input');
    
    const latin = latinInput.value.trim();
    const english = englishInput.value.trim();
    
    if (!latin || !english) {
        showError('Please enter both Latin and English words.');
        return;
    }

    try {
        const timestamp = Date.now(); // Use numeric timestamp for reliable ordering
        
        const docRef = await db.collection('courses').doc(courseId)
            .collection('lessons').doc(lessonId).collection('words').add({
                latin: latin,
                english: english,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                timestamp: timestamp, // Add numeric timestamp for ordering
                difficulty: 0,
                lastStudied: null,
                correctCount: 0,
                incorrectCount: 0
            });
        
        words[docRef.id] = {
            id: docRef.id,
            latin: latin,
            english: english,
            timestamp: timestamp,
            difficulty: 0,
            correctCount: 0,
            incorrectCount: 0
        };
        
        latinInput.value = '';
        englishInput.value = '';
        
        displayWords();
        updateLessonStats();
        hideError();
    } catch (error) {
        showError('Failed to add word. Please try again.');
    }
}

// Edit word pair
async function editWord(wordId) {
    const word = words[wordId];
    
    const newLatin = prompt('Enter Latin word(s):', word.latin);
    if (newLatin === null) return;
    
    const newEnglish = prompt('Enter English translation:', word.english);
    if (newEnglish === null) return;
    
    if (newLatin.trim() && newEnglish.trim() && 
        (newLatin.trim() !== word.latin || newEnglish.trim() !== word.english)) {
        
        try {
            await db.collection('courses').doc(courseId)
                .collection('lessons').doc(lessonId)
                .collection('words').doc(wordId).update({
                    latin: newLatin.trim(),
                    english: newEnglish.trim()
                });
            
            words[wordId].latin = newLatin.trim();
            words[wordId].english = newEnglish.trim();
            
            displayWords();
            hideError();
        } catch (error) {
            showError('Failed to update word.');
        }
    }
}

// Delete word pair
async function deleteWord(wordId) {
    const word = words[wordId];
    
    if (confirm(`Are you sure you want to delete "${word.latin}" → "${word.english}"?`)) {
        try {
            await db.collection('courses').doc(courseId)
                .collection('lessons').doc(lessonId)
                .collection('words').doc(wordId).delete();
            
            delete words[wordId];
            displayWords();
            updateLessonStats();
            hideError();
        } catch (error) {
            showError('Failed to delete word.');
        }
    }
}

// Export words to text file
function exportWords() {
    if (Object.keys(words).length === 0) {
        showError('No words to export.');
        return;
    }
    
    // Sort words for export to maintain consistent order
    const sortedWords = Object.values(words).sort((a, b) => {
        const timeA = a.timestamp || 0;
        const timeB = b.timestamp || 0;
        return timeA - timeB;
    });
    
    let content = '';
    sortedWords.forEach(word => {
        content += `${word.latin} | ${word.english}\n`;
    });
    
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `${lesson.name}_words.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    URL.revokeObjectURL(url);
}

// Import words from text file
async function importWords(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = async function(e) {
        const content = e.target.result;
        const lines = content.split('\n').filter(line => line.trim());
        
        let imported = 0;
        let errors = 0;
        
        for (const line of lines) {
            const parts = line.split('|').map(part => part.trim());
            
            if (parts.length >= 2 && parts[0] && parts[1]) {
                try {
                    const timestamp = Date.now() + imported; // Ensure unique timestamps for imported words
                    
                    const docRef = await db.collection('courses').doc(courseId)
                        .collection('lessons').doc(lessonId).collection('words').add({
                            latin: parts[0],
                            english: parts[1],
                            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                            timestamp: timestamp,
                            difficulty: 0,
                            lastStudied: null,
                            correctCount: 0,
                            incorrectCount: 0
                        });
                    
                    words[docRef.id] = {
                        id: docRef.id,
                        latin: parts[0],
                        english: parts[1],
                        timestamp: timestamp,
                        difficulty: 0,
                        correctCount: 0,
                        incorrectCount: 0
                    };
                    
                    imported++;
                } catch (error) {
                    errors++;
                }
            } else {
                errors++;
            }
        }
        
        displayWords();
        updateLessonStats();
        
        if (imported > 0) {
            hideError();
            alert(`Successfully imported ${imported} words${errors > 0 ? ` (${errors} errors)` : ''}.`);
        } else {
            showError('No valid words found in file. Please check the format.');
        }
    };
    
    reader.readAsText(file);
    event.target.value = ''; // Reset file input
}

// Launch study session for this lesson
function studyLesson() {
    window.location.href = `study.html?courseId=${courseId}&lessonId=${lessonId}`;
}

// Utility functions
function showError(message) {
    const errorDiv = document.getElementById('error-message');
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
    setTimeout(hideError, 5000);
}

function hideError() {
    document.getElementById('error-message').style.display = 'none';
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Handle Enter key in inputs
document.getElementById('latin-input').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        document.getElementById('english-input').focus();
    }
});

document.getElementById('english-input').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        addWord();
    }
});