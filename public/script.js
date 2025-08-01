// public/script.js

// --- BARU: Inisialisasi Socket.IO Client ---
// Pastikan URL ini sesuai dengan domain Vercel Anda.
// io() tanpa argumen akan mencoba menyambung ke host saat ini.
// Atau bisa spesifik: const socket = io('https://tiktoknew-delta.vercel.app');
const socket = io(); 

const API_URL = '/api'; // Tetap /api untuk Vercel deployment

const questionElement = document.getElementById('question');
const answersList = document.getElementById('answers');
const totalScoreElement = document.getElementById('totalScore');
const answerInput = document.getElementById('answerInput');
const playerNameInput = document.getElementById('playerNameInput');
const messageElement = document.getElementById('message');
const playerNotificationElement = document.getElementById('playerNotification');
const winnerOverlay = document.getElementById('winnerOverlay');
const roundWinnerName = document.getElementById('roundWinnerName');
const roundWinnerScore = document.getElementById('roundWinnerScore');
const questionBox = document.getElementById('questionBox');
const answersContainer = document.getElementById('answersContainer');

let playerLeaderboard = []; // In-memory leaderboard data (frontend saja)

const NOTIFICATION_DURATION = 3000; // 3 detik
const WINNER_SCREEN_DURATION = 6000; // 6 detik

// --- Socket.IO Event Listeners ---
socket.on('connect', () => {
    console.log('Connected to WebSocket server');
    // Ketika terhubung, fetch state awal untuk memastikan sinkronisasi
    fetchCurrentQuestion(); 
});

socket.on('disconnect', () => {
    console.log('Disconnected from WebSocket server');
    showMessage('Koneksi WebSocket terputus. Mencoba menyambung kembali...', 'warning');
});

socket.on('connect_error', (err) => {
    console.error('WebSocket connection error:', err);
    showMessage('Gagal terhubung ke WebSocket: ' + err.message, 'error');
});

socket.on('game_state_update', (data) => {
    console.log('Received game_state_update:', data);
    // Update UI dengan data yang diterima
    renderGameDisplay(data);

    // Jika game berakhir, tampilkan overlay pemenang
    if (data.gameEnded) {
        showWinnerOverlay();
    } else {
        hideWinnerOverlay(); // Pastikan overlay tersembunyi jika game belum berakhir
    }
});

// --- Fungsi Render UI ---
function renderGameDisplay(state) {
    questionElement.textContent = state.question;
    totalScoreElement.textContent = state.score;

    answersList.innerHTML = ''; // Kosongkan jawaban lama

    const totalAnswerSlots = 5;
    const revealedAnswerTexts = new Set(state.revealedAnswers.map(a => a.text.toLowerCase()));

    // Urutkan jawaban yang terungkap agar muncul di atas
    const sortedAnswers = [...state.answers].sort((a, b) => {
        const aRevealed = revealedAnswerTexts.has(a.text.toLowerCase());
        const bRevealed = revealedAnswerTexts.has(b.text.toLowerCase());
        if (aRevealed && !bRevealed) return -1;
        if (!aRevealed && bRevealed) return 1;
        return 0; // Pertahankan urutan asli jika keduanya terungkap atau tidak
    });

    sortedAnswers.forEach(answer => {
        const li = document.createElement('li');
        li.classList.add('answer-item');
        const isRevealed = revealedAnswerTexts.has(answer.text.toLowerCase());
        if (isRevealed) {
            li.classList.add('revealed');
        }

        const answerTextSpan = document.createElement('span');
        answerTextSpan.classList.add('answer-text');
        answerTextSpan.textContent = isRevealed ? answer.text : '???';
        li.appendChild(answerTextSpan);

        const answerScoreSpan = document.createElement('span');
        answerScoreSpan.classList.add('answer-score');
        answerScoreSpan.textContent = isRevealed ? answer.score : '';
        li.appendChild(answerScoreSpan);

        answersList.appendChild(li);
    });

    // Tambahkan placeholder jika jumlah jawaban kurang dari 5
    for (let i = state.answers.length; i < totalAnswerSlots; i++) {
        const li = document.createElement('li');
        li.classList.add('answer-item', 'placeholder');
        const answerTextSpan = document.createElement('span');
        answerTextSpan.classList.add('answer-text');
        answerTextSpan.textContent = '???';
        li.appendChild(answerTextSpan);

        const answerScoreSpan = document.createElement('span');
        answerScoreSpan.classList.add('answer-score');
        answerScoreSpan.textContent = '';
        li.appendChild(answerScoreSpan);
        answersList.appendChild(li);
    }
}


function showMessage(msg, type = 'info') {
    messageElement.textContent = msg;
    messageElement.className = `message show ${type}`;
    setTimeout(() => {
        messageElement.classList.remove('show');
    }, 3000); // Pesan akan hilang setelah 3 detik
}

