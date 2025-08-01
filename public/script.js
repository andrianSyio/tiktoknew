// public/script.js - PERUBAHAN UTAMA UNTUK LOGIKA ACAR SOAL DAN KOTAK JAWABAN

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

            // --- PENTING: Cek flag dari backend apakah sudah pindah soal ---
            if (data.movedToNextQuestion || data.allAnswersRevealedForCurrentQuestion) {
                 // Tidak perlu pesan terpisah jika backend sudah bilang pindah soal
                 // Soal akan otomatis update saat fetchCurrentQuestion dipanggil
            }

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

        answersList.innerHTML = '';
        // Buat item jawaban bahkan jika belum terungkap
        // Ini memastikan jumlah kotak jawaban tetap konsisten
        const currentSoal = await fetch(`${API_URL}/current-question`).then(res => res.json()); // Ambil ulang data soal lengkap untuk tahu berapa banyak kotak
        currentSoal.answers.forEach((ansTemplate, index) => {
            const li = document.createElement('li');
            li.classList.add('answer-item');
            
            // Cari jawaban yang sesuai di data.revealedAnswers
            const revealed = data.revealedAnswers.find(revealedAns => revealedAns.text.toLowerCase() === ansTemplate.text.toLowerCase());

            if (revealed && revealed.isRevealed) {
                li.classList.add('revealed');
                li.innerHTML = `<span class="answer-text">${revealed.text}</span><span class="answer-score">${revealed.score}</span>`;
            } else {
                // Tampilkan placeholder jika belum terungkap
                // Anda bisa gunakan angka 1, 2, 3... atau garis
                li.innerHTML = `<span class="answer-text placeholder">____</span><span class="answer-score"></span>`;
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
            fetchCurrentQuestion(); // Fetch new question
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
            playerLeaderboard = []; // Reset leaderboard on frontend as well
            updateLeaderboardDisplay();
            fetchCurrentQuestion(); // Fetch the first (newly shuffled) question
        } else {
            showMessage("Gagal me-reset game: " + data.message, 'error');
        }
    } catch (error) {
        console.error("Error resetting game:", error);
        showMessage("Gagal me-reset game. Cek koneksi server.", 'error', 5000);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    fetchCurrentQuestion();
    updateLeaderboardDisplay();
});
