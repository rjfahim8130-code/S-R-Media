const SUPABASE_URL = 'https://fkbernsvlqxgebrpvnlj.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZrYmVybnN2bHF4Z2VicnB2bmxqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQ1MjE0MTMsImV4cCI6MjExMDA5NzQxM30.pYJjTrg_Pz5ijlWVEAx-4OscqV_klWOuzbtCMSCy0pk';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const BACKEND_URL = 'https://s-r-media.onrender.com';
const PLACEHOLDER = 'https://via.placeholder.com/300x170/1e293b/94a3b8?text=Video';
const PLACEHOLDER_EP = 'https://via.placeholder.com/120x68/1e293b/94a3b8?text=EP';

const tg = window.Telegram?.WebApp;
if (tg) {
    tg.ready();
    tg.expand();
}

let allVideos = [];
let currentVideo = null;
let currentSeriesEpisodes = [];

// ========== Fetch ==========
async function fetchVideos() {
    const grid = document.getElementById('videoGrid');
    try {
        const { data, error } = await supabase
            .from('videos')
            .select('*')
            .order('id', { ascending: false });

        if (error) {
            console.error('Fetch error:', error);
            if (grid) grid.innerHTML =
                `<p style="color:#f87171;text-align:center;padding:20px;grid-column:1/-1;">এরর: ${error.message}</p>`;
            return;
        }

        console.log('Videos loaded:', data?.length || 0);
        allVideos = data || [];
        renderHome();

        // Deep link
        const startParam = tg?.initDataUnsafe?.start_param;
        if (startParam) {
            const target = allVideos.find(v => v.unique_code === startParam);
            if (target) {
                playVideo(target);
            } else {
                console.warn('start_param video not found:', startParam);
            }
        }
    } catch (e) {
        console.error(e);
        if (grid) grid.innerHTML =
            `<p style="color:#f87171;text-align:center;grid-column:1/-1;">লোড ব্যর্থ</p>`;
    }
}

