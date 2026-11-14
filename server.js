const { Telegraf } = require('telegraf');
const http = require('http');
const { URL } = require('url');

// আপনার সেলফ-হোস্টেড Bot API
const bot = new Telegraf(process.env.BOT_TOKEN, {
    telegram: { apiRoot: 'https://telegram-bot-api-latest-unse.onrender.com' }
});

const PRIVATE_CHANNEL_ID = '-1003969249609'; 
const BOT_USERNAME = 's_r_media_bot';

function parseInfo(caption) {
    const lines = (caption || '').split('\n').map(l => l.trim()).filter(Boolean);
    const firstLine = lines[0] || 'Untitled';
    return firstLine;
}

bot.on('channel_post', async (ctx) => {
    try {
        const post = ctx.update.channel_post;
        if (post.chat.id.toString() !== PRIVATE_CHANNEL_ID || !post.video) return;

        const caption = post.caption || '';
        const fileId = post.video.file_id;
        const thumbFileId = post.video.thumb ? post.video.thumb.file_id : null;
        const title = parseInfo(caption);

        // মিনি অ্যাপে সরাসরি ভিডিও প্লে করার ডিপ লিংক
        const deepLink = `https://t.me/${BOT_USERNAME}/app?startapp=video_${fileId}`;

        // ডেসক্রিপশন তৈরি
        const postText = `🎬 **${title}**\n\n` +
                         `👇 Watch Now / এখনই দেখুন / अभी देखें:\n` +
                         `${deepLink}\n\n` +
                         `🇧🇩 বাংলা | 🇮🇳 हिन्दी | 🇬🇧 English`;

        // থাম্বনেইল থাকলে ছবিসহ পাঠাবে, না থাকলে শুধু টেক্সট
        if (thumbFileId) {
            await bot.telegram.sendPhoto(PRIVATE_CHANNEL_ID, thumbFileId, {
                caption: postText,
                parse_mode: 'Markdown',
                reply_to_message_id: post.message_id
            });
        } else {
            await bot.telegram.sendMessage(PRIVATE_CHANNEL_ID, postText, {
                parse_mode: 'Markdown',
                reply_to_message_id: post.message_id
            });
        }

    } catch (err) { console.error(err); }
});

// স্ট্রিমিং সার্ভার
const PORT = process.env.PORT || 3000;
const server = http.createServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    const u = new URL(req.url, `http://${req.headers.host}`);
    const fileId = u.searchParams.get('file_id');

    // স্ট্রিমিং এন্ডপয়েন্ট
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

    // পিং এন্ডপয়েন্ট (Render জাগিয়ে রাখার জন্য)
    if (u.pathname === '/ping') {
        res.writeHead(200); res.end('Awake!');
        return;
    }

    res.writeHead(200); res.end('Bot is running!');
});

server.listen(PORT, () => console.log(`Server on ${PORT}`));
bot.launch().then(() => console.log('Bot started')).catch(console.error);
