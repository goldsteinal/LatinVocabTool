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

let courseId = null;
let lessonId = null;
let lesson = null;
let words = {};
let currentEditingWord = null;

// Get parameters from URL
function getUrlParams() {
    const urlParams = new URLSearchParams(window.location.search);
    return {
        courseId: urlParams.get('courseId'),
        lessonId: urlParams.get('lessonId')
    };
}

// Initialize app with authentication
document.addEventListener('DOMContentLoaded', function() {
    auth.onAuthStateChanged((user) => {
        if (user) {
            console.log('User signed in:', user.uid);
            showApp();
            initializeLesson();
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
            initializeLesson();
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

// Initialize lesson after authentication
function initializeLesson() {
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
}

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
    div.className = `word-item${word.isNoun ? ' noun' : ''}`;
    
    let declensionTable = '';
    if (word.isNoun && word.declension) {
        declensionTable = createDeclensionTable(word.declension, word.id);
    }
  // Build action buttons - always 4 buttons for alignment
let actionButtons = `
    <button class="edit" onclick="editWord('${word.id}')">Edit</button>
    <button class="delete" onclick="deleteWord('${word.id}')">Delete</button>
`;

if (word.isNoun) {
    actionButtons += `
        <button class="symbol-btn" onclick="editDeclension('${word.id}')" title="Edit Declension">📝</button>
        <button class="symbol-btn show-declension" onclick="toggleDeclension('${word.id}')" title="Show Declension">👁️</button>
    `;
} else {
    actionButtons += `
        <button class="symbol-btn invisible" style="visibility: hidden;">📝</button>
        <button class="symbol-btn invisible" style="visibility: hidden;">👁️</button>
    `;
}
    
    div.innerHTML = `
        <div class="latin-word">
            <div class="latin-word-content">
                <span>${word.latin}</span>
            </div>
            ${word.isNoun ? '<div class="noun-indicator">noun</div>' : ''}
        </div>
        <div class="english-word">${escapeHtml(word.english)}</div>
        <div class="word-actions">
            ${actionButtons}
        </div>
        ${declensionTable}
    `;
    
    return div;
}

// Create declension table HTML
function createDeclensionTable(declension, wordId) {
    const cases = ['nominative', 'genitive', 'dative', 'accusative', 'ablative'];
    let tableRows = '';
    
    cases.forEach(caseName => {
        const caseData = declension[caseName];
        if (caseData) {
            tableRows += `
                <tr>
                    <td class="case-name">${capitalize(caseName)}</td>
                    <td>${caseData.singular || '—'}</td>
                    <td>${caseData.plural || '—'}</td>
                </tr>
            `;
        }
    });
    
    return `
        <div class="declension-table-container" id="declension-${wordId}" style="display: none;">
            <table class="declension-table">
                <thead>
                    <tr>
                        <th>Case</th>
                        <th>Singular</th>
                        <th>Plural</th>
                    </tr>
                </thead>
                <tbody>
                    ${tableRows}
                </tbody>
            </table>
        </div>
    `;
}

// Toggle declension table visibility
function toggleDeclension(wordId) {
    const table = document.getElementById(`declension-${wordId}`);
    const button = table.parentElement.querySelector('.show-declension');
    
    if (table.style.display === 'none') {
        table.style.display = 'table';
        button.innerHTML = '🙈';
        button.title = 'Hide Declension';
    } else {
        table.style.display = 'none';
        button.innerHTML = '👁️';
        button.title = 'Show Declension';
    }
}

// Update lesson statistics
function updateLessonStats() {
    const wordCount = Object.keys(words).length;
    const nounCount = Object.values(words).filter(word => word.isNoun).length;
    
    const statsElement = document.getElementById('lesson-stats');
    statsElement.textContent = `${wordCount} word pairs${nounCount > 0 ? ` (${nounCount} nouns)` : ''}`;
    
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
    const nounCheckbox = document.getElementById('noun-checkbox');
    
    const latin = latinInput.value.trim();
    const english = englishInput.value.trim();
    const isNoun = nounCheckbox.checked;
    
    if (!latin || !english) {
        showError('Please enter both Latin and English words.');
        return;
    }

    // Show loading if fetching declension
    if (isNoun) {
        showDeclensionLoading();
    }

    try {
        const timestamp = Date.now();
        let wordData = {
            latin: latin,
            english: english,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            timestamp: timestamp,
            difficulty: 0,
            lastStudied: null,
            correctCount: 0,
            incorrectCount: 0,
            isNoun: isNoun
        };

        // Fetch declension if it's a noun
        if (isNoun) {
            try {
                const declension = await fetchLatinDeclension(latin);
                if (declension && declension.length > 0) {
                    wordData.declension = convertDeclensionArrayToObject(declension);
                }
            } catch (declensionError) {
                console.log('Failed to fetch declension:', declensionError);
                // Continue without declension data
            }
        }
        
        const docRef = await db.collection('courses').doc(courseId)
            .collection('lessons').doc(lessonId).collection('words').add(wordData);
        
        words[docRef.id] = {
            id: docRef.id,
            ...wordData
        };
        
        latinInput.value = '';
        englishInput.value = '';
        nounCheckbox.checked = false;
        
        displayWords();
        updateLessonStats();
        hideError();
    } catch (error) {
        showError('Failed to add word. Please try again.');
    } finally {
        hideDeclensionLoading();
    }
}

// Convert declension array to object format for storage
function convertDeclensionArrayToObject(declensionArray) {
    const declensionObj = {};
    declensionArray.forEach(item => {
        declensionObj[item.case] = {
            singular: item.singular,
            plural: item.plural
        };
    });
    return declensionObj;
}

// Edit word pair
async function editWord(wordId) {
    const word = words[wordId];
    
    const newLatin = prompt('Enter Latin word(s):', word.latin);
    if (newLatin === null) return;
    
    const newEnglish = prompt('Enter English translation:', word.english);
    if (newEnglish === null) return;
    
    const wasNoun = word.isNoun;
    const isNoun = confirm('Is this a noun?');
    
    if (newLatin.trim() && newEnglish.trim()) {
        try {
            let updateData = {
                latin: newLatin.trim(),
                english: newEnglish.trim(),
                isNoun: isNoun
            };

            // If changing from non-noun to noun, or Latin word changed for noun
            if (isNoun && (!wasNoun || newLatin.trim() !== word.latin)) {
                try {
                    const declension = await fetchLatinDeclension(newLatin.trim());
                    if (declension && declension.length > 0) {
                        updateData.declension = convertDeclensionArrayToObject(declension);
                    }
                } catch (declensionError) {
                    console.log('Failed to fetch declension:', declensionError);
                }
            }

            // If changing from noun to non-noun, remove declension
            if (!isNoun && wasNoun) {
                updateData.declension = firebase.firestore.FieldValue.delete();
            }
            
            await db.collection('courses').doc(courseId)
                .collection('lessons').doc(lessonId)
                .collection('words').doc(wordId).update(updateData);
            
            // Update local copy
            Object.assign(words[wordId], updateData);
            if (!isNoun && wasNoun) {
                delete words[wordId].declension;
            }
            
            displayWords();
            hideError();
        } catch (error) {
            showError('Failed to update word.');
        }
    }
}

// Edit declension in modal
function editDeclension(wordId) {
    const word = words[wordId];
    if (!word.isNoun) return;
    
    currentEditingWord = wordId;
    const modal = document.getElementById('declension-modal');
    const modalTitle = document.getElementById('modal-title');
    const form = document.getElementById('declension-form');
    
    modalTitle.textContent = `Edit Declension - ${word.latin}`;
    
    // Create form fields
    const cases = ['nominative', 'genitive', 'dative', 'accusative', 'ablative'];
    form.innerHTML = '';
    
    cases.forEach(caseName => {
        const caseData = word.declension ? word.declension[caseName] : {};
        
        const formRow = document.createElement('div');
        formRow.className = 'form-row';
        formRow.innerHTML = `
            <label>${capitalize(caseName)}</label>
            <input type="text" id="edit-${caseName}-singular" placeholder="Singular" value="${caseData.singular || ''}" />
            <input type="text" id="edit-${caseName}-plural" placeholder="Plural" value="${caseData.plural || ''}" />
        `;
        form.appendChild(formRow);
    });
    
    modal.style.display = 'flex';
}

// Save declension changes
async function saveDeclension() {
    if (!currentEditingWord) return;
    
    const cases = ['nominative', 'genitive', 'dative', 'accusative', 'ablative'];
    const declension = {};
    
    cases.forEach(caseName => {
        const singular = document.getElementById(`edit-${caseName}-singular`).value.trim();
        const plural = document.getElementById(`edit-${caseName}-plural`).value.trim();
        
        if (singular || plural) {
            declension[caseName] = {
                singular: singular,
                plural: plural
            };
        }
    });
    
    try {
        await db.collection('courses').doc(courseId)
            .collection('lessons').doc(lessonId)
            .collection('words').doc(currentEditingWord).update({
                declension: declension
            });
        
        words[currentEditingWord].declension = declension;
        displayWords();
        closeDeclensionModal();
        hideError();
    } catch (error) {
        showError('Failed to save declension.');
    }
}

// Close declension modal
function closeDeclensionModal() {
    document.getElementById('declension-modal').style.display = 'none';
    currentEditingWord = null;
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
        content += `${word.latin} | ${word.english}${word.isNoun ? ' | NOUN' : ''}\n`;
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
                    const timestamp = Date.now() + imported;
                    const isNoun = parts.length > 2 && parts[2].toUpperCase() === 'NOUN';
                    
                    let wordData = {
                        latin: parts[0],
                        english: parts[1],
                        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                        timestamp: timestamp,
                        difficulty: 0,
                        lastStudied: null,
                        correctCount: 0,
                        incorrectCount: 0,
                        isNoun: isNoun
                    };

                    // Fetch declension if it's a noun
                    if (isNoun) {
                        try {
                            const declension = await fetchLatinDeclension(parts[0]);
                            if (declension && declension.length > 0) {
                                wordData.declension = convertDeclensionArrayToObject(declension);
                            }
                        } catch (declensionError) {
                            console.log('Failed to fetch declension for', parts[0]);
                        }
                    }
                    
                    const docRef = await db.collection('courses').doc(courseId)
                        .collection('lessons').doc(lessonId).collection('words').add(wordData);
                    
                    words[docRef.id] = {
                        id: docRef.id,
                        ...wordData
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

// Show/hide declension loading
function showDeclensionLoading() {
    document.getElementById('declension-loading').style.display = 'block';
}

function hideDeclensionLoading() {
    document.getElementById('declension-loading').style.display = 'none';
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

function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
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

// Close modal when clicking outside
document.getElementById('declension-modal').addEventListener('click', function(e) {
    if (e.target === this) {
        closeDeclensionModal();
    }
});