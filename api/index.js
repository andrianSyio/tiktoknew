// api/index.js
const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin'); // Import Firebase Admin SDK
const app = express();

app.use(cors()); // Izinkan CORS
app.use(express.json()); // Parsing JSON body

// --- INISIALISASI FIREBASE ADMIN SDK ---
// Pastikan Anda telah mengatur Environment Variable 'FIREBASE_SERVICE_ACCOUNT_KEY' di Vercel
// dengan seluruh isi file JSON kunci akun layanan Anda.
// Untuk pengujian lokal: Anda perlu mengatur Environment Variable ini di lingkungan lokal Anda.
// Contoh di CMD: set FIREBASE_SERVICE_ACCOUNT_KEY="{'type': 'service_account', ...}"
// Atau gunakan file .env dengan bantuan library dotenv (tidak termasuk dalam scope ini).

if (!process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
  console.error("ERROR: Environment variable 'FIREBASE_SERVICE_ACCOUNT_KEY' is not set.");
  // Ini akan mencegah aplikasi crash saat dijalankan di Vercel jika env var tidak ada.
  // Anda mungkin ingin exit proses atau fallback ke mode terbatas.
  // Untuk tujuan demo, kita akan biarkan app tetap berjalan tapi fungsi DB tidak akan bekerja.
  // Jika ini terjadi di Vercel, fungsi tidak akan bisa diinisialisasi.
} else {
  try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      // --- PERHATIKAN: URL DATABASE ANDA SESUAI PROJECT_ID "masjawir-c7272" ---
      databaseURL: "https://masjawir-c7272-default-rtdb.firebaseio.com" 
    });

    console.log("Firebase Admin SDK initialized successfully.");
  } catch (error) {
    console.error("ERROR: Failed to initialize Firebase Admin SDK.", error);
    console.error("Ensure FIREBASE_SERVICE_ACCOUNT_KEY is valid JSON.");
  }
}

const db = admin.database(); // Dapatkan referensi database
const gameRef = db.ref('game_state'); // Referensi ke node 'game_state' di database

// --- Variabel lokal untuk state yang dimuat per permintaan (akan konsisten karena dari DB) ---
let allSoal; // Semua soal dari data-soal.json

// Fungsi untuk membaca state dari Firebase
async function getGameState() {
    try {
        const snapshot = await gameRef.once('value');
        return snapshot.val();
    } catch (error) {
        console.error("Error reading game state from Firebase:", error);
        throw new Error("Gagal membaca game state dari database.");
    }
}

// Fungsi untuk menulis state ke Firebase
async function setGameState(state) {
    try {
        await gameRef.set(state);
    } catch (error) {
        console.error("Error writing game state to Firebase:", error);
        throw new Error("Gagal menulis game state ke database.");
    }
}

// Fungsi untuk mengacak array (Fisher-Yates shuffle)
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

// --- Fungsi Inisialisasi/Reset Data Game Baru (Memuat dari data-soal.json dan mengacak) ---
async function initializeNewGameData() {
    try {
        if (!allSoal) { // Pastikan allSoal dimuat sekali saja
            allSoal = require('./data-soal.json');
        }
        const shuffledSoalTemp = shuffleArray([...allSoal]); // Acak dan buat salinannya

        const initialGameState = {
            currentSoalIndex: 0,
            totalSkor: 0,
            jawabanTerungkap: [], // Simpan sebagai array di DB
            // Hanya simpan ID soal yang sudah diacak untuk menghemat ruang di DB
            shuffledSoalOrder: shuffledSoalTemp.map(s => s.id) 
        };
        await setGameState(initialGameState); // Simpan ke Firebase
        return initialGameState;
    } catch (error) {
        console.error("Gagal inisialisasi game dari data-soal.json:", error);
        throw new Error("Gagal memuat soal game.");
    }
}

