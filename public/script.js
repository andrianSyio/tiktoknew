// api/index.js
const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin'); // Import Firebase Admin SDK
const http = require('http'); // Import modul HTTP
const { Server } = require('socket.io'); // Import Socket.IO Server

const app = express();
const server = http.createServer(app); // Buat server HTTP dari aplikasi Express
// Inisialisasi Socket.IO dan kaitkan dengan server HTTP
const io = new Server(server, {
    cors: {
        origin: "https://tiktoknew-delta.vercel.app", // Ganti dengan domain Vercel Anda yang sebenarnya!
        methods: ["GET", "POST"]
    }
});

app.use(cors()); // Izinkan CORS
app.use(express.json()); // Parsing JSON body

// --- AWAL HARDCODING KUNCI AKUN LAYANAN FIREBASE ---
// !!! PERINGATAN SANGAT KERAS: INI HANYA UNTUK SEMENTARA & BERISIKO KEAMANAN TINGGI !!!
// !!! WAJIB UBAH KEMBALI KE PENGGUNAAN ENVIRONMENT VARIABLE SEGERA SETELAH DEADLINE/TESTING !!!
const serviceAccount = {
  "type": "service_account",
  "project_id": "masjawir-c7272",
  "private_key_id": "e9169bda620f49e57bb22326183d230091d69ac7",
  "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQCT6e5u3IvMxcky\npOAKp2qWlBgiWGInPuDy3CLL/QxAaAYrdZoLB6ejKoyEJuVSDdtk90Z0CtWXtExC\nNb/LrjKraoqam/p1gyFO+4gmohiINsJipRJrv7EY+ngCgqSAjPaRj8h9WHb/htFl\nwbUuCoWy6O9ds9i6iIj+I5IMgKDoT6xB2SFiM+xiJNDzNdMaXC/fufEOC1ZoUf/q\nTBQzsAfckeFRAIbmfEFNjCDfbh21N91lTTV7HznJIdCRH0e2KxK3GTjd72lVJbKo\nL9cv1hETCWB8wYWzhaoztSY0rhjDOlPC7SUJLRnHiQKzBm++XqDINPdUvvO2cudX\n/GOP7KUTAgMBAAECggEAEI8q81xbhlRKPxI4RtkRVMRFo2qzqmMeufGtL5snyPoc\nXrcuxLdZrCmyS4UzPSlx+263g3xHB1HXC76Kt1nMMGagF8kIlClXDEmap4CUMIO4\n5WRHmKqAQCSiVN2dXwro+8jWEDpcMCU+wh6akwn4h9wOGDZvOArbE2CWFDI+UWOW\nZXuVVctyQQlNh0LTki+uWlucM8QjRWMOzaCVb4U7dYYjbnbwNHxNesv13DK/NKJb\nyNAvEQr90Gr58F90EZ7HuCg1rDuqhXDuScia8H6T5R3utExNNCAjSQYShpRQBOF5\n0XTicPsmGdntdr8OWqvcBTiBdJvbz6k9GQ/PB714cQKBgQDO11w5GzF62zFnvwTK\ncyf9Z0KQosXEeiwhlJ6oyCDiYO3TM52UqWYuyAhADXubFd1rb4MfXd3zShXxRSi0\nSCVe71XCiJKITJK7BlZe8+YRv9SKXfJtl8vLZ96FA8BvfgZ06epJWO/Fv4PDShC8\nigTZJmNZs00FRVIGK16yUeUlCwKBgQC3EU46ieeKUXo2arb9GPMRIFYXlG6Z7+GL\nRMa/rgoSBZ3Po0C6pDVNNLDUoyvbpxMePYcZPyH7iOSkP3VSY6E8xGGquaoaUmOY\nCgE4jauqeqzD5hweD1PeIK6xxt0IKznY9BAEEBD6ZQpmkd6ZJmL3kgeI3boSmz2s\ncUk3app1GQKBgA72i2hiLDksBC3yJqGSpRDy2GDoNZBaGjkvrC6fk6lsw6eks0Ce\n5JJ7zAT+NLPqaBpUzdKGEtlXwbCbhS9NjM6KV9Tj1l3f1DmNYtApqrob+38q/q+o\n7IhBclqDA/fM0SDCDz3RHj9a9Gg7QmyxO1qOKV/C1c6Mzjs+BfK2c/IzAoGBAI8i\n/tGShfGGZ1Io+k7H7fc+Of7kN94wy18DNYsl30XcEloJQVEtl2d4bVK1ClPCPJaG\ncR1yWXW8wVkTLP5wW9+RhPPiG3hdNvXnzLCVRMYVCQRa5V0zitXBJBZocOY0NhTG\nL8edcEj3u7wbDbsdYoBEM5P2Gcj2jLBKG38y4PXxAoGBAMtPcW/lWApQz4Wi7hY7\nfkLhpTjxunZ/8wY9rLASYEMMxESXNPuDuErqnPZsKJ91cax8KaOYPVzS5di7T1Sd\nHI2hQPbuvk5M683ze7f4+pRnIk6ZfwnyNEiYwA16nVDY92KMGx/8Sw72Emp+hcZk\nHD2XwqW9nIb3MogL5vhkszWY\n-----END PRIVATE KEY-----\n",
  "client_email": "firebase-adminsdk-fbsvc@masjawir-c7272.iam.gserviceaccount.com",
  "client_id": "102694364533916991324",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-fbsvc%40masjawir-c7272.iam.gserviceaccount.com",
  "universe_domain": "googleapis.com"
};

