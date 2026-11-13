const SUPABASE_URL = 'https://fkbernsvlqxgebrpvnlj.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZrYmVybnN2bHF4Z2VicnB2bmxqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQ1MjE0MTMsImV4cCI6MjExMDA5NzQxM30.pYJjTrg_Pz5ijlWVEAx-4OscqV_klWOuzbtCMSCy0pk';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// আপনার রেন্ডার ব্যাকএন্ড URL
const BACKEND_URL = 'https://s-r-media.onrender.com';

const tg = window.Telegram.WebApp;
tg.expand();
tg.ready();

let allVideos = [];
let currentVideo = null;
let currentSeriesEpisodes = [];

async function fetchVideos() {
    const { data, error } = await supabase
        .from('videos')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        console.error(error);
        document.getElementById('videoGrid').innerHTML = '<p style="color:#fff;text-align:center;">লোড করতে সমস্যা হয়েছে</p>';
        return;
    }

    allVideos = data || [];
    renderHome();

    // startapp প্যারামিটার থাকলে সরাসরি প্লে
    const startParam = tg.initDataUnsafe?.start_param;
    if (startParam) {
        const target = allVideos.find(v => v.unique_code === startParam);
        if (target) playVideo(target);
    }
}

function getThumbnailUrl(video) {
    if (!video.thumbnail_file_id) return 'https://via.placeholder.com/300x170?text=No+Thumb';
    return `${BACKEND_URL}/api/thumbnail?file_id=${encodeURIComponent(video.thumbnail_file_id)}`;
}

function getStreamUrl(video) {
    return `${BACKEND_URL}/api/stream?file_id=${encodeURIComponent(video.file_id)}`;
}

// ========== হোম: সিরিজ + মুভি গ্রিড ==========
function renderHome(filterCat = 'all', search = '') {
    const grid = document.getElementById('videoGrid');
    grid.innerHTML = '';

    let list = [...allVideos];

    if (filterCat !== 'all') {
        list = list.filter(v => v.category === filterCat);
    }
    if (search) {
        const q = search.toLowerCase();
        list = list.filter(v =>
            (v.title || '').toLowerCase().includes(q) ||
            (v.series_name || '').toLowerCase().includes(q)
        );
    }

    if (list.length === 0) {
        grid.innerHTML = '<p style="color:#aaa;text-align:center;grid-column:1/-1;">কোনো ভিডিও পাওয়া যায়নি</p>';
        return;
    }

    // সিরিজগুলো গ্রুপ করি
    const seriesMap = {};
    const movies = [];

    list.forEach(v => {
        if (v.series_name) {
            if (!seriesMap[v.series_name]) seriesMap[v.series_name] = [];
            seriesMap[v.series_name].push(v);
        } else {
            movies.push(v);
        }
    });

    // সিরিজ কার্ড
    Object.keys(seriesMap).forEach(name => {
        const eps = seriesMap[name].sort((a, b) => (a.season - b.season) || (a.episode - b.episode));
        const cover = eps[0];
        const card = document.createElement('div');
        card.className = 'video-card series-card';
        card.innerHTML = `
            <img src="${getThumbnailUrl(cover)}" alt="" onerror="this.src='https://via.placeholder.com/300x170?text=Series'">
            <div class="card-info">
                <h4>${name}</h4>
                <span class="badge">${eps.length} পর্ব</span>
            </div>
        `;
        card.onclick = () => showSeriesEpisodes(name, eps);
        grid.appendChild(card);
    });

    // মুভি কার্ড
    movies.forEach(v => {
        const card = document.createElement('div');
        card.className = 'video-card';
        card.innerHTML = `
            <img src="${getThumbnailUrl(v)}" alt="" onerror="this.src='https://via.placeholder.com/300x170?text=Movie'">
            <h4>${v.title}</h4>
        `;
        card.onclick = () => playVideo(v);
        grid.appendChild(card);
    });
}

// ========== সিরিজের পর্ব লিস্ট ==========
function showSeriesEpisodes(seriesName, episodes) {
    const grid = document.getElementById('videoGrid');
    grid.innerHTML = '';

    // ব্যাক বাটন
    const back = document.createElement('div');
    back.className = 'back-btn';
    back.innerHTML = '← ফিরে যাও';
    back.onclick = () => {
        document.querySelector('.tab-btn.active')?.click();
    };
    grid.appendChild(back);

    const title = document.createElement('h3');
    title.className = 'series-title';
    title.innerText = seriesName;
    grid.appendChild(title);

    episodes.forEach(ep => {
        const card = document.createElement('div');
        card.className = 'episode-card';
        const seasonEpText = ep.season > 0 ? `S${String(ep.season).padStart(2,'0')}E${String(ep.episode).padStart(2,'0')} - ` : '';
        card.innerHTML = `
            <img src="${getThumbnailUrl(ep)}" alt="">
            <div>
                <strong>${seasonEpText}${ep.title}</strong>
            </div>
        `;
        card.onclick = () => playVideo(ep, episodes);
        grid.appendChild(card);
    });
}

// ========== প্লেয়ার ==========
function playVideo(video, seriesEps = null) {
    currentVideo = video;

    if (seriesEps) {
        currentSeriesEpisodes = seriesEps;
    } else if (video.series_name) {
        currentSeriesEpisodes = allVideos
            .filter(v => v.series_name === video.series_name)
            .sort((a, b) => (a.season - b.season) || (a.episode - b.episode));
    } else {
        currentSeriesEpisodes = [];
    }

    document.getElementById('playerTitle').innerText = video.title;
    document.getElementById('playerModal').classList.remove('hidden');

    const player = document.getElementById('mainPlayer');
    player.src = getStreamUrl(video);
    player.play().catch(() => {});

    // Prev / Next বাটন আপডেট
    updateNavButtons();
}

function updateNavButtons() {
    const prevBtn = document.getElementById('prevEp');
    const nextBtn = document.getElementById('nextEp');

    if (!prevBtn || !nextBtn) return;

    if (!currentSeriesEpisodes.length || !currentVideo) {
        prevBtn.style.display = 'none';
        nextBtn.style.display = 'none';
        return;
    }

    const idx = currentSeriesEpisodes.findIndex(v => v.unique_code === currentVideo.unique_code);
    prevBtn.style.display = idx > 0 ? 'inline-block' : 'none';
    nextBtn.style.display = idx < currentSeriesEpisodes.length - 1 ? 'inline-block' : 'none';

    prevBtn.onclick = () => {
        if (idx > 0) playVideo(currentSeriesEpisodes[idx - 1], currentSeriesEpisodes);
    };
    nextBtn.onclick = () => {
        if (idx < currentSeriesEpisodes.length - 1) playVideo(currentSeriesEpisodes[idx + 1], currentSeriesEpisodes);
    };
}

// ========== ইভেন্ট ==========
document.getElementById('closeModal').onclick = () => {
    const player = document.getElementById('mainPlayer');
    player.pause();
    player.src = '';
    document.getElementById('playerModal').classList.add('hidden');
    currentVideo = null;
};

document.getElementById('searchInput').oninput = (e) => {
    const cat = document.querySelector('.tab-btn.active')?.dataset.cat || 'all';
    renderHome(cat, e.target.value);
};

document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.onclick = (e) => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        renderHome(e.target.dataset.cat, document.getElementById('searchInput').value);
    };
});

fetchVideos();
        
