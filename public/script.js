// public/script.js

const API_URL = '/api';

const questionElement = document.getElementById('question');
const answersList = document.getElementById('answers');
const totalScoreElement = document.getElementById('totalScore');
const messageElement = document.getElementById('message'); // Untuk panel admin

const playerNameInput = document.getElementById('playerNameInput');
const answerInput = document.getElementById('answerInput');
const leaderboardElement = document.getElementById('leaderboard');

// Elemen baru untuk notifikasi dan layar pemenang
const playerNotification = document.getElementById('playerNotification');
const winnerOverlay = document.getElementById('winnerOverlay');
const roundWinnerName = document.getElementById('roundWinnerName');
const roundWinnerScore = document.getElementById('roundWinnerScore');
const questionBox = document.getElementById('questionBox');
const answersContainer = document.getElementById('answersContainer');

let playerLeaderboard = []; // In-memory leaderboard data

// Durasi tampilnya notifikasi dan layar pemenang (dalam milidetik)
const NOTIFICATION_DURATION = 3000; // 3 detik
const WINNER_SCREEN_DURATION = 6000; // 6 detik

async function showMessage(msg, type = 'info', duration = 3000) {
    messageElement.textContent = msg;
    messageElement.className = `message show ${type}`;
    setTimeout(() => {
        messageElement.classList.remove('show');
    }, duration);
}

// --- BARU: Fungsi untuk menampilkan notifikasi pemain ---
function showPlayerAnswerNotification(playerName, scoreAdded) {
    playerNotification.textContent = `${playerName} MENDAPAT +${scoreAdded} POIN!`;
    playerNotification.classList.add('show');
    // Sembunyikan notifikasi setelah durasi tertentu
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

// --- BARU: Fungsi untuk menampilkan layar pemenang per putaran ---
function showRoundWinnerScreen() {
    // Sembunyikan elemen game utama
    questionBox.classList.add('hidden');
    answersContainer.classList.add('hidden');

    // Cari pemain dengan skor tertinggi di leaderboard saat ini
    const topPlayer = playerLeaderboard.length > 0 ? playerLeaderboard[0] : { name: "Tidak Ada", score: 0 };

    roundWinnerName.textContent = topPlayer.name;
    roundWinnerScore.textContent = topPlayer.score;
    winnerOverlay.classList.remove('hidden'); // Pastikan display:flex aktif
    setTimeout(() => {
        winnerOverlay.classList.add('show'); // Aktifkan transisi opacity
    }, 50); // Delay kecil agar transisi berfungsi

    // Sembunyikan layar pemenang dan lanjutkan ke soal berikutnya setelah durasi
    setTimeout(() => {
        winnerOverlay.classList.remove('show');
        // Setelah transisi selesai, sembunyikan sepenuhnya dan panggil fetchCurrentQuestion
        setTimeout(() => {
            winnerOverlay.classList.add('hidden');
            // Tampilkan kembali elemen game utama
            questionBox.classList.remove('hidden');
            answersContainer.classList.remove('hidden');
            fetchCurrentQuestion(); // Ambil soal baru
        }, 500); // Sesuaikan dengan durasi transisi opacity CSS
    }, WINNER_SCREEN_DURATION);
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
        const data = await response.json();

        if (data.success) {
            showPlayerAnswerNotification(playerName, data.scoreAdded); // Tampilkan notifikasi

            let player = playerLeaderboard.find(p => p.name.toLowerCase() === playerName.toLowerCase());
            if (player) {
                player.score += data.scoreAdded;
            } else {
                playerLeaderboard.push({ name: playerName, score: data.scoreAdded });
            }
            updateLeaderboardDisplay();

            // --- PENTING: Logika Layar Pemenang Per Putaran ---
            if (data.allAnswersRevealedForCurrentQuestion) {
                // Jangan langsung fetchCurrentQuestion di sini, biarkan showRoundWinnerScreen yang memicu
                showRoundWinnerScreen(); // Tampilkan layar pemenang
            } else {
                fetchCurrentQuestion(); // Update main game display jika belum semua terjawab
            }

        } else {
            showMessage(`"${answer}" salah. ${data.message || ''}`, 'error');
            fetchCurrentQuestion(); // Tetap update display meskipun salah
        }
        answerInput.value = ''; // Clear answer input
        // playerNameInput.value = ''; // Opsional: bersihkan nama pemain
    } catch (error) {
        console.error("Error submitting player answer:", error);
        showMessage("Terjadi kesalahan saat submit jawaban pemain. Coba lagi.", 'error', 5000);
    }
}

