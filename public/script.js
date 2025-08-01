// public/script.js
const API_URL = '/api';

const questionElement = document.getElementById('question');
const answersList = document.getElementById('answers');
const totalScoreElement = document.getElementById('totalScore');
const messageElement = document.getElementById('message');

// New elements for player input and leaderboard
const playerNameInput = document.getElementById('playerNameInput');
const answerInput = document.getElementById('answerInput');
const leaderboardElement = document.getElementById('leaderboard');

// In-memory leaderboard data (simple for now, will reset on server restart)
let playerLeaderboard = [];

async function showMessage(msg, type = 'info', duration = 3000) {
    messageElement.textContent = msg;
    messageElement.className = `message show ${type}`;
    setTimeout(() => {
        messageElement.classList.remove('show');
    }, duration);
}

// Function to update the displayed leaderboard
function updateLeaderboardDisplay() {
    leaderboardElement.innerHTML = ''; // Clear existing list
    playerLeaderboard.sort((a, b) => b.score - a.score); // Sort by score descending

    playerLeaderboard.forEach(player => {
        const listItem = document.createElement('li');
        listItem.classList.add('leaderboard-item');
        listItem.innerHTML = `<span>${player.name}</span><span>${player.score}</span>`;
        leaderboardElement.appendChild(listItem);
    });
}

// Function to handle player answer submission from admin panel
async function submitPlayerAnswer() {
    const playerName = playerNameInput.value.trim();
    const answer = answerInput.value.trim();

    if (!playerName || !answer) {
        showMessage("Nama pemain dan jawaban harus diisi!", 'warning');
        return;
    }

    try {
        // First, submit the answer to the game logic
        const response = await fetch(`${API_URL}/submit-answer`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ answer }) // Only sending 'answer'
        });
        const data = await response.json();

        if (data.success) {
            showMessage(`${data.answerRevealed} benar! (+${data.scoreAdded} poin)`, 'success');
            // Update player's score in leaderboard data
            let player = playerLeaderboard.find(p => p.name.toLowerCase() === playerName.toLowerCase());
            if (player) {
                player.score += data.scoreAdded;
            } else {
                playerLeaderboard.push({ name: playerName, score: data.scoreAdded });
            }
            updateLeaderboardDisplay(); // Refresh leaderboard display

            if (data.allAnswersRevealedForCurrentQuestion) {
                showMessage("Semua jawaban untuk soal ini sudah terungkap! Tekan 'Soal Berikutnya'.", 'info', 7000);
            }
        } else {
            showMessage(`"${answer}" salah. ${data.message || ''}`, 'error');
        }
        answerInput.value = ''; // Clear answer input
        // playerNameInput.value = ''; // Optionally clear player name after each submission, or let it stay for repeated answers
        fetchCurrentQuestion(); // Update main game display
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
            questionElement.innerText = data.question; // "Game Selesai!"
            answersList.innerHTML = '<li class="answer-item"><span class="answer-text">Terima kasih sudah bermain!</span></li>';
            totalScoreElement.innerText = data.score;
            showMessage("Game telah berakhir. Silakan reset untuk mulai baru.", 'info', 5000);
            return;
        }

        questionElement.innerText = data.question;
        totalScoreElement.innerText = data.score;

        answersList.innerHTML = ''; // Kosongkan daftar jawaban sebelumnya
        data.revealedAnswers.forEach(ans => {
            const li = document.createElement('li');
            li.classList.add('answer-item');
            if (ans.isRevealed) {
                li.classList.add('revealed');
                li.innerHTML = `<span class="answer-text">${ans.text}</span><span class="answer-score">${ans.score}</span>`;
            } else {
                li.innerHTML = `<span class="answer-text placeholder">${ans.text}</span><span class="answer-score"></span>`;
            }
            answersList.appendChild(li);
        });
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
    try {
        const response = await fetch(`${API_URL}/reset-game`, { method: 'POST' });
        const data = await response.json();
        if (data.success) {
            showMessage(data.message, 'success');
            // Reset leaderboard on frontend as well
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
    updateLeaderboardDisplay(); // Display empty or initial leaderboard
});
