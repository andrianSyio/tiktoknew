// api/index.js
const express = require('express');
const cors = require('cors');
const app = express();

// Middleware
app.use(cors()); // Mengizinkan permintaan dari domain frontend Anda (penting untuk development lokal)
app.use(express.json()); // Untuk memparsing body request JSON

// Muat data soal dari file JSON
let soalGame;
try {
    soalGame = require('./data-soal.json'); // Path relatif terhadap index.js
} catch (error) {
    console.error("Gagal memuat data-soal.json:", error);
    soalGame = []; // Pastikan soalGame adalah array kosong jika gagal dimuat
}

// State game (sementara, akan hilang jika server restart)
let currentSoalIndex = 0; // Indeks soal yang sedang dimainkan
let totalSkor = 0;       // Total skor game
let jawabanTerungkap = new Set(); // Melacak jawaban yang sudah benar untuk soal saat ini
let currentRevealedAnswers = [];  // Data jawaban yang akan dikirim ke frontend

// Fungsi untuk memperbarui status jawaban yang terungkap
function updateRevealedAnswers() {
    if (currentSoalIndex >= soalGame.length) {
        currentRevealedAnswers = [];
        return;
    }
    const currentSoal = soalGame[currentSoalIndex];
    currentRevealedAnswers = currentSoal.answers.map(ans => ({
        text: jawabanTerungkap.has(ans.text.toLowerCase()) ? ans.text : '____', // Tampilkan teks jika terungkap, kalau tidak '____'
        score: jawabanTerungkap.has(ans.text.toLowerCase()) ? ans.score : 0,    // Tampilkan skor jika terungkap
        isRevealed: jawabanTerungkap.has(ans.text.toLowerCase())                // Status apakah sudah terungkap
    }));
}

// Inisialisasi status game saat server dimulai
updateRevealedAnswers();

// --- API Endpoints ---

// Endpoint untuk mendapatkan soal dan status game saat ini
app.get('/api/current-question', (req, res) => {
    if (currentSoalIndex >= soalGame.length) {
        return res.json({
            question: "Game Selesai!",
            answers: [],
            revealedAnswers: [],
            score: totalSkor, // Hanya satu skor
            gameEnded: true
        });
    }

    const currentSoal = soalGame[currentSoalIndex];
    updateRevealedAnswers(); // Pastikan selalu diperbarui sebelum dikirim

    res.json({
        question: currentSoal.question,
        answers: currentSoal.answers, // Mengirim semua jawaban (frontend bisa menyembunyikan)
        revealedAnswers: currentRevealedAnswers, // Jawaban yang sudah terungkap
        score: totalSkor, // Hanya satu skor
        gameEnded: false
    });
});

// Endpoint untuk submit jawaban
app.post('/api/submit-answer', (req, res) => {
    const { answer } = req.body; // Hanya perlu 'answer', tidak perlu 'team'

    if (!answer) {
        return res.status(400).json({ success: false, message: "Jawaban harus diisi." });
    }
    if (currentSoalIndex >= soalGame.length) {
        return res.status(400).json({ success: false, message: "Game sudah selesai." });
    }

    const currentSoal = soalGame[currentSoalIndex];
    const normalizedAnswer = answer.toLowerCase().trim(); // Normalisasi jawaban untuk perbandingan

    // Cari jawaban yang benar dan belum terungkap
    const foundAnswer = currentSoal.answers.find(ans =>
        ans.text.toLowerCase() === normalizedAnswer && !jawabanTerungkap.has(ans.text.toLowerCase())
    );

    if (foundAnswer) {
        jawabanTerungkap.add(foundAnswer.text.toLowerCase()); // Tambahkan ke Set jawaban terungkap
        totalSkor += foundAnswer.score; // Tambahkan skor ke total

        updateRevealedAnswers(); // Perbarui status jawaban terungkap

        // Periksa apakah semua jawaban sudah terungkap untuk soal ini
        if (jawabanTerungkap.size === currentSoal.answers.length) {
            return res.json({
                success: true,
                message: "Jawaban benar! Semua jawaban untuk soal ini telah terungkap.",
                answerRevealed: foundAnswer.text,
                scoreAdded: foundAnswer.score,
                score: totalSkor,
                allAnswersRevealedForCurrentQuestion: true
            });
        } else {
            return res.json({
                success: true,
                message: "Jawaban benar!",
                answerRevealed: foundAnswer.text,
                scoreAdded: foundAnswer.score,
                score: totalSkor,
                allAnswersRevealedForCurrentQuestion: false
            });
        }
    } else {
        return res.status(400).json({
            success: false,
            message: "Jawaban salah atau sudah terungkap.",
            score: totalSkor // Tetap kirim skor terbaru
        });
    }
});

// Endpoint untuk pindah ke soal berikutnya (hanya untuk admin/host)
app.post('/api/next-question', (req, res) => {
    if (currentSoalIndex < soalGame.length - 1) {
        currentSoalIndex++;
        jawabanTerungkap.clear(); // Reset jawaban terungkap untuk soal baru
        updateRevealedAnswers();
        return res.json({ success: true, message: "Pindah ke soal berikutnya." });
    } else {
        currentSoalIndex = soalGame.length; // Tandai game selesai
        jawabanTerungkap.clear();
        updateRevealedAnswers();
        return res.json({ success: true, message: "Semua soal sudah habis. Game selesai." });
    }
});

// Endpoint untuk reset game (hanya untuk admin/host)
app.post('/api/reset-game', (req, res) => {
    currentSoalIndex = 0;
    totalSkor = 0; // Reset total skor
    jawabanTerungkap.clear();
    updateRevealedAnswers();
    res.json({ success: true, message: "Game di-reset." });
});

// Export aplikasi Express Anda agar bisa dijalankan oleh Vercel sebagai Serverless Function
module.exports = app;
