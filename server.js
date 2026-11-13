const { Telegraf } = require('telegraf');
const { createClient } = require('@supabase/supabase-js');
const http = require('http');
const url = require('url');

const bot = new Telegraf(process.env.BOT_TOKEN);

const SUPABASE_URL = 'https://fkbernsvlqxgebrpvnlj.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZrYmVybnN2bHF4Z2VicnB2bmxqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQ1MjE0MTMsImV4cCI6MjExMDA5NzQxM30.pYJjTrg_Pz5ijlWVEAx-4OscqV_klWOuzbtCMSCy0pk';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const PRIVATE_CHANNEL_ID = '-1003969249609';
const BOT_USERNAME = 's_r_media_bot';

const CHANNELS = {
    movies: '-1004447821482',
    cartoons: '-1004372665099',
    turkish_series: '-1004415846084'
};

const PUBLIC_CHANNEL_LINKS = [
    { text: "🎬 Movie Collection", url: "https://t.me/All_Movie_CollectionBD" },
    { text: "🧸 Cartoon Animation", url: "https://t.me/cartoon_animationbd" },
    { text: "📺 All Series Collection", url: "https://t.me/all_series_collection" }
];

// ========== সিরিজ পার্সার ==========
function parseSeriesInfo(caption) {
    const lines = caption.split('\n').map(l => l.trim()).filter(Boolean);
    const firstLine = lines[0] || "Untitled";

    const seMatch = firstLine.match(/S(\d{1,2})E(\d{1,3})/i) ||
                    firstLine.match(/Season\s*(\d+)\s*Episode\s*(\d+)/i);

    let series_name = null;
    let season = 0;
    let episode = 0;
    let title = firstLine;

    if (seMatch) {
        season = parseInt(seMatch[1]);
        episode = parseInt(seMatch[2]);
        series_name = firstLine
            .replace(/S\d{1,2}E\d{1,3}.*/i, '')
            .replace(/Season\s*\d+\s*Episode\s*\d+.*/i, '')
            .trim();
        if (!series_name) series_name = firstLine;
        title = firstLine;
    }

    return { title, series_name, season, episode };
}

// ========== Category নির্ধারণ (FIXED) ==========
function detectCategory(caption, series_name) {
    const lower = (caption || '').toLowerCase();

    // Explicit tags সবসময় priority পাবে
    if (lower.includes('#cartoon')) return { category: 'cartoons', prefix: 'ct' };
    if (lower.includes('#turkish')) return { category: 'turkish_series', prefix: 'tr' };
    if (lower.includes('#series'))  return { category: 'turkish_series', prefix: 'tr' };
    if (lower.includes('#movie'))   return { category: 'movies', prefix: 'mv' };

    // Tag না থাকলে — series_name থাকলেও ডিফল্ট movies
    // (তুর্কি সিরিজের জন্য অবশ্যই #turkish বা #series ট্যাগ দিতে হবে)
    return { category: 'movies', prefix: 'mv' };
}

// ========== Unique code with retry ==========
async function insertVideoWithRetry(payload, maxRetries = 3) {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        const uniqueCode = `${payload.prefix}-${Math.random().toString(36).substring(2, 8)}`;
        const { error } = await supabase.from('videos').insert([{
            title: payload.title,
            file_id: payload.file_id,
            thumbnail_file_id: payload.thumbnail_file_id,
            category: payload.category,
            unique_code: uniqueCode,
            series_name: payload.series_name || null,
            season: payload.season,
            episode: payload.episode
        }]);

        if (!error) return { ok: true, uniqueCode };
        // duplicate unique_code হলে retry
        if (error.code === '23505' || /duplicate/i.test(error.message || '')) {
            console.warn(`Duplicate code ${uniqueCode}, retrying...`);
            continue;
        }
        console.error('Supabase insert error:', error);
        return { ok: false, error };
    }
    return { ok: false, error: new Error('Max retries exceeded') };
}

