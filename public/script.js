// public/script.js - HANYA PENYESUAIAN PENGAMBILAN DATA UNTUK 5 KOTAK JAWABAN

const API_URL = '/api';

const questionElement = document.getElementById('question');
const answersList = document.getElementById('answers');
const totalScoreElement = document.getElementById('totalScore');
const messageElement = document.getElementById('message');

const playerNameInput = document.getElementById('playerNameInput');
const answerInput = document.getElementById('answerInput');
const leaderboardElement = document.getElementById('leaderboard');

let playerLeaderboard = []; // In-memory leaderboard data

async function showMessage(msg, type = 'info', duration = 3000) {
    messageElement.textContent = msg;
    messageElement.className = `message show ${type}`;
    setTimeout(() => {
        messageElement.classList.remove('show');
    }, duration);
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
            showMessage(`${data.answerRevealed} benar! (+${data.scoreAdded} poin)`, 'success');

            let player = playerLeaderboard.find(p => p.name.toLowerCase() === playerName.toLowerCase());
            if (player) {
                player.score += data.scoreAdded;
            } else {
                playerLeaderboard.push({ name: playerName, score: data.scoreAdded });
            }
            updateLeaderboardDisplay();

            // Backend already handles moving to next question if all answers are revealed.
            // Frontend just needs to fetch updated state.

        } else {
            showMessage(`"${answer}" salah. ${data.message || ''}`, 'error');
        }
        answerInput.value = '';
        fetchCurrentQuestion(); // Always fetch current question to update display
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
            return;
        }

        questionElement.innerText = data.question;
        totalScoreElement.innerText = data.score;

        answersList.innerHTML = ''; // Kosongkan daftar jawaban sebelumnya
        // --- PENTING: Pastikan selalu membuat 5 kotak jawaban ---
        // Jika data.revealedAnswers kurang dari 5, sisa kotak akan menjadi placeholder
        const numberOfAnswerSlots = 5;
        for (let i = 0; i < numberOfAnswerSlots; i++) {
            const li = document.createElement('li');
            li.classList.add('answer-item');

            const revealedAnswer = data.revealedAnswers[i]; // Ambil jawaban terungkap berdasarkan indeks

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
