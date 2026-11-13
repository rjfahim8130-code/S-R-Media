const { Telegraf } = require('telegraf');
const http = require('http');
const { URL } = require('url');
const fs = require('fs');
const path = require('path');

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

if (fs.existsSync(DATA_FILE)) {
    try { db = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); } catch (e) {}
}
function saveData() { fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2)); }

function parseInfo(caption) {
    const lines = (caption || '').split('\n').map(l => l.trim()).filter(Boolean);
    const firstLine = lines[0] || 'Untitled';
    const seMatch = firstLine.match(/S(\d{1,2})E(\d{1,3})/i);
    
    const hashtags = caption.match(/#([a-zA-Z0-9_]+)/g) || [];
    let seriesTag = null;
    for (let tag of hashtags) {
        let cleanTag = tag.replace('#', '');
        if (!['turkish', 'series', 'cartoon', 'movie'].includes(cleanTag.toLowerCase())) {
            seriesTag = cleanTag;
            break;
        }
    }
    return { title: firstLine, seriesTag };
}

bot.on('channel_post', async (ctx) => {
    try {
        const post = ctx.update.channel_post;
        if (post.chat.id.toString() !== PRIVATE_CHANNEL_ID || !post.video) return;

        const caption = post.caption || '';
        const fileId = post.video.file_id;
        const { title, seriesTag } = parseInfo(caption);

        let category = 'movies';
        const lower = caption.toLowerCase();
        if (lower.includes('#turkish') || lower.includes('#series') || seriesTag) category = 'turkish_series';
        else if (lower.includes('#cartoon')) category = 'cartoons';

        const targetChannel = CHANNELS[category];
        
        if (targetChannel) {
            // ক্যাপশনে বাংলা, হিন্দি, ইংরেজি তিন ভাষায় লেখা
            await bot.telegram.sendVideo(targetChannel, fileId, {
                caption: `🎬 **${title}**\n\n` +
                         `👇 ভিডিওটি দেখতে ক্লিক করুন / वीडियो देखने के लिए क्लिक करें / Click to watch:\n\n` +
                         `🇧🇩 বাংলা | 🇮🇳 हिन्दी | 🇬🇧 English`,
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [[{ text: "▶️ Watch Now", url: `https://t.me/${BOT_USERNAME}/app?startapp=video_${fileId}` }]]
                }
            });

            if (seriesTag) {
                await updateListSystem(targetChannel, seriesTag, title, fileId);
            }
        }
    } catch (err) { console.error(err); }
});

async function updateListSystem(channelId, tag, title, fileId) {
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
