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

        // Normalization defaults to compare all columns consistently.
        const defaults = {
          spanish: "",
          english: "",
          // IMPORTANT: default lastAsked is 0 if missing in incoming data
          lastAsked: 0,
          lastResults: [],
          overallResults: [],
          score: 0,
          chapter: 0,
          unit: 0,
          type: "unknown"
        };

        function normalizeIncoming(obj) {
          // We do NOT override a present lastAsked — only use default 0 if absent/empty.
          const out = Object.assign({}, defaults);

          out.spanish = obj.spanish || "";
          out.english = obj.english || "";

          // lastAsked: keep incoming if provided (not null/empty string), otherwise 0
          if (obj.hasOwnProperty("lastAsked") && obj.lastAsked !== null && obj.lastAsked !== "") {
            out.lastAsked = obj.lastAsked;
          } else {
            out.lastAsked = 0;
          }

          out.lastResults = Array.isArray(obj.lastResults) ? obj.lastResults.slice() : [];
          out.overallResults = Array.isArray(obj.overallResults) ? obj.overallResults.slice() : [];
          out.score = typeof obj.score === "number" ? obj.score : 0;
          out.chapter = obj.chapter !== undefined && obj.chapter !== null ? obj.chapter : 0;
          out.unit = obj.unit !== undefined && obj.unit !== null ? obj.unit : 0;
          out.type = obj.type || "unknown";

          return out;
        }

        function normalizeStored(obj) {
          // Stored entries may have been saved with null for lastAsked previously;
          // treat null/undefined as 0 for comparison consistency.
          const out = Object.assign({}, defaults);

          out.spanish = obj.spanish || "";
          out.english = obj.english || "";
          out.lastAsked = obj.lastAsked !== undefined && obj.lastAsked !== null && obj.lastAsked !== "" ? obj.lastAsked : 0;
          out.lastResults = Array.isArray(obj.lastResults) ? obj.lastResults.slice() : [];
          out.overallResults = Array.isArray(obj.overallResults) ? obj.overallResults.slice() : [];
          out.score = typeof obj.score === "number" ? obj.score : 0;
          out.chapter = obj.chapter !== undefined && obj.chapter !== null ? obj.chapter : 0;
          out.unit = obj.unit !== undefined && obj.unit !== null ? obj.unit : 0;
          out.type = obj.type || "unknown";

          return out;
        }

        function objectsEqual(a, b) {
          // Strict comparison for all relevant fields.
          if (String(a.spanish) !== String(b.spanish)) return false;
          if (String(a.english) !== String(b.english)) return false;
          if (Number(a.lastAsked) !== Number(b.lastAsked)) return false;
          if (Number(a.score) !== Number(b.score)) return false;
          if (Number(a.chapter) !== Number(b.chapter)) return false;
          if (Number(a.unit) !== Number(b.unit)) return false;
          if (String(a.type) !== String(b.type)) return false;

          // Compare arrays (order-sensitive). If you want order-insensitive,
          // we can change to count-based compare.
          if (a.lastResults.length !== b.lastResults.length) return false;
          for (let i = 0; i < a.lastResults.length; i++) {
            if (String(a.lastResults[i]) !== String(b.lastResults[i])) return false;
          }

          if (a.overallResults.length !== b.overallResults.length) return false;
          for (let i = 0; i < a.overallResults.length; i++) {
            if (String(a.overallResults[i]) !== String(b.overallResults[i])) return false;
          }

          return true;
        }

        let added = 0;
        let skipped = 0;

        rawWords.forEach(newWord => {
          const normNew = normalizeIncoming(newWord);

          const exists = stored.some(storedWord => {
            const normStored = normalizeStored(storedWord);
            return objectsEqual(normStored, normNew);
          });

          if (!exists) {
            // When adding, store the incoming values but ensure lastAsked default is 0 if missing
            stored.push({
              spanish: newWord.spanish || "",
              english: newWord.english || "",
              lastAsked: (newWord.hasOwnProperty("lastAsked") && newWord.lastAsked !== null && newWord.lastAsked !== "") ? newWord.lastAsked : 0,
              lastResults: Array.isArray(newWord.lastResults) ? newWord.lastResults.slice() : [],
              overallResults: Array.isArray(newWord.overallResults) ? newWord.overallResults.slice() : [],
              score: typeof newWord.score === "number" ? newWord.score : 0,
              chapter: newWord.chapter !== undefined && newWord.chapter !== null ? newWord.chapter : 0,
              unit: newWord.unit !== undefined && newWord.unit !== null ? newWord.unit : 0,
              type: newWord.type || "unknown"
            });
            added++;
          } else {
            skipped++;
          }
        });

        words = stored;
        localStorage.setItem("vocabulary", JSON.stringify(words));
        showMessage(`Imported: ${rawWords.length} entries — Added: ${added}, Skipped (duplicates): ${skipped}. Total now: ${words.length}.`);
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

  // Weighting parameters (tweak these)
  const power = 2;   // how strongly low-score words are prioritized (1 = linear, 2 = quadratic)
  const scale = 12;  // overall pool size multiplier; higher = smoother randomness

  trainingWords.forEach(word => {
    const score = computeScore(word); // freshly recalculated each round
    const rawWeight = Math.pow(1 - score, power) * scale;
    const weight = Math.max(1, Math.round(rawWeight)); // ensure every word appears at least once

    // Push word multiple times according to weight
    for (let i = 0; i < weight; i++) {
      weightedWords.push(word);
    }
  });

  // Pick a random entry from the weighted list
  const randIndex = Math.floor(Math.random() * weightedWords.length);
  currentWord = weightedWords[randIndex];

  showingAnswer = false;
  flipDirection = Math.random() < 0.5;
  showWord(currentWord, false);
}


  // ===== Compute Score =====
function computeScore(word) {
  // --- safe defaults ---
  const overallArr = Array.isArray(word.overallResults) ? word.overallResults : [];
  const recentArr  = Array.isArray(word.lastResults) ? word.lastResults : [];

  const total = overallArr.length;
  const correct = overallArr.filter(r => r === "Correct").length;
  const recent = recentArr.length;
  const recentCorrect = recentArr.filter(r => r === "Correct").length;

  const overallFrac = total ? (correct / total) : 0;      // long-term accuracy [0..1]
  const recentFrac  = recent ? (recentCorrect / recent) : 0; // short-term accuracy [0..1]

  // Blend recent vs overall — tune alpha in [0..1] (higher = trust recent more)
  const alpha = 0.7;
  const learningConfidence = alpha * recentFrac + (1 - alpha) * overallFrac; // [0..1]

  // Days since last asked.
  // Your default is 0 for "never asked" — treat 0/invalid as "long time ago"
  let last = Number(word.lastAsked);
  if (!Number.isFinite(last) || last === 0) {
    // never asked -> treat as very long ago so it gets priority
    last = Date.now() - (365 * 24 * 60 * 60 * 1000); // 1 year ago
  }
  const days = (Date.now() - last) / (1000 * 60 * 60 * 24);

  // --- retention model: exponential forgetting ---
  // Base time constant (days) for weak items, and multiplier controlled by confidence.
  const baseTau = 2;         // days for very weak items
  const tauMultiplier = 6;   // how much larger tau becomes for strong items
  const tau = baseTau * (1 + tauMultiplier * learningConfidence); // tau >= baseTau

  const retention = Math.exp(-days / tau); // in (0..1], higher if recent & large tau

  // Final mastery score: how well user currently remembers the item
  const score = learningConfidence * retention; // [0..1]

  // clamp numeric issues
  return Math.min(Math.max(score || 0, 0), 1);
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