// --- Middleware untuk memuat state game sebelum setiap request ---
app.use(async (req, res, next) => {
    // Jika Firebase belum terinisialisasi, lewati atau tangani error
    if (!admin.apps.length) {
        return res.status(500).json({ success: false, message: "Server error: Firebase not initialized. Check environment variables." });
    }

    try {
        let currentState = await getGameState();
        
        // Inisialisasi state baru jika belum ada di DB
        if (!currentState || !currentState.shuffledSoalOrder || !Array.isArray(currentState.jawabanTerungkap)) {
            console.warn("Game state tidak ditemukan atau corrupt di DB, menginisialisasi yang baru...");
            currentState = await initializeNewGameData(); 
        }

        // Muat kembali 'allSoal' dan rekonstruksi 'shuffledSoal' berdasarkan ID dari DB
        if (!allSoal) {
            allSoal = require('./data-soal.json');
        }
        const reconstructedShuffledSoal = currentState.shuffledSoalOrder.map(id => 
            allSoal.find(s => s.id === id)
        ).filter(s => s !== undefined); // Filter soal yang mungkin tidak ditemukan

        if (reconstructedShuffledSoal.length !== currentState.shuffledSoalOrder.length) {
            console.warn("Some questions in DB state do not match data-soal.json. Re-initializing game.");
            currentState = await initializeNewGameData(); // Re-initialize if mismatch
            reconstructedShuffledSoal = currentState.shuffledSoalOrder.map(id => allSoal.find(s => s.id === id));
        }
        
        // Variabel state yang akan dilewatkan ke route handler (Set untuk jawaban terungkap)
        req.gameState = {
            currentSoalIndex: currentState.currentSoalIndex,
            totalSkor: currentState.totalSkor,
            jawabanTerungkap: new Set(currentState.jawabanTerungkap), // Konversi kembali ke Set
            shuffledSoal: reconstructedShuffledSoal // Daftar soal lengkap yang sudah diacak
        };
        next(); // Lanjutkan ke route handler
    } catch (error) {
        console.error("Error memuat game state dari Firebase middleware:", error);
        res.status(500).json({ success: false, message: "Server error: Gagal memuat game state dari DB." });
    }
});


// --- API Endpoints ---
app.post('/api/submit-answer', async (req, res) => {
    const { answer } = req.body;
    let { currentSoalIndex, totalSkor, jawabanTerungkap, shuffledSoal } = req.gameState;

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

    let responseData = { success: false, message: "Jawaban salah atau sudah terungkap." }; // Default
    let updatedGameStateForDB = null; // Untuk menyimpan state yang akan ditulis ke DB

    if (foundAnswer) {
        jawabanTerungkap.add(foundAnswer.text.toLowerCase());
        totalSkor += foundAnswer.score;

        let allAnswersRevealedForCurrentQuestion = (jawabanTerungkap.size === currentSoal.answers.length);
        let gameEnded = false;
        let movedToNextQuestion = false;

        let nextCurrentSoalIndex = currentSoalIndex;
        let nextJawabanTerungkap = new Set(jawabanTerungkap); // Buat salinan

        if (allAnswersRevealedForCurrentQuestion) {
            if (currentSoalIndex < shuffledSoal.length - 1) {
                nextCurrentSoalIndex++;
                nextJawabanTerungkap.clear(); // Reset untuk soal baru
                movedToNextQuestion = true;
            } else {
                nextCurrentSoalIndex++; // Tandai game selesai
                nextJawabanTerungkap.clear();
                gameEnded = true;
            }
        }

        updatedGameStateForDB = {
            currentSoalIndex: nextCurrentSoalIndex,
            totalSkor: totalSkor,
            jawabanTerungkap: Array.from(nextJawabanTerungkap), // Konversi Set ke Array untuk DB
            shuffledSoalList: shuffledSoal.map(s => s.id) // Simpan ID soal
        };

        const currentQuestionAnswers = currentSoal.answers;
        const currentRevealedAnswersData = Array.from(jawabanTerungkap).map(text => currentQuestionAnswers.find(a => a.text.toLowerCase() === text));


        responseData = {
            success: true,
            message: "Jawaban benar!",
            answerRevealed: foundAnswer.text,
            scoreAdded: foundAnswer.score,
            score: totalSkor, // Skor terbaru
            allAnswersRevealedForCurrentQuestion: allAnswersRevealedForCurrentQuestion,
            movedToNextQuestion: movedToNextQuestion,
            gameEnded: gameEnded,
            // Kirim data untuk soal yang akan ditampilkan di frontend
            answers: (gameEnded || movedToNextQuestion) ? (shuffledSoal[nextCurrentSoalIndex]?.answers || []) : currentQuestionAnswers,
            revealedAnswers: (gameEnded || movedToNextQuestion) ? [] : currentRevealedAnswersData
        };

    } else { // Jawaban salah atau sudah terungkap
        const currentQuestionAnswers = currentSoal.answers;
        const currentRevealedAnswersData = Array.from(jawabanTerungkap).map(text => currentQuestionAnswers.find(a => a.text.toLowerCase() === text));
        
        responseData = {
            success: false,
            message: "Jawaban salah atau sudah terungkap.",
            score: totalSkor, // Skor saat ini
            answers: currentQuestionAnswers, // Jawaban lengkap untuk soal yang sama
            revealedAnswers: currentRevealedAnswersData // Jawaban terungkap saat ini
        };
    }

    // --- Simpan state yang diperbarui ke Firebase jika ada perubahan (hanya jika sukses) ---
    if (updatedGameStateForDB) {
        try {
            await setGameState(updatedGameStateForDB);
        } catch (dbError) {
            console.error("Error saving game state to DB after submit:", dbError);
            // Anda bisa memutuskan apakah akan mengirim status 500 ke client atau tetap 200
            // Jika Anda tetap mengirim 200, frontend mungkin tidak tahu ada masalah DB
        }
    }
    
    return res.json(responseData);
});

