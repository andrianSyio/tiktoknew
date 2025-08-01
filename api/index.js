// api/index.js

const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

let allSoal; // Semua soal yang dimuat dari data-soal.json
let shuffledSoal = []; // Soal yang sudah diacak dan belum dimainkan
let currentSoalIndex = 0; // Indeks soal saat ini dari shuffledSoal
let totalSkor = 0; // Total skor game
let jawabanTerungkap = new Set(); // Melacak jawaban yang sudah benar untuk soal saat ini (teksnya)
let currentRevealedAnswersData = []; // Data lengkap jawaban yang terungkap (objek {text, score, isRevealed})

// Fungsi untuk mengacak array (Fisher-Yates shuffle)
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

// Fungsi untuk mendapatkan jawaban lengkap dari soal saat ini
function getCurrentQuestionFullAnswers() {
    if (currentSoalIndex >= shuffledSoal.length || shuffledSoal.length === 0) {
        return [];
    }
    return shuffledSoal[currentSoalIndex].answers;
}

// Fungsi untuk memperbarui `currentRevealedAnswersData` berdasarkan `jawabanTerungkap`
// Ini penting agar data yang dikirim ke frontend selalu konsisten
function updateCurrentRevealedAnswersData() {
    if (currentSoalIndex >= shuffledSoal.length || shuffledSoal.length === 0) {
        currentRevealedAnswersData = [];
        return;
    }
    const currentSoal = shuffledSoal[currentSoalIndex];
    currentRevealedAnswersData = currentSoal.answers.map(ans => ({
        text: ans.text,
        score: ans.score,
        isRevealed: jawabanTerungkap.has(ans.text.toLowerCase())
    })).filter(ans => ans.isRevealed); // Hanya kirim yang isRevealed: true
}


// Inisialisasi game state
function initializeGame() {
    try {
        allSoal = require('./data-soal.json'); // Muat semua soal
        shuffledSoal = shuffleArray([...allSoal]); // Acak dan buat salinannya
        currentSoalIndex = 0; // Mulai dari soal pertama di array acak
        totalSkor = 0;
        jawabanTerungkap.clear();
        updateCurrentRevealedAnswersData(); // Pastikan data awal terupdate
    } catch (error) {
        console.error("Gagal memuat atau mengacak data-soal.json:", error);
        allSoal = [];
        shuffledSoal = [];
    }
}

// Panggil inisialisasi saat aplikasi dimulai
initializeGame();


// --- API Endpoints ---

app.get('/api/current-question', (req, res) => {
    if (currentSoalIndex >= shuffledSoal.length || shuffledSoal.length === 0) {
        return res.json({
            question: "Game Selesai! Tidak ada soal lagi.",
            answers: [], // Kirim array kosong jika game selesai
            revealedAnswers: [], // Kirim array kosong jika game selesai
            score: totalSkor,
            gameEnded: true
        });
    }

    const currentSoal = shuffledSoal[currentSoalIndex];
    updateCurrentRevealedAnswersData(); // Pastikan data terbaru

    res.json({
        question: currentSoal.question,
        answers: currentSoal.answers, // Kirim semua jawaban untuk soal ini
        revealedAnswers: currentRevealedAnswersData, // Hanya jawaban yang terungkap
        score: totalSkor,
        gameEnded: false
    });
});

