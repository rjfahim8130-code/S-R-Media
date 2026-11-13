const { Telegraf } = require('telegraf');
const { createClient } = require('@supabase/supabase-js');
const http = require('http');
const https = require('https');
const url = require('url');

const bot = new Telegraf(process.env.BOT_TOKEN);

const SUPABASE_URL = 'https://fkbernsvlqxgebrpvnlj.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZrYmVybnN2bHF4Z2VicnB2bmxqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQ1MjE0MTMsImV4cCI6MjExMDA5NzQxM30.pYJjTrg_Pz5ijlWVEAx-4OscqV_klWOuzbtCMSCy0pk';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const PRIVATE_CHANNEL_ID = '-1003969249609';
const BOT_USERNAME = 's_r_media_bot'; // তোমার বট ইউজারনেম

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

    // S01E05 / S1E5 / Season 1 Episode 5 প্যাটার্ন
    const seMatch = firstLine.match(/S(\d{1,2})E(\d{1,3})/i) || 
                    firstLine.match(/Season\s*(\d+)\s*Episode\s*(\d+)/i);

    let series_name = null;
    let season = 0;
    let episode = 0;
    let title = firstLine;

    if (seMatch) {
        season = parseInt(seMatch[1]);
        episode = parseInt(seMatch[2]);
        // SxxExx এর আগের অংশকে সিরিজ নাম ধরো
        series_name = firstLine.replace(/S\d{1,2}E\d{1,3}.*/i, '').trim()
                               .replace(/Season\s*\d+\s*Episode\s*\d+.*/i, '').trim();
        if (!series_name) series_name = firstLine;
        title = firstLine;
    }

    return { title, series_name, season, episode };
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

        let category = 'movies';
        let prefix = 'mv';
        if (caption.toLowerCase().includes('#turkish') || caption.toLowerCase().includes('#series') || series_name) {
            category = 'turkish_series';
            prefix = 'tr';
        } else if (caption.toLowerCase().includes('#cartoon')) {
            category = 'cartoons';
            prefix = 'ct';
        }

        const uniqueCode = `${prefix}-${Math.random().toString(36).substring(2, 8)}`;

        const { error } = await supabase.from('videos').insert([{
            title,
            file_id: fileId,
            thumbnail_file_id: thumbFileId,
            category,
            unique_code: uniqueCode,
            series_name: series_name || null,
            season,
            episode
        }]);

        if (error) {
            console.error('Supabase insert error:', error);
            return;
        }

        const targetChannel = CHANNELS[category];
        if (targetChannel) {
            const inlineKeyboard = [
                [{ text: "▶️ S R Media (Watch Now)", url: `https://t.me/${BOT_USERNAME}/app?startapp=${uniqueCode}` }],
                [PUBLIC_CHANNEL_LINKS[0], PUBLIC_CHANNEL_LINKS[1]],
                [PUBLIC_CHANNEL_LINKS[2]]
            ];

            const captionText = `🎬 **${title}**\n\n👇 মিনি অ্যাপে দেখতে ক্লিক করুন:`;

            try {
                if (thumbFileId) {
                    // থাম্বনেইল থাকলে ফটো পাঠাও
                    await bot.telegram.sendPhoto(targetChannel, thumbFileId, {
                        caption: captionText,
                        parse_mode: 'Markdown',
                        reply_markup: { inline_keyboard: inlineKeyboard }
                    });
                } else {
                    // থাম্বনেইল না থাকলে ভিডিওই পাঠাও
                    await bot.telegram.sendVideo(targetChannel, fileId, {
                        caption: captionText,
                        parse_mode: 'Markdown',
                        reply_markup: { inline_keyboard: inlineKeyboard }
                    });
                }
            } catch (err) {
                console.error('Public channel post error:', err.message);
            }
        }

        console.log(`Saved: ${title} | ${uniqueCode}`);
    } catch (err) {
        console.error('channel_post error:', err);
    }
});

// ========== HTTP সার্ভার (স্ট্রিম + থাম্বনেইল) ==========
const PORT = process.env.PORT || 3000;

const server = http.createServer(async (req, res) => {
    // CORS
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

    // ===== /api/stream?file_id=XXX =====
    if (pathname === '/api/stream') {
        const fileId = parsed.query.file_id;
        if (!fileId) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'file_id required' }));
            return;
        }

        try {
            const file = await bot.telegram.getFile(fileId);
            if (!file.file_path) {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'File not found or too large (>20MB)' }));
                return;
            }

            const tgUrl = `https://api.telegram.org/file/bot${process.env.BOT_TOKEN}/${file.file_path}`;

            // Redirect করে দিই (টোকেন ফ্রন্টএন্ডে দেখা যায় না)
            res.writeHead(302, { Location: tgUrl });
            res.end();
        } catch (err) {
            console.error('Stream error:', err.message);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: err.message }));
        }
        return;
    }

    // ===== /api/thumbnail?file_id=XXX =====
    if (pathname === '/api/thumbnail') {
        const fileId = parsed.query.file_id;
        if (!fileId) {
            res.writeHead(400);
            res.end('file_id required');
            return;
        }

        try {
            const file = await bot.telegram.getFile(fileId);
            if (!file.file_path) {
                res.writeHead(404);
                res.end('Not found');
                return;
            }
            const tgUrl = `https://api.telegram.org/file/bot${process.env.BOT_TOKEN}/${file.file_path}`;
            res.writeHead(302, { Location: tgUrl });
            res.end();
        } catch (err) {
            res.writeHead(500);
            res.end(err.message);
        }
        return;
    }

    // Health check
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('S R Media Bot is running successfully!\n');
});

server.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});

bot.launch().then(() => console.log('S R Media Bot started'));
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
        
