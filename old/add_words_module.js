// add-words.js - Add Words Module for Latin Vocabulary Trainer

function initializeAddWords() {
    const contentArea = document.getElementById('contentArea');
    
    // Create the Add Words interface HTML
    const addWordsHTML = `
        <div class="section active">
            <div class="section-header">
                <h2 class="section-title">Add New Words</h2>
                <p style="color: var(--text-secondary); font-size: 1.1rem; margin-bottom: 0;">
                    Expand your Latin vocabulary by adding new words and their meanings
                </p>
            </div>
            
            <!-- Statistics Cards -->
            <div class="stats">
                <div class="stat-card">
                    <div class="stat-number" id="totalWordsCount">0</div>
                    <div class="stat-label">Total Words</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number" id="recentlyAddedCount">0</div>
                    <div class="stat-label">Added Today</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number" id="averageScore">0%</div>
                    <div class="stat-label">Avg. Mastery</div>
                </div>
            </div>

            <!-- Add Word Form -->
            <div class="card" style="max-width: 600px; margin: 0 auto;">
                <h3 style="color: var(--text-primary); margin-bottom: 1.5rem; font-size: 1.5rem; font-weight: 600;">
                    Add New Word
                </h3>
                
                <form id="addWordForm">
                    <div class="form-group">
                        <label for="latinWord">Latin Word</label>
                        <input 
                            type="text" 
                            id="latinWord" 
                            name="latinWord" 
                            class="form-input" 
                            placeholder="e.g., amor, virtus, sapientia..."
                            required
                            autocomplete="off"
                        >
                        <small style="color: var(--text-secondary); font-size: 0.875rem; margin-top: 0.25rem; display: block;">
                            Enter the Latin word you want to learn
                        </small>
                    </div>
                    
                    <div class="form-group">
                        <label for="englishMeaning">English Meaning</label>
                        <input 
                            type="text" 
                            id="englishMeaning" 
                            name="englishMeaning" 
                            class="form-input" 
                            placeholder="e.g., love, virtue, wisdom..."
                            required
                            autocomplete="off"
                        >
                        <small style="color: var(--text-secondary); font-size: 0.875rem; margin-top: 0.25rem; display: block;">
                            Enter the English translation or meaning
                        </small>
                    </div>
                    
                    <div class="form-group">
                        <label for="wordType">Word Type (Optional)</label>
                        <select id="wordType" name="wordType" class="form-input">
                            <option value="">Select type...</option>
                            <option value="noun">Noun</option>
                            <option value="verb">Verb</option>
                            <option value="adjective">Adjective</option>
                            <option value="adverb">Adverb</option>
                            <option value="preposition">Preposition</option>
                            <option value="conjunction">Conjunction</option>
                            <option value="interjection">Interjection</option>
                            <option value="phrase">Phrase</option>
                        </select>
                    </div>
                    
                    <div style="display: flex; gap: 1rem; justify-content: center; margin-top: 2rem;">
                        <button type="submit" class="btn" style="min-width: 140px;">
                            ➕ Add Word
                        </button>
                        <button type="button" class="btn secondary" onclick="clearAddWordForm()" style="min-width: 140px;">
                            🗑️ Clear
                        </button>
                    </div>
                </form>
            </div>
            
            <!-- Recent Additions -->
            <div class="card" style="margin-top: 2rem; max-width: 800px; margin-left: auto; margin-right: auto;">
                <h3 style="color: var(--text-primary); margin-bottom: 1.5rem; font-size: 1.5rem; font-weight: 600;">
                    Recently Added Words
                </h3>
                <div id="recentWordsList" style="min-height: 100px;">
                    <!-- Recent words will be populated here -->
                </div>
            </div>
            
            <!-- Success/Error Messages -->
            <div id="messageContainer" style="position: fixed; top: 100px; right: 2rem; z-index: 1000;"></div>
        </div>
    `;
    
    // Inject the HTML
    contentArea.innerHTML = addWordsHTML;
    
    // Initialize the form and load data
    initializeAddWordForm();
    updateStats();
    loadRecentWords();
}

function initializeAddWordForm() {
    const form = document.getElementById('addWordForm');
    
    if (form) {
        form.addEventListener('submit', handleAddWord);
        
        // Add input validation and formatting
        const latinInput = document.getElementById('latinWord');
        const englishInput = document.getElementById('englishMeaning');
        
        // Auto-focus on Latin word input
        latinInput.focus();
        
        // Add real-time validation
        latinInput.addEventListener('input', validateLatinInput);
        englishInput.addEventListener('input', validateEnglishInput);
        
        // Enter key handling for better UX
        latinInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                englishInput.focus();
            }
        });
    }
}

