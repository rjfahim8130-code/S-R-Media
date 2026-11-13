const SUPABASE_URL = 'https://fkbernsvlqxgebrpvnlj.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZrYmVybnN2bHF4Z2VicnB2bmxqIiwicm9sZSI6ImFub24iisComposite...'; // আপনার সুপাবেশ অ্যানন কি
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
        grid.innerHTML = '<p style="color: white; text-align: center; width: 100%;">কোনো ভিডিও পাওয়া যায়নি।</p>';
        return;
    }
    videos.forEach(video => {
        const card = document.createElement('div');
        card.className = 'video-card';
        
        // থাম্বনেইল হ্যান্ডলিং
        let thumbUrl = 'https://via.placeholder.com/150';
        if (video.thumbnail_url) {
            // যদি থাম্বনেইল টেলিগ্রাম file_id হয়, তবে সেটি টেলিগ্রাম এপিআই দিয়ে ফেচ করতে হবে অথবা ডিরেক্ট লিংক হতে হবে
            thumbUrl = video.thumbnail_url; 
        }

        card.innerHTML = `
            <img src="${thumbUrl}" alt="Thumbnail" onerror="this.src='https://via.placeholder.com/150'">
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
    
    // টেলিগ্রাম file_id থেকে রিয়েল স্ট্রিম লিংক পাওয়ার জন্য রেন্ডার সার্ভারের ব্যাকএন্ড কল করতে হবে
    // অথবা আপনার সার্ভার যদি টেলিগ্রাম file_id কে রিডারেক্ট করে:
    try {
        const response = await fetch(`https://s-r-media.onrender.com/get-stream/${video.file_id}`);
        const resData = await response.json();
        if(resData.url) {
            player.src = resData.url;
        } else {
            // ফলব্যাক হিসেবে ডিরেক্ট ফাইল আইডি বা অন্য কিছু
            player.src = video.stream_url || "";
        }
    } catch (err) {
        console.error('Error getting stream URL:', err);
    }

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
