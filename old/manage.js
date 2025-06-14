function initializeManageWords() {
    const contentArea = document.getElementById("contentArea");

    if (!contentArea) {
        console.error("Debug: #contentArea not found.");
        alert("Content area not found.");
        return;
    }

    let debugMessages = [];

    // Load words
    let storedWords = [];
    try {
        storedWords = JSON.parse(localStorage.getItem("latinWords")) || [];
        if (!Array.isArray(storedWords)) throw new Error("latinWords is not an array");
    } catch (err) {
        debugMessages.push(`⚠️ Failed to load words: ${err.message}`);
        storedWords = [];
    }

    // Build editable list
    const wordListHTML = storedWords.length
        ? storedWords.map((word, index) => `
            <div class="card" style="display: flex; align-items: center; justify-content: space-between; padding: 1rem; margin-bottom: 1rem;">
                <div style="flex: 1; display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                    <input type="text" value="${word.latin}" class="form-input" id="latin-${index}" style="font-weight: 600;" />
                    <input type="text" value="${word.english}" class="form-input" id="english-${index}" />
                </div>
                <div style="display: flex; gap: 0.5rem; margin-left: 1rem;">
                    <button class="btn" title="Save" data-save="${index}" style="padding: 0.5rem 0.75rem;">💾</button>
                    <button class="btn danger" title="Delete" data-index="${index}" style="padding: 0.5rem 0.75rem;">🗑️</button>
                </div>
            </div>
        `).join("")
        : `<p style="color: var(--text-secondary); text-align: center;">No words saved yet.</p>`;

    // Inject UI
    contentArea.innerHTML = `
        <div class="section active">
            <div class="section-header">
                <h2 class="section-title">Manage Saved Words</h2>
                <p style="color: var(--text-secondary); font-size: 1rem;">
                    Edit or delete saved vocabulary words
                </p>
            </div>

            <div class="stat-card" style="margin-bottom: 1rem;">
                <div class="stat-number">${storedWords.length}</div>
                <div class="stat-label">Total Words</div>
            </div>

            <div id="wordListContainer">
                ${wordListHTML}
            </div>

            ${storedWords.length > 0 ? `
                <div style="text-align: center; margin-top: 2rem;">
                    <button class="btn danger" id="clearAllBtn">🗑️ Clear All Words</button>
                </div>` : ''
            }

            <div id="debugLog" style="margin-top: 2rem; font-size: 0.85rem; color: var(--warning-color); font-family: monospace;"></div>
        </div>
    `;

    // Delete handler
    document.querySelectorAll("[data-index]").forEach(btn => {
        btn.addEventListener("click", (e) => {
            const index = parseInt(e.target.dataset.index);
            storedWords.splice(index, 1);
            localStorage.setItem("latinWords", JSON.stringify(storedWords));
            initializeManageWords();
        });
    });

    // Save handler
    document.querySelectorAll("[data-save]").forEach(btn => {
        btn.addEventListener("click", (e) => {
            const index = parseInt(e.target.dataset.save);
            const latinInput = document.getElementById(`latin-${index}`);
            const englishInput = document.getElementById(`english-${index}`);
            const newLatin = latinInput.value.trim();
            const newEnglish = englishInput.value.trim();

            if (newLatin.length < 2 || newEnglish.length < 2) {
                alert("Words must be at least 2 characters.");
                return;
            }

            storedWords[index].latin = newLatin;
            storedWords[index].english = newEnglish;
            localStorage.setItem("latinWords", JSON.stringify(storedWords));
            showMessage("Word updated successfully.", "success");
        });
    });

    // Clear all handler
    const clearAllBtn = document.getElementById("clearAllBtn");
    if (clearAllBtn) {
        clearAllBtn.addEventListener("click", () => {
            if (confirm("Delete all words?")) {
                localStorage.removeItem("latinWords");
                initializeManageWords();
            }
        });
    }

    // Debug log
    const debugEl = document.getElementById("debugLog");
    if (debugEl && debugMessages.length > 0) {
        debugEl.innerHTML = `<strong>Debug Messages:</strong><br>${debugMessages.join("<br>")}`;
    }
}
