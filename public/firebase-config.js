// firebase-config.js
// Replace with your actual Firebase config values from Firebase Console

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

// Initialize Firestore
const db = firebase.firestore();

// Collection reference for vocabulary words
const wordsCollection = db.collection('vocabulary');

// Helper functions for word management
window.VocabDB = {
  // Add a new word pair
  async addWord(latin, english, difficulty = 'medium') {
    try {
      const wordData = {
        latin: latin.trim(),
        english: english.trim(),
        difficulty: difficulty,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        statistics: {
          timesStudied: 0,
          timesCorrect: 0,
          timesIncorrect: 0,
          lastStudied: null,
          nextReview: firebase.firestore.FieldValue.serverTimestamp(),
          interval: 1, // days
          easeFactor: 2.5
        }
      };
      
      const docRef = await wordsCollection.add(wordData);
      console.log('Word added with ID:', docRef.id);
      return { success: true, id: docRef.id };
    } catch (error) {
      console.error('Error adding word:', error);
      return { success: false, error: error.message };
    }
  },

  // Get all words
  async getAllWords() {
    try {
      const snapshot = await wordsCollection.orderBy('createdAt', 'desc').get();
      const words = [];
      snapshot.forEach(doc => {
        words.push({
          id: doc.id,
          ...doc.data()
        });
      });
      return { success: true, words };
    } catch (error) {
      console.error('Error getting words:', error);
      return { success: false, error: error.message };
    }
  },

  // Check if word already exists
  async wordExists(latin, english) {
    try {
      const latinQuery = await wordsCollection
        .where('latin', '==', latin.trim().toLowerCase())
        .get();
      
      const englishQuery = await wordsCollection
        .where('english', '==', english.trim().toLowerCase())
        .get();
      
      return !latinQuery.empty || !englishQuery.empty;
    } catch (error) {
      console.error('Error checking word existence:', error);
      return false;
    }
  },

  // Delete a word
  async deleteWord(wordId) {
    try {
      await wordsCollection.doc(wordId).delete();
      return { success: true };
    } catch (error) {
      console.error('Error deleting word:', error);
      return { success: false, error: error.message };
    }
  },

  // Update word statistics after study session
  async updateWordStats(wordId, isCorrect) {
    try {
      const wordRef = wordsCollection.doc(wordId);
      const doc = await wordRef.get();
      
      if (!doc.exists) {
        throw new Error('Word not found');
      }
      
      const currentStats = doc.data().statistics;
      const newStats = {
        timesStudied: currentStats.timesStudied + 1,
        timesCorrect: isCorrect ? currentStats.timesCorrect + 1 : currentStats.timesCorrect,
        timesIncorrect: isCorrect ? currentStats.timesIncorrect : currentStats.timesIncorrect + 1,
        lastStudied: firebase.firestore.FieldValue.serverTimestamp()
      };
      
      // Calculate next review using spaced repetition
      if (isCorrect) {
        const newInterval = Math.ceil(currentStats.interval * currentStats.easeFactor);
        const nextReview = new Date();
        nextReview.setDate(nextReview.getDate() + newInterval);
        
        newStats.interval = newInterval;
        newStats.nextReview = firebase.firestore.Timestamp.fromDate(nextReview);
        newStats.easeFactor = Math.max(1.3, currentStats.easeFactor + 0.1);
      } else {
        // Reset interval for incorrect answers
        newStats.interval = 1;
        newStats.nextReview = firebase.firestore.FieldValue.serverTimestamp();
        newStats.easeFactor = Math.max(1.3, currentStats.easeFactor - 0.2);
      }
      
      await wordRef.update({ statistics: newStats });
      return { success: true };
    } catch (error) {
      console.error('Error updating word stats:', error);
      return { success: false, error: error.message };
    }
  }
};