function handleAddWord(event) {
    event.preventDefault();
    
    const form = event.target;
    const formData = new FormData(form);
    
    const latinWord = formData.get('latinWord').trim();
    const englishMeaning = formData.get('englishMeaning').trim();
    const wordType = formData.get('wordType') || '';
    
    // Validation
    if (!latinWord || !englishMeaning) {
        showMessage('Please fill in both Latin word and English meaning.', 'error');
        return;
    }
    
    if (latinWord.length < 2 || englishMeaning.length < 2) {
        showMessage('Words should be at least 2 characters long.', 'error');
        return;
    }
    
    // Check for duplicates
    const existingWords = getStoredWords();
    const isDuplicate = existingWords.some(word => 
        word.latin.toLowerCase() === latinWord.toLowerCase()
    );
    
    if (isDuplicate) {
        showMessage('This Latin word already exists in your vocabulary!', 'warning');
        return;
    }
    
    // Create word object
    const newWord = {
        id: generateUniqueId(),
        latin: latinWord.toLowerCase(),
        english: englishMeaning.toLowerCase(),
        type: wordType,
        dateAdded: new Date().toISOString(),
        lastStudied: null,
        timesStudied: 0,
        correctAnswers: 0,
        incorrectAnswers: 0,
        difficulty: 1, // Default difficulty
        nextReview: new Date().toISOString(), // Available immediately
        mastery: 0 // 0-100 scale
    };
    
    // Save the word
    if (saveWord(newWord)) {
        showMessage(`Successfully added "${latinWord}" to your vocabulary!`, 'success');
        form.reset();
        document.getElementById('latinWord').focus();
        
        // Update UI
        updateStats();
        loadRecentWords();
    } else {
        showMessage('Error saving word. Please try again.', 'error');
    }
}

function validateLatinInput(event) {
    const input = event.target;
    const value = input.value.trim();
    
    // Basic Latin character validation (allow letters, spaces, and common Latin punctuation)
    const latinPattern = /^[a-zA-ZÀ-ÿ\s\-']*$/;
    
    if (value && !latinPattern.test(value)) {
        input.style.borderColor = 'var(--warning-color)';
        showValidationMessage(input, 'Please use only Latin characters');
    } else {
        input.style.borderColor = 'var(--border-color)';
        hideValidationMessage(input);
    }
}

function validateEnglishInput(event) {
    const input = event.target;
    const value = input.value.trim();
    
    // Basic English validation
    const englishPattern = /^[a-zA-Z\s\-',\.]*$/;
    
    if (value && !englishPattern.test(value)) {
        input.style.borderColor = 'var(--warning-color)';
        showValidationMessage(input, 'Please use only English characters');
    } else {
        input.style.borderColor = 'var(--border-color)';
        hideValidationMessage(input);
    }
}

function showValidationMessage(input, message) {
    hideValidationMessage(input); // Remove any existing message
    
    const messageEl = document.createElement('small');
    messageEl.className = 'validation-error';
    messageEl.style.color = 'var(--warning-color)';
    messageEl.style.fontSize = '0.875rem';
    messageEl.style.marginTop = '0.25rem';
    messageEl.style.display = 'block';
    messageEl.textContent = message;
    
    input.parentNode.appendChild(messageEl);
}

function hideValidationMessage(input) {
    const existingMessage = input.parentNode.querySelector('.validation-error');
    if (existingMessage) {
        existingMessage.remove();
    }
}

function clearAddWordForm() {
    const form = document.getElementById('addWordForm');
    if (form) {
        form.reset();
        document.getElementById('latinWord').focus();
        
        // Clear any validation messages
        const validationMessages = form.querySelectorAll('.validation-error');
        validationMessages.forEach(msg => msg.remove());
        
        // Reset input border colors
        const inputs = form.querySelectorAll('.form-input');
        inputs.forEach(input => {
            input.style.borderColor = 'var(--border-color)';
        });
        
        showMessage('Form cleared!', 'info');
    }
}

function updateStats() {
    const words = getStoredWords();
    const today = new Date().toDateString();
    
    // Total words
    document.getElementById('totalWordsCount').textContent = words.length;
    
    // Words added today
    const todayWords = words.filter(word => 
        new Date(word.dateAdded).toDateString() === today
    );
    document.getElementById('recentlyAddedCount').textContent = todayWords.length;
    
    // Average mastery
    const avgMastery = words.length > 0 
        ? Math.round(words.reduce((sum, word) => sum + word.mastery, 0) / words.length)
        : 0;
    document.getElementById('averageScore').textContent = `${avgMastery}%`;
}

function loadRecentWords() {
    const recentWordsList = document.getElementById('recentWordsList');
    const words = getStoredWords();
    
    // Get last 5 words, sorted by date added (newest first)
    const recentWords = words
        .sort((a, b) => new Date(b.dateAdded) - new Date(a.dateAdded))
        .slice(0, 5);
    
    if (recentWords.length === 0) {
        recentWordsList.innerHTML = `
            <p style="color: var(--text-secondary); text-align: center; padding: 2rem; font-style: italic;">
                No words added yet. Add your first Latin word above!
            </p>
        `;
        return;
    }
    
    const recentWordsHTML = recentWords.map(word => `
        <div style="
            display: flex; 
            justify-content: space-between; 
            align-items: center; 
            padding: 1rem; 
            margin-bottom: 0.5rem; 
            background: rgba(255, 255, 255, 0.05); 
            border-radius: 12px; 
            border: 1px solid var(--border-color);
            transition: all 0.3s ease;
        " onmouseover="this.style.background='rgba(255, 255, 255, 0.1)'" onmouseout="this.style.background='rgba(255, 255, 255, 0.05)'">
            <div>
                <div style="font-weight: 600; color: var(--text-primary); font-size: 1.1rem; margin-bottom: 0.25rem;">
                    ${word.latin}
                </div>
                <div style="color: var(--text-secondary); font-size: 0.9rem;">
                    ${word.english}
                    ${word.type ? ` • ${word.type}` : ''}
                </div>
            </div>
            <div style="text-align: right; color: var(--text-secondary); font-size: 0.875rem;">
                ${formatDate(word.dateAdded)}
            </div>
        </div>
    `).join('');
    
    recentWordsList.innerHTML = recentWordsHTML;
}

// Utility Functions
function generateUniqueId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function getStoredWords() {
    try {
        const stored = JSON.parse(localStorage.getItem('latinWords') || '[]');
        return Array.isArray(stored) ? stored : [];
    } catch (error) {
        console.error('Error loading stored words:', error);
        return [];
    }
}

function saveWord(word) {
    try {
        const existingWords = getStoredWords();
        existingWords.push(word);
        localStorage.setItem('latinWords', JSON.stringify(existingWords));
        return true;
    } catch (error) {
        console.error('Error saving word:', error);
        return false;
    }
}

function formatDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) {
        return 'Today';
    } else if (diffDays === 2) {
        return 'Yesterday';
    } else if (diffDays <= 7) {
        return `${diffDays - 1} days ago`;
    } else {
        return date.toLocaleDateString();
    }
}

