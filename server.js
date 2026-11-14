const { Telegraf } = require('telegraf');
const http = require('http');
const { URL } = require('url');
const fs = require('fs');
const path = require('path');

// আপনার Render-এ থাকা সেলফ-হোস্টেড Bot API
const bot = new Telegraf(process.env.BOT_TOKEN, {
    telegram: { apiRoot: 'https://telegram-bot-api-latest-unse.onrender.com' }
});

const PRIVATE_CHANNEL_ID = '-1003969249609'; 
const BOT_USERNAME = 's_r_media_bot';
const CHANNELS = {
    movies: '-1004447821482',
    cartoons: '-1004372665099',
    turkish_series: '-1004415846084'
};

const DATA_FILE = path.join(__dirname, 'index_data.json');
let db = {}; 
let adminDb = {}; 

// ডেটা লোড ও সেভ
if (fs.existsSync(DATA_FILE)) {
    try { 
        const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
        db = data.db || {};
        adminDb = data.adminDb || {};
    } catch (e) {}
}
function saveData() { 
    fs.writeFileSync(DATA_FILE, JSON.stringify({ db, adminDb }, null, 2)); 
}

function parseInfo(caption) {
    const lines = (caption || '').split('\n').map(l => l.trim()).filter(Boolean);
    const firstLine = lines[0] || 'Untitled';
    const seMatch = firstLine.match(/S(\d{1,2})E(\d{1,3})/i) || firstLine.match(/Season\s*(\d+)\s*Episode\s*(\d+)/i);
    
    const hashtags = caption.match(/#([a-zA-Z0-9_]+)/g) || [];
    let seriesTag = null;
    for (let tag of hashtags) {
        let cleanTag = tag.replace('#', '');
        if (!['turkish', 'series', 'cartoon', 'movie', 'srmedia'].includes(cleanTag.toLowerCase())) {
            seriesTag = cleanTag;
            break;
        }
    }

    let title = firstLine, season = 0, episode = 0;
    if (seMatch) {
        season = parseInt(seMatch[1]);
        episode = parseInt(seMatch[2]);
    }
    return { title, seriesTag, season, episode };
}

bot.on('channel_post', async (ctx) => {
    try {
        const post = ctx.update.channel_post;
        if (post.chat.id.toString() !== PRIVATE_CHANNEL_ID || !post.video) return;

        const caption = post.caption || '';
        const fileId = post.video.file_id;
        // থাম্বনেইল থাকলে নেওয়া হবে, না থাকলে ডিফল্ট ছবি
        const thumbFileId = post.video.thumb ? post.video.thumb.file_id : null;
        const { title, seriesTag, season, episode } = parseInfo(caption);

        // ডুপ্লিকেট চেক
        if (seriesTag && adminDb[seriesTag] && adminDb[seriesTag].episodes[`${season}_${episode}`]) {
            await bot.telegram.sendMessage(PRIVATE_CHANNEL_ID, 
                `⚠️ **Warning!**\n\nএই এপিসোড (Season ${season}, Episode ${episode}) অলরেডি আপলোড করা আছে।`, 
                { reply_to_message_id: post.message_id }
            );
            return;
        }

        // ডেটা সেভ
        if (seriesTag) {
            if (!adminDb[seriesTag]) adminDb[seriesTag] = { episodes: {}, message_id: null, buttons: [] };
            adminDb[seriesTag].episodes[`${season}_${episode}`] = { title, fileId, season, episode };
            await updateAdminList(seriesTag);
        }

        let category = 'movies';
        const lower = caption.toLowerCase();
        if (lower.includes('#turkish') || lower.includes('#series') || seriesTag) category = 'turkish_series';
        else if (lower.includes('#cartoon')) category = 'cartoons';

        const targetChannel = CHANNELS[category];
        
        if (targetChannel) {
            // মিনি অ্যাপের ডিপ লিংক (startapp=video_FILEID)
            const miniAppUrl = `https://t.me/${BOT_USERNAME}/app?startapp=video_${fileId}`;
            const keyboard = [[{ text: "▶️ Watch Now", url: miniAppUrl }]];

            const postText = `🎬 **${title}**\n\n` +
                             `👇 ভিডিওটি দেখতে ক্লিক করুন / वीडियो देखने के लिए क्लिक करें / Click to watch:\n\n` +
                             `🇧🇩 বাংলা | 🇮🇳 हिन्दी | 🇬🇧 English`;

            // পাবলিক চ্যানেলে শুধু থাম্বনেইল (ছবি) পাঠানো হবে
            if (thumbFileId) {
                await bot.telegram.sendPhoto(targetChannel, thumbFileId, {
                    caption: postText,
                    parse_mode: 'Markdown',
                    reply_markup: { inline_keyboard: keyboard }
                });
            } else {
                // যদি থাম্বনেইল না থাকে, তবে ভিডিও পাঠাবে (বিকল্প হিসেবে)
                await bot.telegram.sendVideo(targetChannel, fileId, {
                    caption: postText,
                    parse_mode: 'Markdown',
                    reply_markup: { inline_keyboard: keyboard }
                });
            }

            if (seriesTag) {
                await updatePublicList(targetChannel, seriesTag, title, fileId);
            }
        }
    } catch (err) { console.error(err); }
});

async function updateAdminList(tag) {
    try {
        const data = adminDb[tag];
        const sortedEps = Object.values(data.episodes).sort((a, b) => a.season - b.season || a.episode - b.episode);
        
        const keyboard = [];
        let currentRow = [];
        
        sortedEps.forEach(ep => {
            currentRow.push({ text: `▶️ S${ep.season}E${ep.episode}`, url: `https://t.me/${BOT_USERNAME}/app?startapp=video_${ep.fileId}` });
            if (currentRow.length === 3) { keyboard.push(currentRow); currentRow = []; }
        });
        if (currentRow.length > 0) keyboard.push(currentRow);

        const text = `👑 **ADMIN LIST: ${tag.replace(/_/g, ' ')}**\n\nমোট ভিডিও: ${sortedEps.length} টি`;

        if (!data.message_id) {
            const msg = await bot.telegram.sendMessage(PRIVATE_CHANNEL_ID, text, {
                parse_mode: 'Markdown',
                reply_markup: { inline_keyboard: keyboard }
            });
            data.message_id = msg.message_id;
        } else {
            await bot.telegram.editMessageText(PRIVATE_CHANNEL_ID, data.message_id, undefined, text, {
                parse_mode: 'Markdown',
                reply_markup: { inline_keyboard: keyboard }
            });
        }
        saveData();
    } catch (err) { console.error("Admin list error:", err.message); }
}

async function updatePublicList(channelId, tag, title, fileId) {
    try {
        if (!db[tag]) {
            db[tag] = { pages: { "1": { message_id: null, buttons: [] } }, currentPage: 1 };
        }

        let seriesData = db[tag];
        let currentPageStr = seriesData.currentPage.toString();
        let currentPage = seriesData.pages[currentPageStr];

        const newButton = { text: `▶️ ${title}`, url: `https://t.me/${BOT_USERNAME}/app?startapp=video_${fileId}` };
        currentPage.buttons.push(newButton);

        if (currentPage.buttons.length >= 90) {
            let nextPageNum = parseInt(currentPageStr) + 1;
            seriesData.pages[nextPageNum.toString()] = { message_id: null, buttons: [] };
            currentPage.buttons.push({ text: `➡️ More - Part ${nextPageNum}`, callback_data: `nav|${tag}|${nextPageNum}` });
            seriesData.currentPage = nextPageNum;
            currentPageStr = nextPageNum.toString();
            currentPage = seriesData.pages[currentPageStr];
        }

        const keyboard = [];
        for (let i = 0; i < currentPage.buttons.length; i += 2) {
            let row = [currentPage.buttons[i]];
            if (currentPage.buttons[i+1]) row.push(currentPage.buttons[i+1]);
            keyboard.push(row);
        }

        if (!currentPage.message_id) {
            const msg = await bot.telegram.sendMessage(channelId, 
                `📌 **${tag.replace(/_/g, ' ')} - List ${currentPageStr}**\n\n` +
                `নিচের বাটনগুলোতে ক্লিক করে ভিডিও দেখুন / नीचे दिए गए बटन पर क्लिक करके वीडियो देखें / Click below buttons to watch:`, {
                parse_mode: 'Markdown',
                reply_markup: { inline_keyboard: keyboard }
            });
            currentPage.message_id = msg.message_id;
        } else {
            await bot.telegram.editMessageReplyMarkup(channelId, currentPage.message_id, undefined, {
                inline_keyboard: keyboard
            });
        }
        saveData();
    } catch (err) { console.error(err.message); }
}

bot.on('callback_query', async (ctx) => {
    const data = ctx.callbackQuery.data.split('|');
    if (data[0] === 'nav') {
        const tag = data[1], pageNum = data[2];
        const pageData = db[tag].pages[pageNum];

        if (pageData) {
            const keyboard = [];
            for (let i = 0; i < pageData.buttons.length; i += 2) {
                let row = [pageData.buttons[i]];
                if (pageData.buttons[i+1]) row.push(pageData.buttons[i+1]);
                keyboard.push(row);
            }

            await ctx.editMessageText(
                `📌 **${tag.replace(/_/g, ' ')} - List ${pageNum}**\n\n` +
                `নিচের বাটনগুলোতে ক্লিক করে ভিডিও দেখুন / नीचे दिए गए बटन पर क्लिक करके वीडियो देखें / Click below buttons to watch:`, {
                parse_mode: 'Markdown',
                reply_markup: { inline_keyboard: keyboard }
            });
        }
        await ctx.answerCbQuery();
    }
});

const PORT = process.env.PORT || 3000;
const server = http.createServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    const u = new URL(req.url, `http://${req.headers.host}`);
    const fileId = u.searchParams.get('file_id');

    if (u.pathname === '/api/stream') {
        if (!fileId) { res.writeHead(400); return res.end('Need file_id'); }
        try {
            const file = await bot.telegram.getFile(fileId);
            const tgUrl = `https://telegram-bot-api-latest-unse.onrender.com/file/bot${process.env.BOT_TOKEN}/${file.file_path}`;
            res.writeHead(302, { Location: tgUrl });
            res.end();
        } catch (err) { res.writeHead(500); res.end(err.message); }
        return;
    }
    res.writeHead(200); res.end('Bot is running!');
});

server.listen(PORT, () => console.log(`Server on ${PORT}`));
bot.launch().then(() => console.log('Bot started')).catch(console.error);
