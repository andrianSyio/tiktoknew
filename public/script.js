<script>
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

let playerLeaderboard = []; // In-memory leaderboard data (frontend saja)

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

// Fungsi untuk menampilkan notifikasi pemain
function showPlayerAnswerNotification(playerName, scoreAdded) {
    playerNotification.textContent = `${playerName} +${scoreAdded} PT!`; // Pesan lebih singkat
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
    // Sembunyikan elemen game utama
    questionBox.classList.add('hidden');
    answersContainer.classList.add('hidden');

    roundWinnerName.textContent = roundTopPlayer.name;
    roundWinnerScore.textContent = roundTopPlayer.score;
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
            // Tampilkan kembali elemen game utama (akan diisi soal baru oleh fetchCurrentQuestion)
            questionBox.classList.remove('hidden');
            answersContainer.classList.remove('hidden');
            fetchCurrentQuestion(); // Ambil soal baru
        }, 500); // Sesuaikan dengan durasi transisi opacity CSS
    }, WINNER_SCREEN_DURATION);
}

// Fungsi bantu untuk merender jawaban (digunakan oleh fetchCurrentQuestion dan submitPlayerAnswer)
function renderAnswers(allAnswers, revealedAnswersData) {
    answersList.innerHTML = '';
    // Buat Set dari teks jawaban yang sudah terungkap untuk pencarian cepat
    const revealedAnswerTexts = new Set(revealedAnswersData.map(ans => ans.text.toLowerCase()));

    const numberOfAnswerSlots = 5; // Pastikan ini 5

    for (let i = 0; i < numberOfAnswerSlots; i++) {
        const li = document.createElement('li');
        li.classList.add('answer-item');

        const originalAnswerDefinition = allAnswers[i]; // Ambil definisi jawaban asli untuk slot ini

        if (originalAnswerDefinition) { // Pastikan ada jawaban untuk slot ini (misal kalau data.answers < 5)
            const isRevealed = revealedAnswerTexts.has(originalAnswerDefinition.text.toLowerCase());

            if (isRevealed) {
                // Ambil data skor dari revealedAnswersData, bukan dari originalAnswerDefinition
                const actualRevealedData = revealedAnswersData.find(
                    revealed => revealed.text.toLowerCase() === originalAnswerDefinition.text.toLowerCase()
                );
                li.classList.add('revealed');
                li.innerHTML = `<span class="answer-text">${actualRevealedData.text}</span><span class="answer-score">${actualRevealedData.score}</span>`;
            } else {
                li.innerHTML = `<span class="answer-text placeholder">____</span><span class="answer-score"></span>`;
            }
        } else {
            // Untuk slot jika jumlah jawaban asli kurang dari numberOfAnswerSlots
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

        // --- UPDATE TOTAL SKOR LANGSUNG DARI RESPON POST ---
        totalScoreElement.innerText = data.score;

        if (data.success) {
            showPlayerAnswerNotification(playerName, data.scoreAdded);

            let player = playerLeaderboard.find(p => p.name.toLowerCase() === playerName.toLowerCase());
            if (player) {
                player.score += data.scoreAdded;
            } else {
                playerLeaderboard.push({ name: playerName, score: data.scoreAdded });
            }
            updateLeaderboardDisplay();

            // --- RENDER JAWABAN LANGSUNG DARI RESPON POST ---
            renderAnswers(data.answers, data.revealedAnswers); // Gunakan data dari respons POST

            if (data.allAnswersRevealedForCurrentQuestion) {
                // Dapatkan pemain terbaik saat ini untuk putaran ini
                const topPlayer = playerLeaderboard.length > 0 ? playerLeaderboard[0] : { name: "Tidak Ada", score: 0 };
                showRoundWinnerScreen(data.score, topPlayer); // Kirim skor dan top player saat ini
            }

        } else {
            showMessage(`"${answer}" salah. ${data.message || ''}`, 'error');
            renderAnswers(data.answers, data.revealedAnswers); // Perbarui juga jika salah, agar UI konsisten
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
            return;
        }

        questionElement.innerText = data.question;
        totalScoreElement.innerText = data.score;

        renderAnswers(data.answers, data.revealedAnswers); // Gunakan data dari GET request

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
    winnerOverlay.classList.add('hidden');
    winnerOverlay.classList.remove('show');
    questionBox.classList.remove('hidden');
    answersContainer.classList.remove('hidden');

    try {
        const response = await fetch(`${API_URL}/next-question`, { method: 'POST' });
        const data = await response.json();
        if (data.success) {
            showMessage(data.message, 'success');
            // Langsung update UI dari respons next-question
            questionElement.innerText = data.question;
            totalScoreElement.innerText = data.score;
            renderAnswers(data.answers, data.revealedAnswers);
        } else {
            showMessage("Gagal pindah soal: " + data.message, 'error');
            fetchCurrentQuestion(); // Tetap fetch untuk update state
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
        if (data.success) {
            showMessage(data.message, 'success');
            playerLeaderboard = [];
            updateLeaderboardDisplay();
            // Langsung update UI dari respons reset-game
            questionElement.innerText = data.question;
            totalScoreElement.innerText = data.score;
            renderAnswers(data.answers, data.revealedAnswers);
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
</script>
