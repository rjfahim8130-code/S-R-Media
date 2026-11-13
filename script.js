const SUPABASE_URL = 'https://fkbernsvlqxgebrpvnlj.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZrYmVybnN2bHF4Z2VicnB2bmxqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQ1MjE0MTMsImV4cCI6MjExMDA5NzQxM30.pYJjTrg_Pz5ijlWVEAx-4OscqV_klWOuzbtCMSCy0pk';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const tg = window.Telegram.WebApp;
tg.expand();

let allVideos = [];

async function fetchVideos() {
    const { data, error } = await supabase.from('videos').select('*').order('created_at', { ascending: false });
    if (error) {
        console.error('Error fetching videos:', error);
        return;
    }
    allVideos = data;
    renderVideos(allVideos);

    const startParam = tg.initDataUnsafe.start_param;
    if (startParam) {
        const targetVideo = allVideos.find(v => v.unique_code === startParam);
        if (targetVideo) {
            playVideo(targetVideo);
        }
    }
}

function renderVideos(videos) {
    const grid = document.getElementById('videoGrid');
    grid.innerHTML = '';
    if (videos.length === 0) {
        grid.innerHTML = '<p>কোনো ভিডিও পাওয়া যায়নি।</p>';
        return;
    }
    videos.forEach(video => {
        const card = document.createElement('div');
        card.className = 'video-card';
        card.innerHTML = `
            <img src="${video.thumbnail_url || 'https://via.placeholder.com/150'}" alt="Thumbnail">
            <h4>${video.title}</h4>
        `;
        card.onclick = () => playVideo(video);
        grid.appendChild(card);
    });
}

async function playVideo(video) {
    document.getElementById('playerTitle').innerText = video.title;
    document.getElementById('playerModal').classList.remove('hidden');

    const player = document.getElementById('mainPlayer');
    
    // ব্যাকএন্ড থেকে টেলিগ্রামের ফ্রেশ স্ট্রিম লিংক নেওয়ার জন্য কল করা (অথবা ডিরেক্ট ফাইল আইডি স্ট্রিম)
    // এখানে আপনার বটের ব্যাকএন্ড API এন্ডপয়েন্ট বা সরাসরি স্ট্রিম লিংক বসবে
    player.src = video.stream_url || `https://api.telegram.org/file/botYOUR_BOT_TOKEN/...`; // ব্যাকএন্ড থেকে হ্যান্ডেল করতে হবে
    player.play().catch(e => console.log("Autoplay blocked:", e));
}

document.getElementById('closeModal').onclick = () => {
    const player = document.getElementById('mainPlayer');
    player.pause();
    player.src = "";
    document.getElementById('playerModal').classList.add('hidden');
};

document.getElementById('searchInput').oninput = (e) => {
    const keyword = e.target.value.toLowerCase();
    const filtered = allVideos.filter(v => v.title.toLowerCase().includes(keyword));
    renderVideos(filtered);
};

document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.onclick = (e) => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        const cat = e.target.dataset.cat;
        if (cat === 'all') {
            renderVideos(allVideos);
        } else {
            renderVideos(allVideos.filter(v => v.category === cat));
        }
    };
});

fetchVideos();
                        