app.get('/api/current-question', async (req, res) => {
    let { currentSoalIndex, totalSkor, jawabanTerungkap, shuffledSoal } = req.gameState;

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
    const currentRevealedAnswersData = Array.from(jawabanTerungkap).map(text => currentSoal.answers.find(a => a.text.toLowerCase() === text));

    res.json({
        question: currentSoal.question,
        answers: currentSoal.answers,
        revealedAnswers: currentRevealedAnswersData,
        score: totalSkor,
        gameEnded: false
    });
});

app.post('/api/next-question', async (req, res) => {
    let { currentSoalIndex, totalSkor, jawabanTerungkap, shuffledSoal } = req.gameState;
    
    let newSoalIndex = currentSoalIndex;
    let newJawabanTerungkap = new Set(); // Jawaban terungkap di soal baru akan kosong
    let gameEnded = false;

    if (currentSoalIndex < shuffledSoal.length - 1) {
        newSoalIndex++;
    } else {
        newSoalIndex = shuffledSoal.length; // Tandai game selesai
        gameEnded = true;
    }

    const updatedGameStateForDB = {
        currentSoalIndex: newSoalIndex,
        totalSkor: totalSkor,
        jawabanTerungkap: Array.from(newJawabanTerungkap),
        shuffledSoalList: shuffledSoal.map(s => s.id)
    };

    try {
        await setGameState(updatedGameStateForDB);
    } catch (dbError) {
        console.error("Error saving game state to DB after next-question:", dbError);
        return res.status(500).json({ success: false, message: "Server error: Gagal menyimpan game state ke DB." });
    }

    const nextSoal = shuffledSoal[newSoalIndex];
    const nextQuestionAnswers = nextSoal?.answers || [];
    const nextRevealedAnswersData = []; // Selalu kosong untuk soal baru

    return res.json({
        success: true,
        message: "Pindah ke soal berikutnya.",
        question: nextSoal?.question || "Game Selesai!",
        answers: nextQuestionAnswers,
        revealedAnswers: nextRevealedAnswersData,
        score: totalSkor, // Skor tetap dibawa
        gameEnded: gameEnded
    });
});

app.post('/api/reset-game', async (req, res) => {
    try {
        const newGameState = await initializeNewGameData(); // Reset di DB juga
        const initialSoal = allSoal.find(s => s.id === newGameState.shuffledSoalOrder[0]); // Ambil soal pertama yang baru diacak
        
        return res.json({
            success: true,
            message: "Game di-reset.",
            question: initialSoal?.question,
            answers: initialSoal?.answers || [],
            revealedAnswers: [],
            score: newGameState.totalSkor,
            gameEnded: false
        });
    } catch (error) {
        console.error("Error resetting game:", error);
        return res.status(500).json({ success: false, message: "Server error: Gagal mereset game." });
    }
});

module.exports = app;