async function fetchCurrentQuestion() {
    try {
        const response = await fetch(`${API_URL}/current-question`);
        const data = await response.json();

        if (data.gameEnded) {
            questionElement.innerText = data.question;
            answersList.innerHTML = '<li class="answer-item"><span class="answer-text">Terima kasih sudah bermain!</span></li>';
            totalScoreElement.innerText = data.score;
            showMessage("Game telah berakhir. Silakan reset untuk mulai baru.", 'info', 5000);
            // Pastikan overlay game kembali terlihat jika game berakhir
            questionBox.classList.remove('hidden');
            answersContainer.classList.remove('hidden');
            return;
        }

        questionElement.innerText = data.question;
        totalScoreElement.innerText = data.score;

        answersList.innerHTML = '';
        const numberOfAnswerSlots = 5;
        for (let i = 0; i < numberOfAnswerSlots; i++) {
            const li = document.createElement('li');
            li.classList.add('answer-item');

            const revealedAnswer = data.revealedAnswers[i];

            if (revealedAnswer && revealedAnswer.isRevealed) {
                li.classList.add('revealed');
                li.innerHTML = `<span class="answer-text">${revealedAnswer.text}</span><span class="answer-score">${revealedAnswer.score}</span>`;
            } else {
                li.innerHTML = `<span class="answer-text placeholder">____</span><span class="answer-score"></span>`;
            }
            answersList.appendChild(li);
        }

    } catch (error) {
        console.error("Error fetching current question:", error);
        questionElement.innerText = "Gagal memuat game. Pastikan backend berjalan!";
        showMessage("Gagal memuat game. Cek koneksi server.", 'error', 5000);
    }
}

async function nextQuestion() {
    if (!confirm("Yakin ingin pindah ke soal berikutnya? Jawaban yang belum terungkap akan hilang.")) {
        return;
    }
    // Pastikan tidak ada layar pemenang yang sedang aktif
    winnerOverlay.classList.add('hidden');
    winnerOverlay.classList.remove('show');
    questionBox.classList.remove('hidden');
    answersContainer.classList.remove('hidden');

    try {
        const response = await fetch(`${API_URL}/next-question`, { method: 'POST' });
        const data = await response.json();
        if (data.success) {
            showMessage(data.message, 'success');
            fetchCurrentQuestion();
        } else {
            showMessage("Gagal pindah soal: " + data.message, 'error');
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
    // Pastikan tidak ada layar pemenang yang sedang aktif
    winnerOverlay.classList.add('hidden');
    winnerOverlay.classList.remove('show');
    questionBox.classList.remove('hidden');
    answersContainer.classList.remove('hidden');

    try {
        const response = await fetch(`${API_URL}/reset-game`, { method: 'POST' });
        const data = await response.json();
        if (data.success) {
            showMessage(data.message, 'success');
            playerLeaderboard = [];
            updateLeaderboardDisplay();
            fetchCurrentQuestion();
        } else {
            showMessage("Gagal me-reset game: " + data.message, 'error');
        }
    } catch (error) {
        console.error("Error resetting game:", error);
        showMessage("Gagal me-reset game. Cek koneksi server.", 'error', 5000);
    }
}

// Initial load
document.addEventListener('DOMContentLoaded', () => {
    fetchCurrentQuestion();
    updateLeaderboardDisplay();
});