function showPlayerNotification(playerName, answerText) {
    playerNotificationElement.textContent = `${playerName} menjawab: ${answerText}!`;
    playerNotificationElement.classList.add('show');
    setTimeout(() => {
        playerNotificationElement.classList.remove('show');
    }, 4000); // Notifikasi akan hilang setelah 4 detik
}

function showWinnerOverlay() {
    winnerOverlay.classList.remove('hidden');
    winnerOverlay.classList.add('show');
    // TODO: Implementasi logika untuk menentukan pemenang putaran
    // Untuk sementara, kita bisa menampilkan total skor game
    roundWinnerName.textContent = "TIM ANDA"; // Placeholder
    roundWinnerScore.textContent = currentGameState.score; // Total skor game
}

function hideWinnerOverlay() {
    winnerOverlay.classList.remove('show');
    winnerOverlay.classList.add('hidden');
}

// --- Fungsi API Calls ---
async function fetchCurrentQuestion() {
    try {
        const response = await fetch(`${API_URL}/current-question`);
        const data = await response.json();
        if (response.ok) {
            currentGameState = data;
            renderGameDisplay(data);
            if (data.gameEnded) {
                showWinnerOverlay();
            } else {
                hideWinnerOverlay();
            }
        } else {
            showMessage(data.message || 'Gagal memuat pertanyaan saat ini.', 'error');
        }
    } catch (error) {
        console.error('Error fetching current question:', error);
        showMessage('Terjadi kesalahan jaringan saat memuat pertanyaan.', 'error');
    }
}

async function submitPlayerAnswer() {
    const answer = answerInput.value.trim();
    const playerName = playerNameInput.value.trim();

    if (!answer) {
        showMessage('Jawaban tidak boleh kosong!', 'warning');
        return;
    }
    if (!playerName) {
        showMessage('Nama pemain tidak boleh kosong!', 'warning');
        return;
    }

    try {
        const response = await fetch(`${API_URL}/submit-answer`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ answer, playerName }) // Kirim playerName juga
        });
        const data = await response.json();

        if (data.success) {
            showMessage(`Jawaban "${data.answerRevealed}" benar! Skor +${data.scoreAdded}.`, 'success');
            showPlayerNotification(playerName, data.answerRevealed);
            // Leaderboard adalah data lokal, jadi update langsung
            let player = playerLeaderboard.find(p => p.name.toLowerCase() === playerName.toLowerCase());
            if (player) {
                player.score += data.scoreAdded;
            } else {
                playerLeaderboard.push({ name: playerName, score: data.scoreAdded });
            }
            updateLeaderboardDisplay();
            // renderGameDisplay akan dipicu oleh game_state_update dari WebSocket
        } else {
            showMessage(data.message, 'error');
            // renderGameDisplay akan dipicu oleh game_state_update dari WebSocket (jika jawaban salah, tetap update tampilan)
        }
        answerInput.value = ''; // Kosongkan input jawaban
        // playerNameInput.value = ''; // Opsional: Kosongkan nama pemain jika ingin input baru setiap kali
    } catch (error) {
        console.error('Error submitting answer:', error);
        showMessage('Terjadi kesalahan jaringan saat mengirim jawaban.', 'error');
    }
}

async function nextQuestion() {
    try {
        const response = await fetch(`${API_URL}/next-question`, {
            method: 'POST'
        });
        const data = await response.json();
        if (data.success) {
            showMessage(data.message, 'success');
            // renderGameDisplay akan dipicu oleh game_state_update dari WebSocket
        } else {
            showMessage(data.message || 'Gagal pindah ke soal berikutnya.', 'error');
            fetchCurrentQuestion(); // Fallback update jika ada error
        }
    } catch (error) {
        console.error('Error moving to next question:', error);
        showMessage('Terjadi kesalahan jaringan saat pindah soal.', 'error');
    }
}

async function resetGame() {
    if (!confirm('Apakah Anda yakin ingin MERESET GAME? Ini akan menghapus semua skor dan memulai dari awal.')) {
        return;
    }
    try {
        const response = await fetch(`${API_URL}/reset-game`, {
            method: 'POST'
        });
        const data = await response.json();
        if (data.success) {
            showMessage(data.message, 'success');
            playerLeaderboard = [];
            updateLeaderboardDisplay();
            // renderGameDisplay akan dipicu oleh game_state_update dari WebSocket
        } else {
            showMessage(data.message || 'Gagal mereset game.', 'error');
        }
    } catch (error) {
        console.error('Error resetting game:', error);
        showMessage('Terjadi kesalahan jaringan saat mereset game.', 'error');
    }
}

// Initial load (Ini akan memicu koneksi WebSocket dan fetch state awal)
document.addEventListener('DOMContentLoaded', () => {
    // fetchCurrentQuestion() akan dipicu oleh event 'connect' WebSocket
    updateLeaderboardDisplay(); // Update leaderboard dari lokal storage (jika ada)
});