app.post('/api/submit-answer', (req, res) => {
    const { answer } = req.body;

    if (!answer) {
        return res.status(400).json({ success: false, message: "Jawaban harus diisi." });
    }
    if (currentSoalIndex >= shuffledSoal.length || shuffledSoal.length === 0) {
        return res.status(400).json({ success: false, message: "Game sudah selesai atau tidak ada soal." });
    }

    const currentSoal = shuffledSoal[currentSoalIndex];
    const normalizedAnswer = answer.toLowerCase().trim();

    const foundAnswer = currentSoal.answers.find(ans =>
        ans.text.toLowerCase() === normalizedAnswer && !jawabanTerungkap.has(ans.text.toLowerCase())
    );

    if (foundAnswer) {
        jawabanTerungkap.add(foundAnswer.text.toLowerCase());
        totalSkor += foundAnswer.score;
        updateCurrentRevealedAnswersData(); // Update data jawaban terungkap

        // Always return the full answers list for the current question
        const fullAnswers = getCurrentQuestionFullAnswers();

        // Check if all answers for the current question are revealed
        if (jawabanTerungkap.size === currentSoal.answers.length) {
            // Automatically move to the next question if all answers are revealed
            if (currentSoalIndex < shuffledSoal.length - 1) {
                currentSoalIndex++;
                jawabanTerungkap.clear(); // Reset for new question
                updateCurrentRevealedAnswersData(); // Update for the new question
                return res.json({
                    success: true,
                    message: "Jawaban benar! Semua jawaban untuk soal ini telah terungkap. Pindah ke soal berikutnya.",
                    answerRevealed: foundAnswer.text,
                    scoreAdded: foundAnswer.score,
                    score: totalSkor,
                    allAnswersRevealedForCurrentQuestion: true,
                    movedToNextQuestion: true, // Flag for frontend
                    answers: getCurrentQuestionFullAnswers(), // Jawaban lengkap untuk soal baru
                    revealedAnswers: currentRevealedAnswersData // Jawaban terungkap untuk soal baru (kosong)
                });
            } else {
                // Last question, all answers revealed, game ends
                currentSoalIndex++; // Mark game as finished
                jawabanTerungkap.clear();
                updateCurrentRevealedAnswersData();
                return res.json({
                    success: true,
                    message: "Jawaban benar! Semua soal sudah habis. Game selesai.",
                    answerRevealed: foundAnswer.text,
                    scoreAdded: foundAnswer.score,
                    score: totalSkor,
                    allAnswersRevealedForCurrentQuestion: true,
                    gameEnded: true,
                    answers: [], // Kosong jika game selesai
                    revealedAnswers: [] // Kosong jika game selesai
                });
            }
        } else {
            return res.json({
                success: true,
                message: "Jawaban benar!",
                answerRevealed: foundAnswer.text,
                scoreAdded: foundAnswer.score,
                score: totalSkor,
                allAnswersRevealedForCurrentQuestion: false,
                answers: fullAnswers, // Kirim jawaban lengkap untuk soal yang sama
                revealedAnswers: currentRevealedAnswersData // Kirim jawaban terungkap yang diperbarui
            });
        }
    } else { // If answer is wrong or already revealed
        updateCurrentRevealedAnswersData(); // Pastikan data jawaban terungkap terbarui
        return res.status(400).json({
            success: false,
            message: "Jawaban salah atau sudah terungkap.",
            score: totalSkor,
            answers: getCurrentQuestionFullAnswers(), // Kirim jawaban lengkap
            revealedAnswers: currentRevealedAnswersData // Kirim jawaban terungkap saat ini
        });
    }
});

app.post('/api/next-question', (req, res) => {
    if (currentSoalIndex < shuffledSoal.length - 1) {
        currentSoalIndex++;
        jawabanTerungkap.clear(); // Reset jawaban terungkap untuk soal baru
        updateCurrentRevealedAnswersData(); // Update untuk soal baru
        return res.json({
            success: true,
            message: "Pindah ke soal berikutnya.",
            answers: getCurrentQuestionFullAnswers(),
            revealedAnswers: currentRevealedAnswersData,
            score: totalSkor // Tetap kirim skor
        });
    } else {
        currentSoalIndex = shuffledSoal.length; // Tandai game selesai
        jawabanTerungkap.clear();
        updateCurrentRevealedAnswersData();
        return res.json({
            success: true,
            message: "Semua soal sudah habis. Game selesai.",
            answers: [],
            revealedAnswers: [],
            score: totalSkor,
            gameEnded: true
        });
    }
});

app.post('/api/reset-game', (req, res) => {
    initializeGame(); // Reset game dengan mengacak soal lagi
    res.json({
        success: true,
        message: "Game di-reset.",
        answers: getCurrentQuestionFullAnswers(),
        revealedAnswers: currentRevealedAnswersData,
        score: totalSkor
    });
});

module.exports = app;
