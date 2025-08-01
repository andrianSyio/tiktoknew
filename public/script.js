// public/script.js

// --- BARU: Inisialisasi Socket.IO Client ---
// window.location.origin akan secara otomatis menggunakan domain Vercel Anda
const socket = io(window.location.origin);

const API_URL = '/api'; // Tetap /api untuk Vercel deployment

const questionElement = document.getElementById('question');
const answersList = document.getElementById('answers');
const totalScoreElement = document.getElementById('totalScore');
const messageElement = document.getElementById('message'); // Untuk panel admin

const playerNameInput = document.getElementById('playerNameInput');
const answerInput = document.getElementById('answerInput');
const leaderboardElement = document.getElementById('leaderboard');

const playerNotification = document.getElementById('playerNotification');
const winnerOverlay = document.getElementById('winnerOverlay');
const roundWinnerName = document.getElementById('roundWinnerName');
const roundWinnerScore = document.getElementById('roundWinnerScore');
const questionBox = document.getElementById('questionBox');
const answersContainer = document.getElementById('answersContainer');
const toggleRefreshButton = document.getElementById('toggleRefreshButton'); // Tombol ini mungkin tidak lagi digunakan untuk auto-refresh

let playerLeaderboard = []; // In-memory leaderboard data (frontend saja)

const NOTIFICATION_DURATION = 3000;
const WINNER_SCREEN_DURATION = 6000;
// const AUTO_REFRESH_INTERVAL_MS = 2000; // Tidak lagi digunakan untuk auto-refresh
// let autoRefreshIntervalId = null; // Tidak lagi digunakan

async function showMessage(msg, type = 'info', duration = 3000) {
    messageElement.textContent = msg;
    messageElement.className = `message show ${type}`;
    setTimeout(() => {
        messageElement.classList.remove('show');
    }, duration);
}

function showPlayerAnswerNotification(playerName, scoreAdded) {
    playerNotification.textContent = `${playerName} +${scoreAdded} PT!`;
    playerNotification.classList.add('show');
    setTimeout(() => {
        playerNotification.classList.remove('show');
    }, NOTIFICATION_DURATION);
}

function updateLeaderboardDisplay() {
    leaderboardElement.innerHTML = '';
    playerLeaderboard.sort((a, b) => b.score - a.score);

    playerLeaderboard.forEach(player => {
        const listItem = document.createElement('li');
        listItem.classList.add('leaderboard-item');
        listItem.innerHTML = `<span>${player.name}</span><span>${player.score}</span>`;
        leaderboardElement.appendChild(listItem);
    });
}

function showRoundWinnerScreen(finalScore, roundTopPlayer) {
    // stopAutoRefresh(); // Tidak perlu lagi jika tidak ada setInterval
    questionBox.classList.add('hidden');
    answersContainer.classList.add('hidden');

    roundWinnerName.textContent = roundTopPlayer.name;
    roundWinnerScore.textContent = roundTopPlayer.score;
    winnerOverlay.classList.remove('hidden'); 
    setTimeout(() => {
        winnerOverlay.classList.add('show');
    }, 50);

    setTimeout(() => {
        winnerOverlay.classList.remove('show');
        setTimeout(() => {
            winnerOverlay.classList.add('hidden');
            // Setelah layar pemenang, backend akan emit 'game_state_update' untuk soal baru
            // fetchCurrentQuestion(); // Tidak perlu panggil di sini, akan ada dari WebSocket
            // startAutoRefresh(); // Tidak perlu lagi
        }, 500);
    }, WINNER_SCREEN_DURATION);
}

