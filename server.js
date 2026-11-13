const { Telegraf } = require('telegraf');
const { createClient } = require('@supabase/supabase-js');

const bot = new Telegraf(process.env.BOT_TOKEN);
const SUPABASE_URL = 'https://fkbernsvlqxgebrpvnlj.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZrYmVybnN2bHF4Z2VicnB2bmxqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQ1MjE0MTMsImV4cCI6MjExMDA5NzQxM30.pYJjTrg_Pz5ijlWVEAx-4OscqV_klWOuzbtCMSCy0pk';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// আপনার দেওয়া চ্যানেলগুলোর আইডি
const PRIVATE_CHANNEL_ID = '-1003969249609';
const CHANNELS = {
    movies: '-1004447821482',        // Movie Collection
    cartoons: '-1004372665099',      // Cartoon animation
    turkish_series: '-1004415846084'   // All series collection
};

// ৩টি পাবলিক চ্যানেলের স্থায়ী ইউজারনেম/লিংক
const PUBLIC_CHANNEL_LINKS = [
    { text: "🎬 Movie Collection", url: "https://t.me/All_Movie_CollectionBD" },
    { text: "🧸 Cartoon Animation", url: "https://t.me/cartoon_animationbd" },
    { text: "📺 All Series Collection", url: "https://t.me/all_series_collection" }
];

bot.on('channel_post', async (ctx) => {
    const post = ctx.update.channel_post;
    if (post.chat.id.toString() !== PRIVATE_CHANNEL_ID) return; // শুধু আপনার প্রাইভেট চ্যানেল থেকে ধরবে
    if (!post.video) return;

    const caption = post.caption || "";
    const fileId = post.video.file_id;
    const thumbnail = post.video.thumb ? post.video.thumb.file_id : null;
    const title = caption.split('\n')[0] || "Untitled Video";

    let category = 'movies';
    let prefix = 'mv';
    if (caption.includes('#turkish') || caption.includes('#series')) { category = 'turkish_series'; prefix = 'tr'; }
    else if (caption.includes('#cartoon')) { category = 'cartoons'; prefix = 'ct'; }

    const uniqueCode = `${prefix}-${Math.random().toString(36).substring(2, 8)}`;

    // Supabase-এ সেভ
    await supabase.from('videos').insert([{
        title,
        file_id: fileId,
        thumbnail_url: thumbnail,
        category,
        unique_code: uniqueCode
    }]);

    // সংশ্লিষ্ট মূল পাবলিক চ্যানেলে পোস্ট পাঠানো এবং সাথে ৩টি চ্যানেলের লিংক ইনলাইন বাটনে যুক্ত করা
    const targetChannel = CHANNELS[category];
    if (targetChannel) {
        // ইনলাইন কিবোর্ড তৈরি: প্রথমে মিনি অ্যাপে দেখার বাটন, নিচে ৩টি চ্যানেলের লিংক
        const inlineKeyboard = [
            [{ text: "▶️ S R Media (Watch Now)", url: `https://t.me/YourBotUsername/miniapp?startapp=${uniqueCode}` }],
            [PUBLIC_CHANNEL_LINKS[0], PUBLIC_CHANNEL_LINKS[1]],
            [PUBLIC_CHANNEL_LINKS[2]]
        ];

        await bot.telegram.sendPhoto(targetChannel, fileId, {
            caption: `🎬 **${title}**\n\n👇 মিনি অ্যাপে দেখতে বা আমাদের অন্যান্য চ্যানেলে যুক্ত হতে নিচে ক্লিক করুন:`,
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: inlineKeyboard
            }
        });
    }
});

bot.launch();
console.log("S R Media Master Bot is running...");
       
