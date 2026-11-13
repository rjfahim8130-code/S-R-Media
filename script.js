const BACKEND_URL = 'https://s-r-media.onrender.com';
const tg = window.Telegram?.WebApp;

if (tg) {
    tg.ready();
    tg.expand();
}

const startParam = tg?.initDataUnsafe?.start_param;
const playerModal = document.getElementById('playerModal');
const mainPlayer = document.getElementById('mainPlayer');
const playerTitle = document.getElementById('playerTitle');

if (startParam && startParam.startsWith('video_')) {
    const fileId = startParam.replace('video_', '');
    
    playerTitle.innerText = "S R Media Player";
    playerModal.classList.remove('hidden');
    
    const streamUrl = `${BACKEND_URL}/api/stream?file_id=${encodeURIComponent(fileId)}`;
    mainPlayer.src = streamUrl;
    mainPlayer.play().catch(e => console.log("Play error:", e));
} else {
    // If opened without a deep link
    document.getElementById('videoGrid').innerHTML = `
        <div style="padding: 40px 20px;">
            <h2 style="color: #60a5fa; margin-bottom: 15px;">🎬 Welcome to S R Media</h2>
            <p style="color: #94a3b8; font-size: 16px; line-height: 1.5;">
                To watch a video, please click the <b>"Watch Now"</b> button on the Telegram channel post.
            </p>
        </div>
    `;
}

document.getElementById('closeModal').onclick = () => {
    mainPlayer.pause();
    mainPlayer.removeAttribute('src');
    mainPlayer.load();
    playerModal.classList.add('hidden');
};
