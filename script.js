document.addEventListener("DOMContentLoaded", () => {
  // ===== Global Variables =====
  let words = JSON.parse(localStorage.getItem("vocabulary")) || [];
  let messageTimeout;
  let sortDirection = {};
  let currentWord = null;
  let showingAnswer = false;
  let flipDirection = true;

  // ===== DOM Elements =====
  const fileInput = document.getElementById("fileInput");
  const loadDataBtn = document.getElementById("loadDataBtn");
  const resultsBtn = document.getElementById("resultsBtn");
  const resultsPage = document.getElementById("resultsPage");
  const home = document.getElementById("home");
  const backBtn = document.getElementById("backBtn");
  const resultsTable = document.getElementById("resultsTable").querySelector("tbody");

  const trainBtn = document.getElementById("trainBtn");
  const trainingPage = document.getElementById("trainingPage");
  const backTrainingBtn = document.getElementById("backTrainingBtn");
  const trainingCard = document.getElementById("trainingCard");
  const showAnswerBtn = document.getElementById("showAnswerBtn");
  const correctBtn = document.getElementById("correctBtn");
  const wrongBtn = document.getElementById("wrongBtn");

  let trainingWords = [];

  // ===== Load Vocabulary (Merge, no duplicates) =====
  loadDataBtn.addEventListener("click", () => fileInput.click());

  fileInput.addEventListener("change", (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const rawWords = JSON.parse(e.target.result);
        let stored = JSON.parse(localStorage.getItem("vocabulary")) || [];

        rawWords.forEach(newWord => {
          const exists = stored.some(
            w => w.spanish === newWord.spanish && w.english === newWord.english
          );

          if (!exists) {
            stored.push({
              spanish: newWord.spanish,
              english: newWord.english,
              lastAsked: null,
              lastResults: [],
              overallResults: [],
              score: 0,
              chapter: newWord.chapter || 0,
              unit: newWord.unit || 0,
              type: newWord.type || "unknown"
            });
          }
        });

        words = stored;
        localStorage.setItem("vocabulary", JSON.stringify(words));
        showMessage(`Loaded ${rawWords.length} words. Total now: ${words.length}.`);
      } catch (err) {
        console.error("Error parsing JSON file:", err);
        showMessage("Error parsing JSON file", true);
      }

      fileInput.value = "";
    };
    reader.readAsText(file);
  });


    // ===== Export Data Button =====
  const exportDataBtn = document.getElementById("exportDataBtn");

  exportDataBtn && exportDataBtn.addEventListener("click", () => {
    // Prefer the in-memory `words` (reflects current session); fallback to localStorage
    const data = (words && words.length) ? words : (JSON.parse(localStorage.getItem("vocabulary")) || []);

    if (!data || !data.length) {
      showMessage("⚠️ No data to export. Load or train first.", true);
      return;
    }

    const filename = `spanish_trainer_export_${new Date().toISOString().slice(0,19).replace(/[:T]/g, '-')}.json`;
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    URL.revokeObjectURL(url);
    showMessage("✅ Data exported: " + filename);
  });

  // ===== Show Message =====
  function showMessage(text, isError = false) {
    const container = document.getElementById("messageContainer");
    container.textContent = text;
    if (isError) container.classList.add("error");
    else container.classList.remove("error");

    container.style.display = "block";

    if (messageTimeout) clearTimeout(messageTimeout);
    messageTimeout = setTimeout(() => {
      container.style.display = "none";
      messageTimeout = null;
    }, 3000);
  }

  // ===== View Results =====
  resultsBtn.addEventListener("click", () => {
    const stored = JSON.parse(localStorage.getItem("vocabulary")) || [];
    if (!stored.length) {
      showMessage("No vocabulary loaded yet.", true);
      return;
    }

    renderTable(stored);
    home.style.display = "none";
    resultsPage.style.display = "block";
  });

  backBtn.addEventListener("click", () => {
    resultsPage.style.display = "none";
    home.style.display = "block";
  });

  // ===== Render Table =====
  function renderTable(data) {
    resultsTable.innerHTML = "";

    data.forEach(word => {
      const lastCorrect = word.lastResults.filter(r => r === "Correct").length;
      const lastTotal = word.lastResults.length;
      const overallCorrect = word.overallResults.filter(r => r === "Correct").length;
      const overallTotal = word.overallResults.length;

      const lastAskedUnix = word.lastAsked ? new Date(word.lastAsked).getTime() : 0;

      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${word.spanish}</td>
        <td>${word.english}</td>
        <td>${lastAskedUnix}</td>
        <td>${lastTotal ? `${lastCorrect}/${lastTotal}` : "0/0"}</td>
        <td>${overallTotal ? `${overallCorrect}/${overallTotal}` : "0/0"}</td>
        <td>${word.score.toFixed(2)}</td>
        <td>${word.chapter}</td>
        <td>${word.unit}</td>
        <td>${word.type}</td>
      `;
      resultsTable.appendChild(row);
    });
  }

  // ===== Sorting =====
  document.querySelectorAll("#resultsTable th").forEach(th => {
    th.addEventListener("click", () => {
      const key = th.dataset.key;
      let stored = JSON.parse(localStorage.getItem("vocabulary")) || [];

      if (!sortDirection[key]) sortDirection[key] = "asc";
      else sortDirection[key] = sortDirection[key] === "asc" ? "desc" : "asc";

      stored.sort((a, b) => {
        let valA = a[key];
        let valB = b[key];

        if (Array.isArray(valA)) valA = valA.join(",");
        if (Array.isArray(valB)) valB = valB.join(",");

        if (key === "lastAsked") {
          valA = valA ? new Date(valA) : 0;
          valB = valB ? new Date(valB) : 0;
        }

        if (valA < valB) return sortDirection[key] === "asc" ? -1 : 1;
        if (valA > valB) return sortDirection[key] === "asc" ? 1 : -1;
        return 0;
      });

      renderTable(stored);
    });
  });

  // ===== Training =====
  trainBtn.addEventListener("click", () => {
    const stored = JSON.parse(localStorage.getItem("vocabulary")) || [];
    if (!stored.length) {
      showMessage("No vocabulary loaded yet.", true);
      return;
    }

    trainingWords = [...stored];
    currentWord = null;
    showingAnswer = false;

    home.style.display = "none";
    trainingPage.style.display = "block";

    showNextWeightedWord();
  });

  backTrainingBtn.addEventListener("click", () => {
    trainingPage.style.display = "none";
    home.style.display = "block";
  });

  showAnswerBtn.addEventListener("click", () => {
    if (!currentWord) return;
    showingAnswer = true;
    showWord(currentWord, true);
  });

  correctBtn.addEventListener("click", () => recordWeightedAnswer(true));
  wrongBtn.addEventListener("click", () => recordWeightedAnswer(false));

  // ===== Weighted Training: lower score = higher chance =====
  function showNextWeightedWord() {
    if (!trainingWords.length) return;

    const weightedWords = [];
    trainingWords.forEach(word => {
      const score = computeScore(word); 
      const weight = Math.ceil((1 - score) * 10); 
      for (let i = 0; i < weight; i++) weightedWords.push(word);
    });

    const randIndex = Math.floor(Math.random() * weightedWords.length);
    currentWord = weightedWords[randIndex];

    showingAnswer = false;
    flipDirection = Math.random() < 0.5;
    showWord(currentWord, false);
  }

  // ===== Compute Sigmoid Score =====
  function computeScore(word) {
    const overallAttempts = word.overallResults.length || 1;
    const overallRight = word.overallResults.filter(r => r === "Correct").length;

    const last4Attempts = word.lastResults.length || 1;
    const last4Right = word.lastResults.filter(r => r === "Correct").length;

    const overallFraction = overallRight / overallAttempts;
    const last4Fraction = last4Right / last4Attempts;

    const daysSinceLast = word.lastAsked ? (Date.now() - word.lastAsked) / (1000 * 60 * 60 * 24) : 0;

    const rawScore = overallFraction + 2 * last4Fraction - 0.2 * daysSinceLast;

    return 1 / (1 + Math.exp(-rawScore));
  }

  // ===== Show Word =====
  function showWord(word, reveal) {
    if (!reveal) {
      trainingCard.textContent = flipDirection ? word.spanish : word.english;
    } else {
      trainingCard.textContent = flipDirection
        ? `${word.spanish} = ${word.english}`
        : `${word.english} = ${word.spanish}`;
    }
  }

  // ===== Record Answer =====
  function recordWeightedAnswer(isCorrect) {
    if (!currentWord) return;

    currentWord.lastAsked = Date.now();

    currentWord.lastResults.push(isCorrect ? "Correct" : "Incorrect");
    if (currentWord.lastResults.length > 4) currentWord.lastResults.shift();

    currentWord.overallResults.push(isCorrect ? "Correct" : "Incorrect");

    currentWord.score = computeScore(currentWord);

    const stored = JSON.parse(localStorage.getItem("vocabulary")) || [];
    const idx = stored.findIndex(w => w.spanish === currentWord.spanish && w.english === currentWord.english);
    if (idx >= 0) stored[idx] = currentWord;
    localStorage.setItem("vocabulary", JSON.stringify(stored));

    showNextWeightedWord();
  }
});
