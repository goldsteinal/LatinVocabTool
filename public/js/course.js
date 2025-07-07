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
let course = null;
let lessons = {};

// Get course ID from URL parameters
function getCourseIdFromUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('id');
}

// Initialize app with authentication
document.addEventListener('DOMContentLoaded', function() {
    auth.onAuthStateChanged((user) => {
        if (user) {
            console.log('User signed in:', user.uid);
            showApp();
            initializeCourse();
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
            initializeCourse();
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

// Initialize course after authentication
function initializeCourse() {
    courseId = getCourseIdFromUrl();
    
    if (!courseId) {
        showError('No course specified. Redirecting to home page.');
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 2000);
        return;
    }
    
    loadCourse();
    loadLessons();
}

// Load course information
async function loadCourse() {
    try {
        const doc = await db.collection('courses').doc(courseId).get();
        
        if (!doc.exists) {
            showError('Course not found. Redirecting to home page.');
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 2000);
            return;
        }
        
        course = { id: doc.id, ...doc.data() };
        document.getElementById('course-name').textContent = course.name;
        updateCourseStats();
    } catch (error) {
        showError('Failed to load course information.');
    }
}

// Load lessons from Firebase
async function loadLessons() {
    try {
        // Order by timestamp (numeric) to maintain consistent order
        const snapshot = await db.collection('courses').doc(courseId).collection('lessons')
            .orderBy('timestamp', 'asc').get();
        lessons = {};
        
        // Load lessons and count words in each
        for (const doc of snapshot.docs) {
            const lessonData = doc.data();
            
            // Count words and nouns in this lesson
const wordsSnapshot = await db.collection('courses').doc(courseId)
    .collection('lessons').doc(doc.id).collection('words').get();

let nounCount = 0;
wordsSnapshot.forEach(doc => {
    const wordData = doc.data();
    if (wordData.isNoun === true) {
        nounCount++;
    }
});

lessons[doc.id] = {
    id: doc.id,
    ...lessonData,
    wordCount: wordsSnapshot.size,
    nounCount: nounCount
};
        }
        
        displayLessons();
        updateCourseStats();
    } catch (error) {
        showError('Failed to load lessons. Please check your connection.');
    }
}

// Display lessons in the UI
function displayLessons() {
    const container = document.getElementById('lessons-container');
    const loading = document.getElementById('loading');
    
    loading.style.display = 'none';
    container.innerHTML = '';

    if (Object.keys(lessons).length === 0) {
        container.innerHTML = '<div class="loading">No lessons yet. Create your first lesson above!</div>';
        return;
    }

    // Sort lessons by timestamp to maintain consistent order
    const sortedLessons = Object.values(lessons).sort((a, b) => {
        // Use timestamp for reliable ordering
        const timeA = a.timestamp || 0;
        const timeB = b.timestamp || 0;
        return timeA - timeB;
    });

    sortedLessons.forEach(lesson => {
        const lessonElement = createLessonElement(lesson);
        container.appendChild(lessonElement);
    });
}

// Create lesson element
function createLessonElement(lesson) {
    const div = document.createElement('div');
    div.className = 'lesson-item';
    div.innerHTML = `
        <div class="lesson-info" onclick="openLesson('${lesson.id}')">
            <div class="lesson-name">${escapeHtml(lesson.name)}</div>
            <div class="lesson-stats">${lesson.wordCount || 0} words</div>
        </div>
        <div class="lesson-actions">
            <button class="study" onclick="studyLesson('${lesson.id}')" ${lesson.wordCount === 0 ? 'disabled' : ''}>
                Study
            </button>
            <button class="edit" onclick="editLesson('${lesson.id}')">Edit</button>
            <button class="delete" onclick="deleteLesson('${lesson.id}')">Delete</button>
        </div>
    `;
    return div;
}

// Update course statistics
function updateCourseStats() {
    const lessonCount = Object.keys(lessons).length;
    const totalWords = Object.values(lessons).reduce((sum, lesson) => sum + (lesson.wordCount || 0), 0);
    const totalNouns = Object.values(lessons).reduce((sum, lesson) => sum + (lesson.nounCount || 0), 0);
    
    const statsElement = document.getElementById('course-stats');
    statsElement.textContent = `${lessonCount} lessons • ${totalWords} words total • ${totalNouns} nouns`;
    
    // Enable/disable study buttons
    const studyBtn = document.getElementById('study-all-btn');
    const declensionsBtn = document.getElementById('study-declensions-btn');
    studyBtn.disabled = totalWords === 0;
    declensionsBtn.disabled = totalNouns === 0;
    
    // Update course in Firebase with current stats
    if (course) {
        db.collection('courses').doc(courseId).update({
            lessonCount: lessonCount,
            wordCount: totalWords,
            nounCount: totalNouns
        }).catch(error => {
            console.log('Failed to update course stats:', error);
        });
    }
}

// Add new lesson
async function addLesson() {
    const nameInput = document.getElementById('lesson-name');
    const name = nameInput.value.trim();
    
    if (!name) {
        showError('Please enter a lesson name.');
        return;
    }

    try {
        const timestamp = Date.now(); // Use numeric timestamp for reliable ordering
        
        const docRef = await db.collection('courses').doc(courseId).collection('lessons').add({
            name: name,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            timestamp: timestamp, // Add numeric timestamp for ordering
            wordCount: 0
        });
        
        lessons[docRef.id] = {
            id: docRef.id,
            name: name,
            wordCount: 0,
            timestamp: timestamp
        };
        
        nameInput.value = '';
        displayLessons();
        updateCourseStats();
        hideError();
    } catch (error) {
        showError('Failed to add lesson. Please try again.');
    }
}

// Edit lesson name
async function editLesson(lessonId) {
    const lesson = lessons[lessonId];
    const newName = prompt('Enter new lesson name:', lesson.name);
    
    if (newName && newName.trim() !== lesson.name) {
        try {
            await db.collection('courses').doc(courseId).collection('lessons').doc(lessonId).update({
                name: newName.trim()
            });
            
            lessons[lessonId].name = newName.trim();
            displayLessons();
            hideError();
        } catch (error) {
            showError('Failed to update lesson name.');
        }
    }
}

// Delete lesson
async function deleteLesson(lessonId) {
    const lesson = lessons[lessonId];
    
    if (confirm(`Are you sure you want to delete "${lesson.name}"? This will remove all words in this lesson.`)) {
        try {
            // Delete all words in the lesson
            const wordsSnapshot = await db.collection('courses').doc(courseId)
                .collection('lessons').doc(lessonId).collection('words').get();
            
            const batch = db.batch();
            wordsSnapshot.forEach(doc => {
                batch.delete(doc.ref);
            });
            
            // Delete the lesson
            batch.delete(db.collection('courses').doc(courseId).collection('lessons').doc(lessonId));
            
            await batch.commit();
            
            delete lessons[lessonId];
            displayLessons();
            updateCourseStats();
            hideError();
        } catch (error) {
            showError('Failed to delete lesson.');
        }
    }
}

// Open lesson (navigate to lesson page)
function openLesson(lessonId) {
    window.location.href = `lesson.html?courseId=${courseId}&lessonId=${lessonId}`;
}

// Study specific lesson
function studyLesson(lessonId) {
    window.location.href = `study.html?courseId=${courseId}&lessonId=${lessonId}`;
}

// Study entire course
function studyCourse() {
    window.location.href = `study.html?courseId=${courseId}`;
}

// Study noun declensions for the course
function studyNounDeclensions() {
    window.location.href = `study-declensions.html?courseId=${courseId}&lessonId=`;
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

// Handle Enter key in input
document.getElementById('lesson-name').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        addLesson();
    }
});