try {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL: "https://masjawir-c7272-default-rtdb.firebaseio.com" // Pastikan ini URL database Anda
    });
    console.log("Firebase Admin SDK initialized successfully (HARDCODED KEY).");
} catch (error) {
    console.error("ERROR: Failed to initialize Firebase Admin SDK (HARDCODED KEY).", error);
}
// --- AKHIR HARDCODING KUNCI AKUN LAYANAN ---

const db = admin.database();
const gameRef = db.ref('game_state');

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
            jawabanTerungkap: new Set(currentState.jawabanTerungkap || []), // Konversi kembali ke Set
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
        const currentRevealedAnswersData = Array.from(jawabanTerungkap).map(text => currentQuestionAnswers.find(a => a.text.toLowerCase() === text)).filter(a => a);


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
        const currentRevealedAnswersData = Array.from(jawabanTerungkap).map(text => currentQuestionAnswers.find(a => a.text.toLowerCase() === text)).filter(a => a);
        
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
            // --- BARU: Emit event WebSocket ke semua client setelah berhasil disimpan ke DB ---
            const currentSoalUpdated = shuffledSoal[updatedGameStateForDB.currentSoalIndex];
            const updatedRevealedAnswersData = Array.from(updatedGameStateForDB.jawabanTerungkap).map(text => currentSoalUpdated?.answers.find(a => a.text.toLowerCase() === text)).filter(a => a);

            io.emit('game_state_update', {
                question: currentSoalUpdated?.question || "Game Selesai!",
                answers: currentSoalUpdated?.answers || [],
                revealedAnswers: updatedRevealedAnswersData,
                score: updatedGameStateForDB.totalSkor,
                gameEnded: updatedGameStateForDB.currentSoalIndex >= shuffledSoal.length
            });

        } catch (dbError) {
            console.error("Error saving game state to DB after submit:", dbError);
            return res.status(500).json({ success: false, message: "Server error: Gagal menyimpan game state ke DB." });
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
    const currentRevealedAnswersData = Array.from(jawabanTerungkap).map(text => currentSoal.answers.find(a => a.text.toLowerCase() === text)).filter(a => a);

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
        // --- BARU: Emit event WebSocket setelah berhasil disimpan ke DB ---
        const nextSoal = shuffledSoal[newSoalIndex];
        const nextQuestionAnswers = nextSoal?.answers || [];
        const nextRevealedAnswersData = [];
        io.emit('game_state_update', {
            question: nextSoal?.question || "Game Selesai!",
            answers: nextQuestionAnswers,
            revealedAnswers: nextRevealedAnswersData,
            score: totalSkor,
            gameEnded: gameEnded
        });
    } catch (dbError) {
        console.error("Error saving game state to DB after next-question:", dbError);
        return res.status(500).json({ success: false, message: "Server error: Gagal menyimpan game state ke DB." });
    }

    const nextSoal = shuffledSoal[newSoalIndex];
    const nextQuestionAnswers = nextSoal?.answers || [];
    const nextRevealedAnswersData = [];

    return res.json({
        success: true,
        message: "Pindah ke soal berikutnya.",
        question: nextSoal?.question || "Game Selesai!",
        answers: nextQuestionAnswers,
        revealedAnswers: nextRevealedAnswersData,
        score: totalSkor,
        gameEnded: gameEnded
    });
});

app.post('/api/reset-game', async (req, res) => {
    try {
        const newGameState = await initializeNewGameData(); // Reset di DB juga
        const initialSoal = allSoal.find(s => s.id === newGameState.shuffledSoalOrder[0]); // Ambil soal pertama yang baru diacak
        
        // --- BARU: Emit event WebSocket setelah berhasil disimpan ke DB ---
        io.emit('game_state_update', {
            question: initialSoal?.question,
            answers: initialSoal?.answers || [],
            revealedAnswers: [],
            score: newGameState.totalSkor,
            gameEnded: false
        });

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

// --- PENTING UNTUK VERCEL: Export server, bukan app ---
// Ini adalah bagian yang paling kompleks untuk Vercel.
// Vercel Serverless Functions biasanya mengekspor 'app' (aplikasi Express).
// Mengekspor 'server' (HTTP server yang menjalankan Socket.IO) mungkin tidak langsung bekerja
// di lingkungan serverless standar Vercel untuk koneksi persistent.
// Anda mungkin perlu menggunakan Custom Serverless Function atau mempertimbangkan
// layanan WebSocket terkelola (Pusher/Ably) untuk kestabilan di Vercel.
// Untuk mencoba, kita akan mengekspor server, tapi ini bisa jadi titik masalah.
module.exports = server;