// ========== Thumbnail (FIXED) ==========
function getThumb(video) {
    // thumbnail_url কে সবসময় full URL হিসেবে ধরি
    if (video.thumbnail_url && /^https?:\/\//i.test(video.thumbnail_url)) {
        return video.thumbnail_url;
    }
    const fid = video.thumbnail_file_id;
    if (!fid || typeof fid !== 'string' || fid.length < 10) return PLACEHOLDER;
    if (/^https?:\/\//i.test(fid)) return fid;
    return `${BACKEND_URL}/api/thumbnail?file_id=${encodeURIComponent(fid)}`;
}

function getStream(video) {
    if (!video || !video.file_id) return '';
    return `${BACKEND_URL}/api/stream?file_id=${encodeURIComponent(video.file_id)}`;
}

// ========== Home render ==========
function renderHome(filterCat = 'all', search = '') {
    const grid = document.getElementById('videoGrid');
    if (!grid) return;
    grid.innerHTML = '';

    let list = [...allVideos];
    if (filterCat !== 'all') list = list.filter(v => v.category === filterCat);
    if (search) {
        const q = search.toLowerCase();
        list = list.filter(v =>
            (v.title || '').toLowerCase().includes(q) ||
            (v.series_name || '').toLowerCase().includes(q)
        );
    }

    if (list.length === 0) {
        grid.innerHTML = '<p style="color:#94a3b8;text-align:center;grid-column:1/-1;padding:30px;">কোনো ভিডিও পাওয়া যায়নি</p>';
        return;
    }

    const seriesMap = {};
    const singles = [];

    list.forEach(v => {
        let seriesName = v.series_name;
        if (!seriesName) {
            const m = (v.title || '').match(/^(.+?)\s+S\d{1,2}E\d{1,3}/i);
            if (m) seriesName = m[1].trim();
        }
        if (seriesName) {
            if (!seriesMap[seriesName]) seriesMap[seriesName] = [];
            seriesMap[seriesName].push(v);
        } else {
            singles.push(v);
        }
    });

    Object.keys(seriesMap).forEach(name => {
        const eps = seriesMap[name].sort((a, b) =>
            (a.season || 0) - (b.season || 0) || (a.episode || 0) - (b.episode || 0)
        );
        const cover = eps[0];
        const card = document.createElement('div');
        card.className = 'video-card';
        card.innerHTML = `
            <img src="${getThumb(cover)}" alt="" loading="lazy"
                 onerror="this.onerror=null;this.src='${PLACEHOLDER}'">
            <div class="card-info">
                <h4>${name}</h4>
                <span class="badge">${eps.length} পর্ব</span>
            </div>
        `;
        card.onclick = () => showSeriesEpisodes(name, eps);
        grid.appendChild(card);
    });

    singles.forEach(v => {
        const card = document.createElement('div');
        card.className = 'video-card';
        card.innerHTML = `
            <img src="${getThumb(v)}" alt="" loading="lazy"
                 onerror="this.onerror=null;this.src='${PLACEHOLDER}'">
            <h4>${v.title || 'Untitled'}</h4>
        `;
        card.onclick = () => playVideo(v);
        grid.appendChild(card);
    });
}

// ========== Series episodes view ==========
function showSeriesEpisodes(seriesName, episodes) {
    const grid = document.getElementById('videoGrid');
    if (!grid) return;
    grid.innerHTML = '';

    const back = document.createElement('div');
    back.className = 'back-btn';
    back.innerHTML = '← ফিরে যাও';
    back.onclick = () => {
        const active = document.querySelector('.tab-btn.active');
        renderHome(active?.dataset.cat || 'all',
                   document.getElementById('searchInput')?.value || '');
    };
    grid.appendChild(back);

    const title = document.createElement('h3');
    title.className = 'series-title';
    title.innerText = seriesName;
    grid.appendChild(title);

    episodes.forEach(ep => {
        const card = document.createElement('div');
        card.className = 'episode-card';
        const se = (ep.season > 0)
            ? `S${String(ep.season).padStart(2, '0')}E${String(ep.episode).padStart(2, '0')} · `
            : '';
        card.innerHTML = `
            <img src="${getThumb(ep)}" alt=""
                 onerror="this.onerror=null;this.src='${PLACEHOLDER_EP}'">
            <div><strong>${se}${ep.title}</strong></div>
        `;
        card.onclick = () => playVideo(ep, episodes);
        grid.appendChild(card);
    });
}

// ========== Play video (FIXED reset) ==========
function playVideo(video, seriesEps = null) {
    if (!video) return;

    // reset
    currentSeriesEpisodes = [];
    currentVideo = video;

    if (seriesEps && seriesEps.length) {
        currentSeriesEpisodes = seriesEps;
    } else if (video.series_name) {
        currentSeriesEpisodes = allVideos
            .filter(v => v.series_name === video.series_name)
            .sort((a, b) =>
                (a.season || 0) - (b.season || 0) ||
                (a.episode || 0) - (b.episode || 0)
            );
    } else {
        const m = (video.title || '').match(/^(.+?)\s+S\d{1,2}E\d{1,3}/i);
        if (m) {
            const name = m[1].trim();
            currentSeriesEpisodes = allVideos
                .filter(v => (v.title || '').startsWith(name))
                .sort((a, b) => (a.title || '').localeCompare(b.title || ''));
        }
    }

    document.getElementById('playerTitle').innerText = video.title || 'Video';
    document.getElementById('playerModal').classList.remove('hidden');

    const player = document.getElementById('mainPlayer');
    const streamUrl = getStream(video);
    if (!streamUrl) {
        console.error('No stream URL for video:', video);
        return;
    }
    player.src = streamUrl;
    player.play().catch(err => {
        console.warn('Autoplay blocked:', err.message);
    });

    updateNavButtons();
}

// ========== Prev/Next ==========
function updateNavButtons() {
    const prevBtn = document.getElementById('prevEp');
    const nextBtn = document.getElementById('nextEp');
    if (!prevBtn || !nextBtn) return;

    if (!currentSeriesEpisodes.length || !currentVideo) {
        prevBtn.style.display = 'none';
        nextBtn.style.display = 'none';
        return;
    }

    const idx = currentSeriesEpisodes.findIndex(v =>
        (v.unique_code && v.unique_code === currentVideo.unique_code) ||
        v.id === currentVideo.id
    );

    prevBtn.style.display = idx > 0 ? 'inline-block' : 'none';
    nextBtn.style.display = (idx >= 0 && idx < currentSeriesEpisodes.length - 1)
        ? 'inline-block' : 'none';

    prevBtn.onclick = () => {
        if (idx > 0) playVideo(currentSeriesEpisodes[idx - 1], currentSeriesEpisodes);
    };
    nextBtn.onclick = () => {
        if (idx >= 0 && idx < currentSeriesEpisodes.length - 1)
            playVideo(currentSeriesEpisodes[idx + 1], currentSeriesEpisodes);
    };
}

// ========== Close modal ==========
document.getElementById('closeModal').onclick = () => {
    const player = document.getElementById('mainPlayer');
    player.pause();
    player.removeAttribute('src');
    player.load();
    document.getElementById('playerModal').classList.add('hidden');
    currentVideo = null;
    currentSeriesEpisodes = [];
};

// ========== Search ==========
document.getElementById('searchInput').oninput = (e) => {
    const cat = document.querySelector('.tab-btn.active')?.dataset.cat || 'all';
    renderHome(cat, e.target.value);
};

// ========== Tabs ==========
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.onclick = (e) => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        renderHome(e.target.dataset.cat,
                   document.getElementById('searchInput')?.value || '');
    };
});

// ========== Init ==========
fetchVideos();
