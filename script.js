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
        grid.innerHTML = '<p style="color: white; text-align: center; width: 100%;">কোনো ভিডিও পাওয়া যায়নি।</p>';
        return;
    }
    videos.forEach(video => {
        const card = document.createElement('div');
        card.className = 'video-card';
        card.innerHTML = `
            <img src="${video.thumbnail_url || 'https://via.placeholder.com/150'}" alt="Thumbnail" onerror="this.src='https://via.placeholder.com/150'">
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
    player.src = video.stream_url || ""; 
    player.play().catch(e => console.log("Autoplay blocked:", e));

    // --- প্লেয়ারের নিচে পরবর্তী পর্ব / সাজেস্টেড ভিডিও লিস্ট রেন্ডার করা ---
    let suggestedContainer = document.getElementById('suggestedVideos');
    if (!suggestedContainer) {
        suggestedContainer = document.createElement('div');
        suggestedContainer.id = 'suggestedVideos';
        suggestedContainer.style.marginTop = '15px';
        suggestedContainer.style.padding = '10px';
        suggestedContainer.style.borderTop = '1px solid rgba(255,255,255,0.1)';
        document.querySelector('.modal-content').appendChild(suggestedContainer);
    }

    suggestedContainer.innerHTML = '<h4 style="color: #fff; margin-bottom: 10px; font-size: 16px;">পরবর্তী পর্ব ও সাজেস্টেড ভিডিও</h4>';

    // একই ক্যাটাগরির অন্যান্য ভিডিও ফিল্টার করা
    const relatedVideos = allVideos.filter(v => v.category === video.category && v.unique_code !== video.unique_code);

    if (relatedVideos.length === 0) {
        suggestedContainer.innerHTML += '<p style="color: #aaa; font-size: 13px;">আর কোনো পর্ব নেই।</p>';
    } else {
        const listDiv = document.createElement('div');
        listDiv.className = 'suggested-list';
        listDiv.style.display = 'flex';
        listDiv.style.flexDirection = 'column';
        listDiv.style.gap = '8px';
        listDiv.style.maxHeight = '200px';
        listDiv.style.overflowY = 'auto';

        relatedVideos.forEach(item => {
            const itemCard = document.createElement('div');
            itemCard.className = 'suggested-card';
            itemCard.style.display = 'flex';
            itemCard.style.alignItems = 'center';
            itemCard.style.gap = '10px';
            itemCard.style.background = 'rgba(255,255,255,0.05)';
            itemCard.style.padding = '6px';
            itemCard.style.borderRadius = '6px';
            itemCard.style.cursor = 'pointer';

            itemCard.innerHTML = `
                <img src="${item.thumbnail_url || 'https://via.placeholder.com/80'}" style="width: 60px; height: 35px; object-fit: cover; border-radius: 4px;" alt="Thumb">
                <span style="color: #fff; font-size: 13px; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${item.title}</span>
            `;
            itemCard.onclick = () => playVideo(item); // ক্লিক করলেই পরের ভিডিও প্লে হবে
            listDiv.appendChild(itemCard);
        });
        suggestedContainer.appendChild(listDiv);
    }
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
