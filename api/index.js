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
    currentRevealedAnswersData = currentSoal.answers
        .filter(ans => jawabanTerungkap.has(ans.text.toLowerCase())) // Filter hanya yang sudah terungkap
        .map(ans => ({
            text: ans.text,
            score: ans.score,
            isRevealed: true // Tandai sebagai terungkap
        }));
}

// Inisialisasi game state
function initializeGame() {
    try {
        allSoal = require('./data-soal.json');
        shuffledSoal = shuffleArray([...allSoal]);
        currentSoalIndex = 0;
        totalSkor = 0;
        jawabanTerungkap.clear();
        updateCurrentRevealedAnswersData();
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
            answers: [],
            revealedAnswers: [],
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

        // Selalu kirim status game lengkap yang terbaru
        if (jawabanTerungkap.size === currentSoal.answers.length) {
            // Semua jawaban terungkap, otomatis pindah soal
            if (currentSoalIndex < shuffledSoal.length - 1) {
                currentSoalIndex++;
                jawabanTerungkap.clear(); // Reset untuk soal baru
                updateCurrentRevealedAnswersData(); // Update untuk soal baru (akan kosong)
                return res.json({
                    success: true,
                    message: "Jawaban benar! Semua jawaban untuk soal ini telah terungkap. Pindah ke soal berikutnya.",
                    answerRevealed: foundAnswer.text,
                    scoreAdded: foundAnswer.score,
                    score: totalSkor,
                    allAnswersRevealedForCurrentQuestion: true,
                    movedToNextQuestion: true,
                    answers: getCurrentQuestionFullAnswers(), // Jawaban lengkap untuk soal BARU
                    revealedAnswers: currentRevealedAnswersData // Jawaban terungkap untuk soal BARU (kosong)
                });
            } else {
                // Soal terakhir terjawab semua, game selesai
                currentSoalIndex++;
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
                    answers: [],
                    revealedAnswers: []
                });
            }
        } else {
            // Jawaban benar tapi belum semua terungkap
            return res.json({
                success: true,
                message: "Jawaban benar!",
                answerRevealed: foundAnswer.text,
                scoreAdded: foundAnswer.score,
                score: totalSkor,
                allAnswersRevealedForCurrentQuestion: false,
                answers: getCurrentQuestionFullAnswers(), // Jawaban lengkap untuk soal yang sama
                revealedAnswers: currentRevealedAnswersData // Jawaban terungkap yang diperbarui
            });
        }
    } else { // Jawaban salah atau sudah terungkap
        updateCurrentRevealedAnswersData(); // Tetap update data terungkap saat ini
        return res.status(400).json({
            success: false,
            message: "Jawaban salah atau sudah terungkap.",
            score: totalSkor,
            answers: getCurrentQuestionFullAnswers(), // Jawaban lengkap
            revealedAnswers: currentRevealedAnswersData // Jawaban terungkap saat ini
        });
    }
});

app.post('/api/next-question', (req, res) => {
    if (currentSoalIndex < shuffledSoal.length - 1) {
        currentSoalIndex++;
        jawabanTerungkap.clear();
        updateCurrentRevealedAnswersData();
        return res.json({
            success: true,
            message: "Pindah ke soal berikutnya.",
            answers: getCurrentQuestionFullAnswers(),
            revealedAnswers: currentRevealedAnswersData,
            score: totalSkor
        });
    } else {
        currentSoalIndex = shuffledSoal.length;
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
    return res.json({
        success: true,
        message: "Game di-reset.",
        answers: getCurrentQuestionFullAnswers(),
        revealedAnswers: currentRevealedAnswersData,
        score: totalSkor
    });
});

module.exports = app;
