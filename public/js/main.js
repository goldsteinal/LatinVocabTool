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

let courses = {};

// Initialize app with authentication
document.addEventListener('DOMContentLoaded', function() {
    auth.onAuthStateChanged((user) => {
        if (user) {
            console.log('User signed in:', user.uid);
            showApp();
            loadCourses();
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
            loadCourses();
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

// Load courses from Firebase
async function loadCourses() {
    try {
        const snapshot = await db.collection('courses').get();
        courses = {};
        
        snapshot.forEach(doc => {
            courses[doc.id] = { id: doc.id, ...doc.data() };
        });
        
        displayCourses();
    } catch (error) {
        showError('Failed to load courses. Please check your connection.');
    }
}

// Display courses in the UI
function displayCourses() {
    const container = document.getElementById('courses-container');
    const loading = document.getElementById('loading');
    
    loading.style.display = 'none';
    container.innerHTML = '';

    if (Object.keys(courses).length === 0) {
        container.innerHTML = '<div class="loading">No courses yet. Create your first course above!</div>';
        return;
    }

    Object.values(courses).forEach(course => {
        const courseElement = createCourseElement(course);
        container.appendChild(courseElement);
    });
}

// Create course element
function createCourseElement(course) {
    const div = document.createElement('div');
    div.className = 'course-item';
    div.innerHTML = `
        <div class="course-info" onclick="openCourse('${course.id}')">
            <div class="course-name">${escapeHtml(course.name)}</div>
            <div class="course-stats">${course.lessonCount || 0} lessons • ${course.wordCount || 0} words</div>
        </div>
        <div class="course-actions">
            <button class="edit" onclick="editCourse('${course.id}')">Edit</button>
            <button class="delete" onclick="deleteCourse('${course.id}')">Delete</button>
        </div>
    `;
    return div;
}

// Add new course
async function addCourse() {
    const nameInput = document.getElementById('course-name');
    const name = nameInput.value.trim();
    
    if (!name) {
        showError('Please enter a course name.');
        return;
    }

    try {
        const docRef = await db.collection('courses').add({
            name: name,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            lessonCount: 0,
            wordCount: 0
        });
        
        courses[docRef.id] = {
            id: docRef.id,
            name: name,
            lessonCount: 0,
            wordCount: 0
        };
        
        nameInput.value = '';
        displayCourses();
        hideError();
    } catch (error) {
        showError('Failed to add course. Please try again.');
    }
}

// Edit course name
async function editCourse(courseId) {
    const course = courses[courseId];
    const newName = prompt('Enter new course name:', course.name);
    
    if (newName && newName.trim() !== course.name) {
        try {
            await db.collection('courses').doc(courseId).update({
                name: newName.trim()
            });
            
            courses[courseId].name = newName.trim();
            displayCourses();
            hideError();
        } catch (error) {
            showError('Failed to update course name.');
        }
    }
}

// Delete course
async function deleteCourse(courseId) {
    const course = courses[courseId];
    
    if (confirm(`Are you sure you want to delete "${course.name}"? This will remove all lessons and words in this course.`)) {
        try {
            // Delete all lessons in the course
            const lessonsSnapshot = await db.collection('courses').doc(courseId).collection('lessons').get();
            
            const batch = db.batch();
            lessonsSnapshot.forEach(doc => {
                batch.delete(doc.ref);
            });
            
            // Delete the course
            batch.delete(db.collection('courses').doc(courseId));
            
            await batch.commit();
            
            delete courses[courseId];
            displayCourses();
            hideError();
        } catch (error) {
            showError('Failed to delete course.');
        }
    }
}

// Open course (navigate to course page)
function openCourse(courseId) {
    window.location.href = `course.html?id=${courseId}`;
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
document.getElementById('course-name').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        addCourse();
    }
});