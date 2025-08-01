// public/script.js

const API_URL = '/api'; // Tetap /api untuk Vercel deployment

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
const toggleRefreshButton = document.getElementById('toggleRefreshButton'); // Tombol baru

let playerLeaderboard = []; // In-memory leaderboard data (frontend saja)

// Durasi tampilnya notifikasi dan layar pemenang (dalam milidetik)
const NOTIFICATION_DURATION = 3000; // 3 detik
const WINNER_SCREEN_DURATION = 6000; // 6 detik
const AUTO_REFRESH_INTERVAL_MS = 2000; // Auto-refresh setiap 2 detik

let autoRefreshIntervalId = null; // ID untuk setInterval, agar bisa di-clear

async function showMessage(msg, type = 'info', duration = 3000) {
    messageElement.textContent = msg;
    messageElement.className = `message show ${type}`;
    setTimeout(() => {
        messageElement.classList.remove('show');
    }, duration);
}

// Fungsi untuk menampilkan notifikasi pemain (hanya dipicu dari submit manual)
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

// Fungsi untuk menampilkan layar pemenang per putaran
function showRoundWinnerScreen(finalScore, roundTopPlayer) {
    // Pastikan auto-refresh dihentikan saat layar pemenang muncul
    stopAutoRefresh(); 

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
            questionBox.classList.remove('hidden');
            answersContainer.classList.remove('hidden');
            fetchCurrentQuestion(); // Ambil soal baru
            startAutoRefresh(); // Mulai lagi auto-refresh setelah soal baru dimuat
        }, 500);
    }, WINNER_SCREEN_DURATION);
}

// Fungsi bantu untuk merender jawaban
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
        const data = await response.json();

        totalScoreElement.innerText = data.score; // Update skor langsung

        if (data.success) {
            showPlayerAnswerNotification(playerName, data.scoreAdded); // Tampilkan notifikasi
            
            let player = playerLeaderboard.find(p => p.name.toLowerCase() === playerName.toLowerCase());
            if (player) {
                player.score += data.scoreAdded;
            } else {
                playerLeaderboard.push({ name: playerName, score: data.scoreAdded });
            }
            updateLeaderboardDisplay();

            renderAnswers(data.answers, data.revealedAnswers); // Render jawaban langsung dari respons

            if (data.allAnswersRevealedForCurrentQuestion) {
                const topPlayer = playerLeaderboard.length > 0 ? playerLeaderboard[0] : { name: "Tidak Ada", score: 0 };
                showRoundWinnerScreen(data.score, topPlayer);
            }

        } else {
            showMessage(`"${answer}" salah. ${data.message || ''}`, 'error');
            renderAnswers(data.answers, data.revealedAnswers); // Perbarui juga jika salah
        }
        answerInput.value = '';
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
            questionBox.classList.remove('hidden');
            answersContainer.classList.remove('hidden');
            stopAutoRefresh(); // Hentikan auto-refresh jika game selesai
            toggleRefreshButton.textContent = "Mulai Auto-Update"; // Ubah teks tombol
            return;
        }

        questionElement.innerText = data.question;
        totalScoreElement.innerText = data.score;

        renderAnswers(data.answers, data.revealedAnswers);

    } catch (error) {
        console.error("Error fetching current question:", error);
        questionElement.innerText = "Gagal memuat game. Pastikan backend berjalan!";
        showMessage("Gagal memuat game. Cek koneksi server.", 'error', 5000);
        stopAutoRefresh(); // Hentikan auto-refresh jika ada error
        toggleRefreshButton.textContent = "Mulai Auto-Update"; // Ubah teks tombol
    }
}

async function nextQuestion() {
    if (!confirm("Yakin ingin pindah ke soal berikutnya? Jawaban yang belum terungkap akan hilang.")) {
        return;
    }
    stopAutoRefresh(); // Hentikan auto-refresh sementara
    winnerOverlay.classList.add('hidden');
    winnerOverlay.classList.remove('show');
    questionBox.classList.remove('hidden');
    answersContainer.classList.remove('hidden');

    try {
        const response = await fetch(`${API_URL}/next-question`, { method: 'POST' });
        const data = await response.json();
        if (data.success) {
            showMessage(data.message, 'success');
            questionElement.innerText = data.question;
            totalScoreElement.innerText = data.score;
            renderAnswers(data.answers, data.revealedAnswers);
            startAutoRefresh(); // Mulai lagi auto-refresh
        } else {
            showMessage("Gagal pindah soal: " + data.message, 'error');
            fetchCurrentQuestion();
            startAutoRefresh(); // Mulai lagi auto-refresh
        }
    } catch (error) {
        console.error("Error moving to next question:", error);
        showMessage("Gagal pindah soal. Cek koneksi server.", 'error', 5000);
        startAutoRefresh(); // Mulai lagi auto-refresh
    }
}

async function resetGame() {
    if (!confirm("Yakin ingin me-reset game? Semua skor dan progres akan hilang.")) {
        return;
    }
    stopAutoRefresh(); // Hentikan auto-refresh sementara
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
            questionElement.innerText = data.question;
            totalScoreElement.innerText = data.score;
            renderAnswers(data.answers, data.revealedAnswers);
            startAutoRefresh(); // Mulai lagi auto-refresh
        } else {
            showMessage("Gagal me-reset game: " + data.message, 'error');
        }
    } catch (error) {
        console.error("Error resetting game:", error);
        showMessage("Gagal me-reset game. Cek koneksi server.", 'error', 5000);
    }
}

// --- Fungsi untuk mengontrol auto-refresh ---
function startAutoRefresh() {
    if (autoRefreshIntervalId === null) {
        autoRefreshIntervalId = setInterval(fetchCurrentQuestion, AUTO_REFRESH_INTERVAL_MS);
        toggleRefreshButton.textContent = "Hentikan Auto-Update";
        console.log("Auto-refresh dimulai.");
    }
}

function stopAutoRefresh() {
    if (autoRefreshIntervalId !== null) {
        clearInterval(autoRefreshIntervalId);
        autoRefreshIntervalId = null;
        toggleRefreshButton.textContent = "Mulai Auto-Update";
        console.log("Auto-refresh dihentikan.");
    }
}

function toggleAutoRefresh() {
    if (autoRefreshIntervalId === null) {
        startAutoRefresh();
    } else {
        stopAutoRefresh();
    }
}


// Initial load and start auto-refresh
document.addEventListener('DOMContentLoaded', () => {
    fetchCurrentQuestion();
    updateLeaderboardDisplay();
    startAutoRefresh(); // Auto-refresh dimulai secara otomatis saat halaman dimuat
});