function showMessage(message, type = 'info') {
    const messageContainer = document.getElementById('messageContainer');
    if (!messageContainer) return;
    
    // Create message element
    const messageEl = document.createElement('div');
    messageEl.style.cssText = `
        padding: 1rem 1.5rem;
        margin-bottom: 0.5rem;
        border-radius: 12px;
        font-weight: 500;
        font-size: 0.95rem;
        box-shadow: 0 8px 25px rgba(0, 0, 0, 0.3);
        backdrop-filter: blur(10px);
        border: 1px solid rgba(255, 255, 255, 0.2);
        animation: slideInRight 0.3s ease-out;
        max-width: 300px;
        word-wrap: break-word;
    `;
    
    // Set color based on type
    switch (type) {
        case 'success':
            messageEl.style.background = 'rgba(16, 185, 129, 0.9)';
            messageEl.style.color = 'white';
            break;
        case 'error':
            messageEl.style.background = 'rgba(239, 68, 68, 0.9)';
            messageEl.style.color = 'white';
            break;
        case 'warning':
            messageEl.style.background = 'rgba(245, 158, 11, 0.9)';
            messageEl.style.color = 'white';
            break;
        default:
            messageEl.style.background = 'rgba(99, 102, 241, 0.9)';
            messageEl.style.color = 'white';
    }
    
    messageEl.textContent = message;
    
    // Add animation styles
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideInRight {
            from {
                transform: translateX(100%);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }
        @keyframes slideOutRight {
            from {
                transform: translateX(0);
                opacity: 1;
            }
            to {
                transform: translateX(100%);
                opacity: 0;
            }
        }
    `;
    document.head.appendChild(style);
    
    messageContainer.appendChild(messageEl);
    
    // Auto-remove after 4 seconds
    setTimeout(() => {
        messageEl.style.animation = 'slideOutRight 0.3s ease-in';
        setTimeout(() => {
            if (messageEl.parentNode) {
                messageEl.parentNode.removeChild(messageEl);
            }
        }, 300);
    }, 4000);
    
    // Remove on click
    messageEl.addEventListener('click', () => {
        messageEl.style.animation = 'slideOutRight 0.3s ease-in';
        setTimeout(() => {
            if (messageEl.parentNode) {
                messageEl.parentNode.removeChild(messageEl);
            }
        }, 300);
    });
}