// Fungsi bantu untuk merender jawaban (digunakan ketika menerima update via WebSocket)
function renderAnswers(allAnswers, revealedAnswersData) {
    answersList.innerHTML = '';
    const revealedAnswerTexts = new Set(revealedAnswersData.map(ans => ans.text.toLowerCase()));

    const numberOfAnswerSlots = 5;
    for (let i = 0; i < numberOfAnswerSlots; i++) {
        const li = document.createElement('li');
        li.classList.add('answer-item');

        const originalAnswerDefinition = allAnswers[i];

        if (originalAnswerDefinition) {
            const isRevealed = revealedAnswerTexts.has(originalAnswerDefinition.text.toLowerCase());

            if (isRevealed) {
                const actualRevealedData = revealedAnswersData.find(
                    revealed => revealed.text.toLowerCase() === originalAnswerDefinition.text.toLowerCase()
                );
                li.classList.add('revealed');
                li.innerHTML = `<span class="answer-text">${actualRevealedData.text}</span><span class="answer-score">${actualRevealedData.score}</span>`;
            } else {
                li.innerHTML = `<span class="answer-text placeholder">____</span><span class="answer-score"></span>`;
            }
        } else {
            li.innerHTML = `<span class="answer-text placeholder">____</span><span class="answer-score"></span>`;
        }
        answersList.appendChild(li);
    }
}


async function submitPlayerAnswer() {
    const playerName = playerNameInput.value.trim();
    const answer = answerInput.value.trim();

    if (!playerName || !answer) {
        showMessage("Nama pemain dan jawaban harus diisi!", 'warning');
        return;
    }

    try {
        const response = await fetch(`${API_URL}/submit-answer`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ answer })
        });
        const data = await response.json(); // Mengandung updated score, revealedAnswers, answers

        // UI akan diupdate melalui WebSocket, tapi notifikasi ini bisa tetap instan
        if (data.success) {
            showPlayerAnswerNotification(playerName, data.scoreAdded);
            // Leaderboard adalah data lokal, jadi update langsung
            let player = playerLeaderboard.find(p => p.name.toLowerCase() === playerName.toLowerCase());
            if (player) {
                player.score += data.scoreAdded;
            } else {
                playerLeaderboard.push({ name: playerName, score: data.scoreAdded });
            }
            updateLeaderboardDisplay();

            // Layar pemenang juga akan dipicu oleh WebSocket dari backend
            // Jika Anda ingin ini instan, Anda bisa memicu langsung di sini
            if (data.allAnswersRevealedForCurrentQuestion) {
                const topPlayer = playerLeaderboard.length > 0 ? playerLeaderboard[0] : { name: "Tidak Ada", score: 0 };
                showRoundWinnerScreen(data.score, topPlayer); 
            }
        } else {
            showMessage(`"${answer}" salah. ${data.message || ''}`, 'error');
            // Backend akan mengirim update via WebSocket jika ada perubahan status (misal jawaban terungkap)
        }
        answerInput.value = '';
    } catch (error) {
        console.error("Error submitting player answer:", error);
        showMessage("Terjadi kesalahan saat submit jawaban pemain. Coba lagi.", 'error', 5000);
    }
}

// fetchCurrentQuestion sekarang hanya untuk inisialisasi awal atau fallback jika WebSocket putus
async function fetchCurrentQuestion() {
    try {
        const response = await fetch(`${API_URL}/current-question`);
        const data = await response.json();

        if (data.gameEnded) {
            questionElement.innerText = data.question;
            answersList.innerHTML = '<li class="answer-item"><span class="answer-text">Terima kasih sudah bermain!</span></li>';
            totalScoreElement.innerText = data.score;
            showMessage("Game telah berakhir. Silakan reset untuk mulai baru.", 'info', 5000);
            questionBox.classList.remove('hidden');
            answersContainer.classList.remove('hidden');
            return;
        }

        questionElement.innerText = data.question;
        totalScoreElement.innerText = data.score;
        renderAnswers(data.answers, data.revealedAnswers);

    } catch (error) {
        console.error("Error fetching current question (initial load or fallback):", error);
        questionElement.innerText = "Gagal memuat game. Coba lagi.";
        showMessage("Gagal memuat game. Cek koneksi server atau WebSocket.", 'error', 5000);
    }
}

