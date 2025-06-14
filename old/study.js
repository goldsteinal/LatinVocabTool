function initializeStudy() {
    const contentArea = document.getElementById("contentArea");
    if (!contentArea) {
        alert("Content area not found.");
        return;
    }

    const allWords = getStoredWords();
    let wordsToStudy = getWordsForStudy(allWords);
    let currentIndex = 0;
    let correctCount = 0;
    let totalCount = 0;

    // Inject HTML
    contentArea.innerHTML = `
        <div class="section active">
            <div class="section-header">
                <h2 class="section-title">Study Quiz</h2>
                <p style="color: var(--text-secondary); font-size: 1rem;">
                    Practice your Latin vocabulary using smart review
                </p>
            </div>

            <div class="stats" style="margin-bottom: 2rem;">
                <div class="stat-card">
                    <div class="stat-number" id="studyTotal">${wordsToStudy.length}</div>
                    <div class="stat-label">Words to Study</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number" id="studyCorrect">0</div>
                    <div class="stat-label">Correct</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number" id="studyAccuracy">0%</div>
                    <div class="stat-label">Accuracy</div>
                </div>
            </div>

            <div class="card" style="max-width: 600px; margin: auto;">
                <div id="quizCard">
                    <!-- Quiz question will go here -->
                </div>
            </div>

            <div id="messageContainer" style="margin-top: 2rem;"></div>
        </div>
    `;

    showNextQuestion();

    function showNextQuestion() {
        if (currentIndex >= wordsToStudy.length) {
            document.getElementById("quizCard").innerHTML = `
                <h3 style="text-align: center;">🎉 You’ve completed your session!</h3>
                <p style="text-align: center; color: var(--text-secondary);">Well done! You can return home or study again.</p>
            `;
            return;
        }

        const word = wordsToStudy[currentIndex];
        document.getElementById("quizCard").innerHTML = `
            <h3 style="margin-bottom: 1rem;">Translate to English:</h3>
            <div style="font-size: 1.5rem; font-weight: 600; text-align: center; margin-bottom: 1rem;">
                ${word.latin}
            </div>
            <input type="text" id="answerInput" class="form-input" placeholder="Type the English meaning" autocomplete="off" />
            <button class="btn" id="submitAnswer" style="margin-top: 1rem;">Submit</button>
        `;

        document.getElementById("submitAnswer").addEventListener("click", () => {
            const userAnswer = document.getElementById("answerInput").value.trim().toLowerCase();
            totalCount++;

            if (userAnswer === word.english.toLowerCase()) {
                correctCount++;
                word.correctAnswers++;
                word.mastery = Math.min(100, word.mastery + 10);
                showMessage("✅ Correct!", "success");
            } else {
                word.incorrectAnswers++;
                word.mastery = Math.max(0, word.mastery - 10);
                showMessage(`❌ Incorrect. Correct answer: ${word.english}`, "error");
            }

            word.lastStudied = new Date().toISOString();
            word.timesStudied = (word.timesStudied || 0) + 1;
            word.nextReview = getNextReviewDate(word.mastery);
            saveAllWords(allWords);

            updateStats();
            currentIndex++;
            setTimeout(showNextQuestion, 1200);
        });

        document.getElementById("answerInput").focus();
    }

    function updateStats() {
        const accuracy = totalCount === 0 ? 0 : Math.round((correctCount / totalCount) * 100);
        document.getElementById("studyCorrect").textContent = correctCount;
        document.getElementById("studyAccuracy").textContent = `${accuracy}%`;
    }
}