// ========== বট: চ্যানেল পোস্ট ==========
bot.on('channel_post', async (ctx) => {
    try {
        const post = ctx.update.channel_post;
        if (post.chat.id.toString() !== PRIVATE_CHANNEL_ID) return;
        if (!post.video) return;

        const caption = post.caption || "";
        const fileId = post.video.file_id;
        const thumbFileId = post.video.thumb ? post.video.thumb.file_id : null;

        const { title, series_name, season, episode } = parseSeriesInfo(caption);
        const { category, prefix } = detectCategory(caption, series_name);

        const result = await insertVideoWithRetry({
            title, file_id: fileId, thumbnail_file_id: thumbFileId,
            category, prefix, series_name, season, episode
        });

        if (!result.ok) return;

        const targetChannel = CHANNELS[category];
        if (!targetChannel) {
            console.warn(`No channel configured for category: ${category}`);
            return;
        }

        const inlineKeyboard = [
            [{ text: "▶️ S R Media (Watch Now)", url: `https://t.me/${BOT_USERNAME}/app?startapp=${result.uniqueCode}` }],
            [PUBLIC_CHANNEL_LINKS[0], PUBLIC_CHANNEL_LINKS[1]],
            [PUBLIC_CHANNEL_LINKS[2]]
        ];

        const captionText = `🎬 **${title}**\n\n👇 মিনি অ্যাপে দেখতে ক্লিক করুন:`;

        // thumbnail থাকলে photo, না হলে video — দুইটাই fail হলে শুধু text
        try {
            if (thumbFileId) {
                await bot.telegram.sendPhoto(targetChannel, thumbFileId, {
                    caption: captionText,
                    parse_mode: 'Markdown',
                    reply_markup: { inline_keyboard: inlineKeyboard }
                });
            } else {
                await bot.telegram.sendVideo(targetChannel, fileId, {
                    caption: captionText,
                    parse_mode: 'Markdown',
                    reply_markup: { inline_keyboard: inlineKeyboard }
                });
            }
        } catch (err) {
            console.error('Primary send failed, trying fallback:', err.message);
            // Fallback: video পাঠাও
            try {
                await bot.telegram.sendVideo(targetChannel, fileId, {
                    caption: captionText,
                    parse_mode: 'Markdown',
                    reply_markup: { inline_keyboard: inlineKeyboard }
                });
            } catch (err2) {
                console.error('Video fallback also failed:', err2.message);
            }
        }

        console.log(`Saved: ${title} | ${result.uniqueCode} | ${category}`);
    } catch (err) {
        console.error('channel_post error:', err);
    }
});

// ========== HTTP সার্ভার ==========
const PORT = process.env.PORT || 3000;

// Safe getFile wrapper
async function safeGetFile(fileId) {
    try {
        const file = await bot.telegram.getFile(fileId);
        if (!file || !file.file_path) return null;
        return file;
    } catch (err) {
        console.error('getFile error:', err.message);
        return null;
    }
}

const server = http.createServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    const parsed = url.parse(req.url, true);
    const pathname = parsed.pathname;

    // ===== /api/stream =====
    if (pathname === '/api/stream') {
        const fileId = parsed.query.file_id;
        if (!fileId || typeof fileId !== 'string') {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'file_id required' }));
            return;
        }

        const file = await safeGetFile(fileId);
        if (!file) {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                error: 'File not found. Telegram Bot API 20MB limit exceeded হলে stream করা সম্ভব না।'
            }));
            return;
        }

        const tgUrl = `https://api.telegram.org/file/bot${process.env.BOT_TOKEN}/${file.file_path}`;
        res.writeHead(302, { Location: tgUrl });
        res.end();
        return;
    }

    // ===== /api/thumbnail =====
    if (pathname === '/api/thumbnail') {
        const fileId = parsed.query.file_id;
        if (!fileId || typeof fileId !== 'string') {
            res.writeHead(400);
            res.end('file_id required');
            return;
        }

        const file = await safeGetFile(fileId);
        if (!file) {
            res.writeHead(404);
            res.end('Not found');
            return;
        }

        const tgUrl = `https://api.telegram.org/file/bot${process.env.BOT_TOKEN}/${file.file_path}`;
        res.writeHead(302, { Location: tgUrl });
        res.end();
        return;
    }

    // Health check
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
        status: 'ok',
        service: 'S R Media Bot',
        endpoints: ['/api/stream', '/api/thumbnail'],
        timestamp: new Date().toISOString()
    }));
});

server.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});

// Bot launch — crash protection সহ
bot.launch()
    .then(() => console.log('✅ S R Media Bot started'))
    .catch(err => {
        console.error('❌ Bot launch failed:', err.message);
        // Server চলুক, শুধু bot fail করেছে
    });

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
