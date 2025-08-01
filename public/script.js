// public/script.js
// URL API sekarang adalah path relatif karena frontend dan backend di deploy di domain yang sama oleh Vercel
const API_URL = '/api';

const questionElement = document.getElementById('question');
const answersList = document.getElementById('answers');
const totalScoreElement = document.getElementById('totalScore'); // Ubah ID
const answerInput = document.getElementById('answerInput');
const messageElement = document.getElementById('message');

async function showMessage(msg, type = 'info', duration = 3000) {
    messageElement.textContent = msg;
    messageElement.className = `message show ${type}`;
    setTimeout(() => {
        messageElement.classList.remove('show');
    }, duration);
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

async function submitAnswer() {
    const answer = answerInput.value.trim();

    if (!answer) {
        showMessage("Jawaban tidak boleh kosong!", 'warning');
        return;
    }

    try {
        const response = await fetch(`${API_URL}/submit-answer`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ answer }) // Hanya mengirim 'answer'
        });
        const data = await response.json();

        if (data.success) {
            showMessage(`${data.answerRevealed} benar! (+${data.scoreAdded} poin)`, 'success');
            if (data.allAnswersRevealedForCurrentQuestion) {
                showMessage("Semua jawaban untuk soal ini sudah terungkap! Tekan 'Soal Berikutnya'.", 'info', 7000);
            }
        } else {
            showMessage(`"${answer}" salah. ${data.message || ''}`, 'error');
        }
        answerInput.value = ''; // Clear input
        fetchCurrentQuestion(); // Perbarui tampilan game
    } catch (error) {
        console.error("Error submitting answer:", error);
        showMessage("Terjadi kesalahan saat submit jawaban. Coba lagi.", 'error', 5000);
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
            fetchCurrentQuestion();
        } else {
            showMessage("Gagal me-reset game: " + data.message, 'error');
        }
    } catch (error) {
        console.error("Error resetting game:", error);
        showMessage("Gagal me-reset game. Cek koneksi server.", 'error', 5000);
    }
}

// Muat pertanyaan pertama kali halaman dimuat
document.addEventListener('DOMContentLoaded', fetchCurrentQuestion);
