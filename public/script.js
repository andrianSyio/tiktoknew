// public/script.js

// Tidak perlu import Socket.IO Client lagi
// const socket = io(window.location.origin);

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
const toggleRefreshButton = document.getElementById('toggleRefreshButton'); // Tombol auto-refresh

let playerLeaderboard = []; // In-memory leaderboard data (frontend saja)

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
    playerNotificationElement.textContent = `${playerName} +${scoreAdded} PT!`;
    playerNotificationElement.classList.add('show');
    setTimeout(() => {
        playerNotificationElement.classList.remove('show');
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
        }, 500); // Sesuaikan dengan durasi transisi opacity CSS
    }, WINNER_SCREEN_DURATION);
}

// Fungsi bantu untuk merender jawaban
function renderAnswers(allAnswers, revealedAnswersData) {
    answersList.innerHTML = '';
    const totalAnswerSlots = 5;
    const revealedAnswerTexts = new Set(revealedAnswersData.map(a => a.text.toLowerCase()));

    const sortedAnswers = [...allAnswers].sort((a, b) => {
        const aRevealed = revealedAnswerTexts.has(a.text.toLowerCase());
        const bRevealed = revealedAnswerTexts.has(b.text.toLowerCase());
        if (aRevealed && !bRevealed) return -1;
        if (!aRevealed && bRevealed) return 1;
        return 0;
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

    for (let i = allAnswers.length; i < totalAnswerSlots; i++) {
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


async function submitPlayerAnswer() {
    const playerName = playerNameInput.value.trim();
    const answer = answerInput.value.trim();

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
            body: JSON.stringify({ answer, playerName })
        });
        const data = await response.json(); // Mengandung updated score, revealedAnswers, answers

        // UI akan diupdate langsung dari respons ini
        totalScoreElement.innerText = data.score; 
        renderGameDisplay(data); // Render tampilan game langsung

        if (data.success) {
            showMessage(`Jawaban "${data.answerRevealed}" benar! Skor +${data.scoreAdded}.`, 'success');
            showPlayerAnswerNotification(playerName, data.answerRevealed);
            
            let player = playerLeaderboard.find(p => p.name.toLowerCase() === playerName.toLowerCase());
            if (player) {
                player.score += data.scoreAdded;
            } else {
                playerLeaderboard.push({ name: playerName, score: data.scoreAdded });
            }
            updateLeaderboardDisplay();

            if (data.allAnswersRevealedForCurrentQuestion) {
                const topPlayer = playerLeaderboard.length > 0 ? playerLeaderboard[0] : { name: "Tidak Ada", score: 0 };
                showRoundWinnerScreen(data.score, topPlayer); 
            }
        } else {
            showMessage(data.message, 'error');
            // renderGameDisplay(data); // Render tampilan game juga jika salah
        }
        answerInput.value = ''; // Kosongkan input jawaban
        // playerNameInput.value = ''; // Opsional: Kosongkan nama pemain jika ingin input baru setiap kali
    } catch (error) {
        console.error('Error submitting answer:', error);
        showMessage('Terjadi kesalahan jaringan saat mengirim jawaban.', 'error');
    }
}

async function fetchCurrentQuestion() {
    try {
        const response = await fetch(`${API_URL}/current-question`);
        const data = await response.json();
        if (response.ok) {
            renderGameDisplay(data); // Render tampilan game
            if (data.gameEnded) {
                showWinnerOverlay();
                stopAutoRefresh(); // Hentikan auto-refresh jika game selesai
                toggleRefreshButton.textContent = "Mulai Auto-Update";
            } else {
                hideWinnerOverlay();
            }
        } else {
            showMessage(data.message || 'Gagal memuat pertanyaan saat ini.', 'error');
            stopAutoRefresh(); // Hentikan auto-refresh jika ada error
            toggleRefreshButton.textContent = "Mulai Auto-Update";
        }
    } catch (error) {
        console.error('Error fetching current question:', error);
        showMessage('Terjadi kesalahan jaringan saat memuat pertanyaan.', 'error');
        stopAutoRefresh(); // Hentikan auto-refresh jika ada error
        toggleRefreshButton.textContent = "Mulai Auto-Update";
    }
}

async function nextQuestion() {
    if (!confirm('Apakah Anda yakin ingin pindah ke soal berikutnya? Ini akan menghapus jawaban saat ini.')) {
        return;
    }
    stopAutoRefresh(); // Hentikan auto-refresh sementara
    hideWinnerOverlay(); // Pastikan overlay pemenang tersembunyi

    try {
        const response = await fetch(`${API_URL}/next-question`, { method: 'POST' });
        const data = await response.json();
        if (response.ok) {
            showMessage(data.message, 'success');
            renderGameDisplay(data); // Render tampilan game
            startAutoRefresh(); // Mulai lagi auto-refresh
        } else {
            showMessage(data.message || 'Gagal pindah ke soal berikutnya.', 'error');
            fetchCurrentQuestion(); // Fallback update jika ada error
            startAutoRefresh(); // Mulai lagi auto-refresh
        }
    } catch (error) {
        console.error('Error moving to next question:', error);
        showMessage('Terjadi kesalahan jaringan saat pindah soal.', 'error');
        startAutoRefresh(); // Mulai lagi auto-refresh
    }
}

async function resetGame() {
    if (!confirm('Apakah Anda yakin ingin MERESET GAME? Ini akan menghapus semua skor dan memulai dari awal.')) {
        return;
    }
    stopAutoRefresh(); // Hentikan auto-refresh sementara
    hideWinnerOverlay(); // Pastikan overlay pemenang tersembunyi

    try {
        const response = await fetch(`${API_URL}/reset-game`, { method: 'POST' });
        const data = await response.json();
        if (response.ok) {
            showMessage(data.message, 'success');
            playerLeaderboard = []; // Reset leaderboard lokal
            updateLeaderboardDisplay(); // Update tampilan leaderboard
            renderGameDisplay(data); // Render tampilan game
            startAutoRefresh(); // Mulai lagi auto-refresh
        } else {
            showMessage(data.message || 'Gagal mereset game.', 'error');
        }
    } catch (error) {
        console.error('Error resetting game:', error);
        showMessage('Terjadi kesalahan jaringan saat mereset game.', 'error');
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

// --- Initial Load ---
document.addEventListener('DOMContentLoaded', () => {
    fetchCurrentQuestion(); // Muat pertanyaan pertama kali
    updateLeaderboardDisplay(); // Update leaderboard dari lokal (jika ada)
    startAutoRefresh(); // Mulai auto-refresh secara otomatis
});
