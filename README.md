# QuickQuiz - সম্পূর্ণ ফ্ল্যাট প্রজেক্ট

সব ফাইল রুট ফোল্ডারে। কোনো সাবফোল্ডার নেই।

## সেটআপ

1. Supabase এ নতুন প্রজেক্ট খোলো
2. `supabase-schema.sql` পুরো কোড SQL Editor এ রান করো
3. Authentication → Providers → Email → **Confirm email = OFF** করো
4. `config.js` ফাইলে তোমার SUPABASE_URL এবং SUPABASE_ANON_KEY বসাও
5. সব ফাইল GitHub এ আপলোড করো (রুটে)
6. Vercel এ Import করে ডিপ্লয় করো

## ফাইল লিস্ট (সব রুটে)
- index.html
- login.html
- register.html
- dashboard.html
- quiz.html
- redeem.html
- admin.html
- style.css
- config.js
- supabase.js
- supabase-schema.sql
- README.md

## প্রথম Admin বানানো
একজন ইউজার রেজিস্টার করার পর Supabase → Table Editor → profiles টেবিলে গিয়ে সেই ইউজারের `is_admin` = true করে দাও।