async function nextQuestion() {
    if (!confirm("Yakin ingin pindah ke soal berikutnya? Jawaban yang belum terungkap akan hilang.")) {
        return;
    }
    // Tidak perlu stopAutoRefresh
    winnerOverlay.classList.add('hidden');
    winnerOverlay.classList.remove('show');
    questionBox.classList.remove('hidden');
    answersContainer.classList.remove('hidden');

    try {
        const response = await fetch(`${API_URL}/next-question`, { method: 'POST' });
        const data = await response.json();
        // UI akan diupdate via WebSocket setelah backend simpan ke DB
        if (data.success) {
            showMessage(data.message, 'success');
        } else {
            showMessage("Gagal pindah soal: " + data.message, 'error');
            fetchCurrentQuestion(); // Fallback update jika ada error
        }
    } catch (error) {
        console.error("Error moving to next question:", error);
        showMessage("Gagal pindah soal. Cek koneksi server.", 'error', 5000);
    }
}

async function resetGame() {
    if (!confirm("Yakin ingin me-reset game? Semua skor dan progres akan hilang.")) {
        return;
    }
    winnerOverlay.classList.add('hidden');
    winnerOverlay.classList.remove('show');
    questionBox.classList.remove('hidden');
    answersContainer.classList.remove('hidden');

    try {
        const response = await fetch(`${API_URL}/reset-game`, { method: 'POST' });
        const data = await response.json();
        // UI akan diupdate via WebSocket setelah backend simpan ke DB
        if (data.success) {
            showMessage(data.message, 'success');
            playerLeaderboard = [];
            updateLeaderboardDisplay();
        } else {
            showMessage("Gagal me-reset game: " + data.message, 'error');
        }
    } catch (error) {
        console.error("Error resetting game:", error);
        showMessage("Gagal me-reset game. Cek koneksi server.", 'error', 5000);
    }
}

// Fungsi untuk mengontrol auto-refresh - TIDAK DIGUNAKAN UNTUK POLLING REGULER LAGI
// Tombol ini bisa diubah fungsinya atau dihapus
function startAutoRefresh() { console.warn("Auto-refresh (polling) is deprecated for WebSockets."); }
function stopAutoRefresh() { console.warn("Auto-refresh (polling) is deprecated for WebSockets."); }
function toggleAutoRefresh() { console.warn("Toggle auto-refresh button is deprecated for WebSockets."); }


// --- BARU: Event listener untuk WebSocket ---
socket.on('connect', () => {
    console.log('Connected to WebSocket server');
    // Ketika terhubung, fetch state awal untuk memastikan sinkronisasi
    fetchCurrentQuestion(); 
});

socket.on('disconnect', () => {
    console.log('Disconnected from WebSocket server. Trying to reconnect...');
    // Mungkin tambahkan logika reconnect atau pesan error ke pengguna
});

socket.on('connect_error', (err) => {
    console.error('WebSocket connection error:', err.message);
    showMessage(`WebSocket Error: ${err.message}. Cek koneksi.`, 'error', 0);
});

// --- BARU: Mendengarkan update status game dari backend ---
socket.on('game_state_update', (data) => {
    console.log("Received game state update via WebSocket:", data);
    // Jika layar pemenang tidak aktif, update UI utama
    if (!winnerOverlay.classList.contains('show')) {
        questionElement.innerText = data.question;
        totalScoreElement.innerText = data.score;
        renderAnswers(data.answers, data.revealedAnswers);
    }
    // Jika semua jawaban terungkap (dan bukan game berakhir total), tampilkan layar pemenang
    if (data.allAnswersRevealedForCurrentQuestion && !data.gameEnded) {
        // Asumsi leaderboard sudah diupdate secara lokal atau akan diupdate setelah DB write
        const topPlayer = playerLeaderboard.length > 0 ? playerLeaderboard[0] : { name: "Tidak Ada", score: data.score };
        showRoundWinnerScreen(data.score, topPlayer);
    }
    // Jika game berakhir total
    if (data.gameEnded) {
        // Ini akan ditangani oleh fetchCurrentQuestion yang dipanggil setelah layar pemenang atau reset
    }
});


// Initial load (Ini akan memicu koneksi WebSocket dan fetch state awal)
document.addEventListener('DOMContentLoaded', () => {
    // fetchCurrentQuestion(); // Ini akan dipicu oleh event 'connect' WebSocket
    updateLeaderboardDisplay();
});
