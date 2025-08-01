// api/index.js (Modifikasi untuk Socket.IO)
const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');
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

app.use(cors());
app.use(express.json());

// --- INISIALISASI FIREBASE ADMIN SDK (Sama seperti sebelumnya) ---
if (!process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
  console.error("ERROR: Environment variable 'FIREBASE_SERVICE_ACCOUNT_KEY' is not set.");
} else {
  try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL: "https://masjawir-c7272-default-rtdb.firebaseio.com" // Sesuaikan PROJECT_ID Anda
    });
    console.log("Firebase Admin SDK initialized successfully.");
  } catch (error) {
    console.error("ERROR: Failed to initialize Firebase Admin SDK.", error);
  }
}

const db = admin.database();
const gameRef = db.ref('game_state');

// ... (getGameState, setGameState, shuffleArray, initializeNewGameData - SAMA seperti sebelumnya) ...
// Anda bisa menyalin kembali fungsi-fungsi ini dari api/index.js terakhir yang saya berikan.

// Middleware untuk memuat state game sebelum setiap request (SAMA seperti sebelumnya)
app.use(async (req, res, next) => {
    // ... (logika middleware sama seperti sebelumnya) ...
    // Pastikan req.gameState diset
    if (!admin.apps.length) { // Pastikan Firebase terinisialisasi
        return res.status(500).json({ success: false, message: "Server error: Firebase not initialized." });
    }
    // ... (rest of middleware logic) ...
    next();
});

// --- SOCKET.IO: Koneksi WebSocket ---
io.on('connection', (socket) => {
    console.log('A client connected via WebSocket:', socket.id);

    // Anda bisa mengirim state game saat ini ke client baru yang terhubung
    // Ini penting agar client yang baru bergabung langsung mendapat state terkini
    getGameState().then(state => {
        if(state) {
            // Rekonstruksi shuffledSoal dan jawaban terungkap untuk client
            const allSoalTemp = require('./data-soal.json');
            const reconstructedShuffledSoal = state.shuffledSoalOrder.map(id => 
                allSoalTemp.find(s => s.id === id)
            ).filter(s => s !== undefined);
            
            const currentSoal = reconstructedShuffledSoal[state.currentSoalIndex];
            const currentRevealedAnswersData = Array.from(new Set(state.jawabanTerungkap)).map(text => currentSoal?.answers.find(a => a.text.toLowerCase() === text)).filter(a => a); // Filter undefined

            socket.emit('game_state_update', {
                question: currentSoal?.question || "Game Selesai!",
                answers: currentSoal?.answers || [],
                revealedAnswers: currentRevealedAnswersData,
                score: state.totalSkor,
                gameEnded: state.currentSoalIndex >= reconstructedShuffledSoal.length
            });
        }
    }).catch(console.error);

    socket.on('disconnect', () => {
        console.log('Client disconnected via WebSocket:', socket.id);
    });
    // Anda bisa menambahkan event listener lain jika frontend perlu mengirim pesan ke backend
});


// --- API Endpoints (app.post, app.get) ---
// Logika utama di sini SAMA, tapi setelah update ke DB, EMIT event WebSocket
app.post('/api/submit-answer', async (req, res) => {
    // ... (logika submit-answer SAMA seperti sebelumnya) ...
    // Pastikan game_state_update disimpan ke Firebase DULU
    if (updatedGameStateForDB) { // Jika ada perubahan state yang perlu disimpan
        try {
            await setGameState(updatedGameStateForDB); // Simpan ke Firebase
            // --- BARU: Emit event WebSocket setelah berhasil disimpan ke DB ---
            // Kirim state game terbaru ke semua client yang terhubung
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
            console.error("Error saving game state to DB after submit (WebSocket not emitted):", dbError);
            return res.status(500).json({ success: false, message: "Server error: Gagal menyimpan game state ke DB." });
        }
    }
    return res.json(responseData);
});

// Endpoint untuk GET /api/current-question (tetap diperlukan untuk inisialisasi awal)
app.get('/api/current-question', async (req, res) => {
    // ... (logika SAMA seperti sebelumnya) ...
    return res.json({ /* ... data game ... */ });
});

app.post('/api/next-question', async (req, res) => {
    // ... (logika next-question SAMA seperti sebelumnya) ...
    // Setelah setGameState(updatedGameStateForDB) berhasil:
    // --- BARU: Emit event WebSocket ---
    try {
        await setGameState(updatedGameStateForDB);
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
    } catch (dbError) { /* ... handle error ... */ }
    return res.json(responseData);
});

app.post('/api/reset-game', async (req, res) => {
    // ... (logika reset-game SAMA seperti sebelumnya) ...
    // Setelah newGameState = await initializeNewGameData() berhasil:
    // --- BARU: Emit event WebSocket ---
    try {
        const newGameState = await initializeNewGameData();
        const initialSoal = allSoal.find(s => s.id === newGameState.shuffledSoalOrder[0]);
        io.emit('game_state_update', {
            question: initialSoal?.question,
            answers: initialSoal?.answers || [],
            revealedAnswers: [],
            score: newGameState.totalSkor,
            gameEnded: false
        });
    } catch (error) { /* ... handle error ... */ }
    return res.json(responseData);
});


// --- PENTING UNTUK VERCEL: Export server, bukan app ---
// Ini adalah bagian yang paling kompleks untuk Vercel.
// Vercel Serverless Functions biasanya mengekspor 'app' (aplikasi Express).
// Mengekspor 'server' (HTTP server yang menjalankan Socket.IO) mungkin tidak langsung bekerja
// di lingkungan serverless standar Vercel untuk koneksi persistent.
// Anda mungkin perlu menggunakan Custom Serverless Function atau mempertimbangkan
// layanan WebSocket terkelola (Pusher/Ably) untuk kestabilan di Vercel.
// Untuk mencoba, kita akan mengekspor server, tapi ini bisa jadi titik masalah.
module.exports = server; // Coba ini dulu, mungkin Vercel memiliki workaround internal.
