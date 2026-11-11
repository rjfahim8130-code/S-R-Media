-- =============================================
-- QuickQuiz Complete Supabase Schema
-- Run this entire SQL in Supabase SQL Editor
-- =============================================

-- 1. Profiles table (extends auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  points INTEGER DEFAULT 0,
  total_earned INTEGER DEFAULT 0,
  referral_code TEXT UNIQUE,
  referred_by UUID REFERENCES public.profiles(id),
  successful_referrals INTEGER DEFAULT 0,
  is_admin BOOLEAN DEFAULT false,
  is_blocked BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Site Settings (Admin controllable)
CREATE TABLE IF NOT EXISTS public.site_settings (
  id INTEGER PRIMARY KEY DEFAULT 1,
  min_redeem_points INTEGER DEFAULT 600,
  min_referrals_for_redeem INTEGER DEFAULT 3,
  points_per_quiz INTEGER DEFAULT 10,
  referral_bonus_percent INTEGER DEFAULT 15,
  daily_max_sessions INTEGER DEFAULT 5,
  quizzes_per_session INTEGER DEFAULT 4,
  lock_minutes INTEGER DEFAULT 20,
  monetag_popunder_code TEXT DEFAULT '',
  adsterra_popunder_code TEXT DEFAULT '',
  social_bar_code TEXT DEFAULT '',
  banner_code TEXT DEFAULT '',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO public.site_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- 3. Quizzes
CREATE TABLE IF NOT EXISTS public.quizzes (
  id SERIAL PRIMARY KEY,
  question TEXT NOT NULL,
  option_a TEXT NOT NULL,
  option_b TEXT NOT NULL,
  option_c TEXT NOT NULL,
  option_d TEXT NOT NULL,
  correct_option CHAR(1) NOT NULL CHECK (correct_option IN ('A','B','C','D')),
  category TEXT DEFAULT 'সাধারণ জ্ঞান',
  info_text TEXT, -- কুইজের আগে পড়ার তথ্য
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. User Quiz History (for 3-day no-repeat)
CREATE TABLE IF NOT EXISTS public.user_quiz_history (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  quiz_id INTEGER REFERENCES public.quizzes(id) ON DELETE CASCADE,
  answered_at TIMESTAMPTZ DEFAULT NOW(),
  is_correct BOOLEAN,
  UNIQUE(user_id, quiz_id, answered_at)
);

CREATE INDEX IF NOT EXISTS idx_user_quiz_history_user_time 
  ON public.user_quiz_history(user_id, answered_at DESC);

-- 5. Sessions tracking
CREATE TABLE IF NOT EXISTS public.user_sessions (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  session_date DATE DEFAULT CURRENT_DATE,
  session_number INTEGER DEFAULT 1,
  quizzes_completed INTEGER DEFAULT 0,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  is_completed BOOLEAN DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_user_sessions_user_date 
  ON public.user_sessions(user_id, session_date);

-- 6. Referral tracking (only becomes successful after quiz)
CREATE TABLE IF NOT EXISTS public.referrals (
  id BIGSERIAL PRIMARY KEY,
  referrer_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  referred_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  is_successful BOOLEAN DEFAULT false, -- true only after referred user completes at least 1 quiz
  points_awarded INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  successful_at TIMESTAMPTZ,
  UNIQUE(referred_id)
);

-- 7. Redeem Requests
CREATE TABLE IF NOT EXISTS public.redeem_requests (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  points INTEGER NOT NULL,
  payment_method TEXT NOT NULL, -- bKash / Nagad / Rocket
  payment_number TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  admin_note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

-- 8. Points Log (for history & encouraging messages)
CREATE TABLE IF NOT EXISTS public.points_log (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  points INTEGER NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- RLS Policies
-- =============================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_quiz_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.redeem_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.points_log ENABLE ROW LEVEL SECURITY;

-- Profiles
CREATE POLICY "Public profiles are viewable by everyone" ON public.profiles
  FOR SELECT USING (true);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Settings (everyone can read, only admin can update - handled in app)
CREATE POLICY "Settings are viewable by everyone" ON public.site_settings
  FOR SELECT USING (true);

-- Quizzes
CREATE POLICY "Active quizzes are viewable by everyone" ON public.quizzes
  FOR SELECT USING (is_active = true);

-- User history
CREATE POLICY "Users can view own history" ON public.user_quiz_history
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own history" ON public.user_quiz_history
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Sessions
CREATE POLICY "Users can view own sessions" ON public.user_sessions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own sessions" ON public.user_sessions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own sessions" ON public.user_sessions
  FOR UPDATE USING (auth.uid() = user_id);

-- Referrals
CREATE POLICY "Users can view own referrals" ON public.referrals
  FOR SELECT USING (auth.uid() = referrer_id OR auth.uid() = referred_id);

CREATE POLICY "System can insert referrals" ON public.referrals
  FOR INSERT WITH CHECK (true);

CREATE POLICY "System can update referrals" ON public.referrals
  FOR UPDATE USING (true);

-- Redeem
CREATE POLICY "Users can view own redeem" ON public.redeem_requests
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own redeem" ON public.redeem_requests
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Points log
CREATE POLICY "Users can view own points log" ON public.points_log
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "System can insert points log" ON public.points_log
  FOR INSERT WITH CHECK (true);

-- =============================================
-- Functions
-- =============================================

-- Auto create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  new_code TEXT;
BEGIN
  -- Generate unique referral code
  new_code := UPPER(SUBSTRING(MD5(NEW.id::TEXT || NOW()::TEXT) FROM 1 FOR 8));
  
  INSERT INTO public.profiles (id, email, full_name, referral_code)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', SPLIT_PART(NEW.email, '@', 1)),
    new_code
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to get available quizzes for user (no repeat in last 3 days)
CREATE OR REPLACE FUNCTION public.get_available_quizzes(p_user_id UUID, p_limit INTEGER DEFAULT 4)
RETURNS SETOF public.quizzes AS $$
BEGIN
  RETURN QUERY
  SELECT q.*
  FROM public.quizzes q
  WHERE q.is_active = true
    AND q.id NOT IN (
      SELECT uqh.quiz_id
      FROM public.user_quiz_history uqh
      WHERE uqh.user_id = p_user_id
        AND uqh.answered_at > NOW() - INTERVAL '3 days'
    )
  ORDER BY RANDOM()
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- Sample Bangla Quizzes (50+ questions)
-- =============================================

INSERT INTO public.quizzes (question, option_a, option_b, option_c, option_d, correct_option, category, info_text) VALUES
('বাংলাদেশের রাজধানী কোনটি?', 'চট্টগ্রাম', 'ঢাকা', 'খুলনা', 'রাজশাহী', 'B', 'সাধারণ জ্ঞান', 'বাংলাদেশ দক্ষিণ এশিয়ার একটি স্বাধীন দেশ। ১৯৭১ সালে স্বাধীনতা লাভ করে।'),
('বাংলাদেশের জাতীয় ফুল কোনটি?', 'শাপলা', 'রজনীগন্ধা', 'গোলাপ', 'সূর্যমুখী', 'A', 'সাধারণ জ্ঞান', 'শাপলা বাংলাদেশের জাতীয় ফুল। এটি সাধারণত পুকুর ও বিলে পাওয়া যায়।'),
('বাংলাদেশের জাতীয় পাখি কোনটি?', 'দোয়েল', 'ময়না', 'টিয়া', 'কাক', 'A', 'সাধারণ জ্ঞান', 'দোয়েল বাংলাদেশের জাতীয় পাখি। এর ডাক খুব মিষ্টি।'),
('বাংলাদেশের জাতীয় মাছ কোনটি?', 'ইলিশ', 'রুই', 'কাতলা', 'পাঙ্গাশ', 'A', 'সাধারণ জ্ঞান', 'ইলিশ বাংলাদেশের জাতীয় মাছ এবং দেশের অন্যতম জনপ্রিয় খাবার।'),
('স্বাধীনতা দিবস কবে পালিত হয়?', '২৬ মার্চ', '১৬ ডিসেম্বর', '২১ ফেব্রুয়ারি', '১৪ এপ্রিল', 'A', 'ইতিহাস', '১৯৭১ সালের ২৬ মার্চ বাংলাদেশের স্বাধীনতা ঘোষণা করা হয়।'),
('বিজয় দিবস কবে?', '১৬ ডিসেম্বর', '২৬ মার্চ', '২১ ফেব্রুয়ারি', '১৫ আগস্ট', 'A', 'ইতিহাস', '১৯৭১ সালের ১৬ ডিসেম্বর পাকিস্তানি বাহিনী আত্মসমর্পণ করে।'),
('আন্তর্জাতিক মাতৃভাষা দিবস কবে?', '২১ ফেব্রুয়ারি', '২৬ মার্চ', '১৬ ডিসেম্বর', '১৪ এপ্রিল', 'A', 'ইতিহাস', '১৯৫২ সালের ২১ ফেব্রুয়ারি ভাষা আন্দোলনে শহিদদের স্মরণে এই দিন পালিত হয়।'),
('বাংলাদেশের প্রথম রাষ্ট্রপতি কে ছিলেন?', 'শেখ মুজিবুর রহমান', 'জিয়াউর রহমান', 'হুসেইন মুহাম্মদ এরশাদ', 'আবু সাঈদ চৌধুরী', 'A', 'ইতিহাস', 'বঙ্গবন্ধু শেখ মুজিবুর রহমান বাংলাদেশের প্রথম রাষ্ট্রপতি ছিলেন।'),
('পদ্মা সেতু কোন নদীর উপর?', 'পদ্মা', 'মেঘনা', 'যমুনা', 'ব্রহ্মপুত্র', 'A', 'ভূগোল', 'পদ্মা সেতু বাংলাদেশের সবচেয়ে বড় সেতু এবং এটি পদ্মা নদীর উপর নির্মিত।'),
('বাংলাদেশের সবচেয়ে বড় জেলা কোনটি?', 'রাঙ্গামাটি', 'চট্টগ্রাম', 'সিলেট', 'খুলনা', 'A', 'ভূগোল', 'রাঙ্গামাটি আয়তনের দিক থেকে বাংলাদেশের সবচেয়ে বড় জেলা।'),
('সুন্দরবন কোন বিভাগে অবস্থিত?', 'খুলনা', 'বরিশাল', 'ঢাকা', 'চট্টগ্রাম', 'A', 'ভূগোল', 'সুন্দরবন পৃথিবীর সবচেয়ে বড় ম্যানগ্রোভ বন এবং ইউনেস্কো ওয়ার্ল্ড হেরিটেজ সাইট।'),
('বাংলাদেশের মুদ্রার নাম কী?', 'টাকা', 'রুপি', 'ডলার', 'ইয়েন', 'A', 'সাধারণ জ্ঞান', 'বাংলাদেশের অফিসিয়াল মুদ্রার নাম বাংলাদেশি টাকা (BDT)।'),
('কোন মাসে বাংলা নববর্ষ পালিত হয়?', 'বৈশাখ', 'জ্যৈষ্ঠ', 'আষাঢ়', 'শ্রাবণ', 'A', 'সংস্কৃতি', '১৪ এপ্রিল বাংলা নববর্ষ বা পহেলা বৈশাখ পালিত হয়।'),
('রবীন্দ্রনাথ ঠাকুর কোন পুরস্কার পেয়েছিলেন?', 'নোবেল', 'পুলিৎজার', 'বুকার', 'অস্কার', 'A', 'সাহিত্য', '১৯১৩ সালে গীতাঞ্জলির জন্য রবীন্দ্রনাথ ঠাকুর নোবেল পুরস্কার পান।'),
('কাজী নজরুল ইসলামকে কী বলা হয়?', 'বিদ্রোহী কবি', 'বিশ্বকবি', 'জাতীয় কবি', 'আধুনিক কবি', 'A', 'সাহিত্য', 'কাজী নজরুল ইসলামকে বিদ্রোহী কবি বলা হয়। তিনি বাংলাদেশের জাতীয় কবি।'),
('ফুটবল খেলায় একটি দলে কয়জন খেলোয়াড় থাকে?', '১১', '৯', '৭', '১৩', 'A', 'খেলাধুলা', 'ফুটবলে প্রতি দলে ১১ জন খেলোয়াড় মাঠে নামে।'),
('ক্রিকেটে এক ওভারে কয়টি বল থাকে?', '৬', '৫', '৪', '৮', 'A', 'খেলাধুলা', 'ক্রিকেটে একটি ওভারে সাধারণত ৬টি বৈধ বল থাকে।'),
('অলিম্পিক গেমস কত বছর পর পর হয়?', '৪', '২', '৩', '৫', 'A', 'খেলাধুলা', 'গ্রীষ্মকালীন অলিম্পিক প্রতি ৪ বছর পর পর অনুষ্ঠিত হয়।'),
('পৃথিবীর সবচেয়ে বড় মহাসাগর কোনটি?', 'প্রশান্ত', 'আটলান্টিক', 'ভারতীয়', 'উত্তর মহাসাগর', 'A', 'ভূগোল', 'প্রশান্ত মহাসাগর পৃথিবীর সবচেয়ে বড় এবং গভীর মহাসাগর।'),
('মানুষের শরীরে কয়টি হাড় আছে?', '২০৬', '২০০', '২১০', '১৮০', 'A', 'বিজ্ঞান', 'প্রাপ্তবয়স্ক মানুষের শরীরে সাধারণত ২০৬টি হাড় থাকে।'),
('সূর্য থেকে পৃথিবীর আলো কত সময় নেয়?', '৮ মিনিট', '৫ মিনিট', '১০ মিনিট', '১৫ মিনিট', 'A', 'বিজ্ঞান', 'সূর্যের আলো পৃথিবীতে পৌঁছাতে প্রায় ৮ মিনিট ২০ সেকেন্ড সময় লাগে।'),
('পানি কোন তাপমাত্রায় বরফে পরিণত হয়?', '০° সেলসিয়াস', '১০০° সেলসিয়াস', '৫০° সেলসিয়াস', '-১০° সেলসিয়াস', 'A', 'বিজ্ঞান', 'স্ট্যান্ডার্ড চাপে পানি ০° সেলসিয়াস তাপমাত্রায় বরফে পরিণত হয়।'),
('বাংলাদেশের জাতীয় সংগীত কে লিখেছেন?', 'রবীন্দ্রনাথ ঠাকুর', 'কাজী নজরুল ইসলাম', 'ধীরেন্দ্রনাথ দত্ত', 'জসীমউদ্দীন', 'A', 'সংস্কৃতি', 'আমার সোনার বাংলা গানটি রবীন্দ্রনাথ ঠাকুর রচনা করেছেন।'),
('ইউনেস্কো কোন সংস্থার অংশ?', 'জাতিসংঘ', 'বিশ্বব্যাংক', 'নাটো', 'ওপেক', 'A', 'আন্তর্জাতিক', 'ইউনেস্কো জাতিসংঘের শিক্ষা, বিজ্ঞান ও সংস্কৃতি বিষয়ক সংস্থা।'),
('কম্পিউটারের মস্তিষ্ক বলা হয় কোনটিকে?', 'CPU', 'RAM', 'Hard Disk', 'Monitor', 'A', 'প্রযুক্তি', 'CPU বা Central Processing Unit কম্পিউটারের প্রধান প্রসেসিং ইউনিট।'),
('ইন্টারনেটের পুরো নাম কী?', 'International Network', 'Internal Network', 'Interconnected Network', 'Information Network', 'A', 'প্রযুক্তি', 'Internet শব্দটি Interconnected Network থেকে এসেছে।'),
('বাংলাদেশের সবচেয়ে লম্বা নদী কোনটি?', 'ব্রহ্মপুত্র', 'পদ্মা', 'মেঘনা', 'যমুনা', 'A', 'ভূগোল', 'ব্রহ্মপুত্র (যমুনাসহ) বাংলাদেশের দীর্ঘতম নদী ব্যবস্থা।'),
('চাঁদে প্রথম পা রাখেন কে?', 'নিল আর্মস্ট্রং', 'ইউরি গ্যাগারিন', 'বাজ অলড্রিন', 'জন গ্লেন', 'A', 'বিজ্ঞান', '১৯৬৯ সালে নিল আর্মস্ট্রং চাঁদে প্রথম পা রাখেন।'),
('পৃথিবীর সবচেয়ে উঁচু পর্বত কোনটি?', 'এভারেস্ট', 'কে২', 'কাঞ্চনজঙ্ঘা', 'মাকালু', 'A', 'ভূগোল', 'মাউন্ট এভারেস্ট পৃথিবীর সর্বোচ্চ পর্বতচূড়া (৮৮৪৮ মিটার)।'),
('বাংলাদেশ কবে জাতিসংঘের সদস্য হয়?', '১৯৭৪', '১৯৭১', '১৯৭২', '১৯৭৫', 'A', 'ইতিহাস', '১৯৭৪ সালের ১৭ সেপ্টেম্বর বাংলাদেশ জাতিসংঘের সদস্যপদ লাভ করে।'),
('হাতির দাঁত কী দিয়ে তৈরি?', 'আইভরি', 'হাড়', 'কার্টেজ', 'কেরাটিন', 'A', 'বিজ্ঞান', 'হাতির দাঁত আইভরি দিয়ে তৈরি, যা দামি এবং সংরক্ষিত।'),
('রক্তের লাল রঙের জন্য দায়ী কী?', 'হিমোগ্লোবিন', 'প্লাজমা', 'হোয়াইট সেল', 'প্লেটলেট', 'A', 'বিজ্ঞান', 'হিমোগ্লোবিন আয়রনযুক্ত প্রোটিন যা রক্তকে লাল করে।'),
('বাংলাদেশের জাতীয় ফল কোনটি?', 'কাঁঠাল', 'আম', 'কলা', 'লিচু', 'A', 'সাধারণ জ্ঞান', 'কাঁঠাল বাংলাদেশের জাতীয় ফল।'),
('কোন গ্যাসকে হাসির গ্যাস বলা হয়?', 'নাইট্রাস অক্সাইড', 'কার্বন ডাই অক্সাইড', 'অক্সিজেন', 'নাইট্রোজেন', 'A', 'বিজ্ঞান', 'নাইট্রাস অক্সাইডকে হাসির গ্যাস বলা হয়।'),
('পৃথিবীর সবচেয়ে বড় মরুভূমি কোনটি?', 'সাহারা', 'গোবি', 'থর', 'আটাগামা', 'A', 'ভূগোল', 'সাহারা মরুভূমি আফ্রিকায় অবস্থিত এবং পৃথিবীর সবচেয়ে বড় উষ্ণ মরুভূমি।'),
('বাংলাদেশের প্রথম নোবেল বিজয়ী কে?', 'ড. মুহাম্মদ ইউনূস', 'রবীন্দ্রনাথ ঠাকুর', 'অমর্ত্য সেন', 'মালালা ইউসুফজাই', 'A', 'সাধারণ জ্ঞান', 'ড. মুহাম্মদ ইউনূস ২০০৬ সালে শান্তিতে নোবেল পুরস্কার পান।'),
('কম্পিউটারে ১ বাইটে কয়টি বিট থাকে?', '৮', '১৬', '৪', '৩২', 'A', 'প্রযুক্তি', '১ বাইট = ৮ বিট।'),
('বাংলাদেশের জাতীয় খেলা কোনটি?', 'কাবাডি', 'ফুটবল', 'ক্রিকেট', 'হকি', 'A', 'খেলাধুলা', 'কাবাডি বাংলাদেশের জাতীয় খেলা।'),
('পানির রাসায়নিক সংকেত কী?', 'H2O', 'CO2', 'O2', 'NaCl', 'A', 'বিজ্ঞান', 'পানির রাসায়নিক সংকেত H₂O।'),
('সূর্য একটি কী?', 'তারা', 'গ্রহ', 'উপগ্রহ', 'ধূমকেতু', 'A', 'বিজ্ঞান', 'সূর্য একটি মাঝারি আকারের তারা।'),
('বাংলাদেশের সবচেয়ে বড় সমুদ্রবন্দর কোনটি?', 'চট্টগ্রাম', 'মংলা', 'পায়রা', 'কক্সবাজার', 'A', 'ভূগোল', 'চট্টগ্রাম বন্দর বাংলাদেশের প্রধান ও সবচেয়ে বড় সমুদ্রবন্দর।'),
('কোন ভিটামিন সূর্যালোক থেকে পাওয়া যায়?', 'ভিটামিন ডি', 'ভিটামিন সি', 'ভিটামিন এ', 'ভিটামিন বি', 'A', 'বিজ্ঞান', 'সূর্যের আলো থেকে শরীর ভিটামিন ডি তৈরি করে।'),
('বাংলাদেশের মুদ্রাস্ফীতি নিয়ন্ত্রণ করে কোন সংস্থা?', 'বাংলাদেশ ব্যাংক', 'অর্থ মন্ত্রণালয়', 'এনবিআর', 'পরিকল্পনা কমিশন', 'A', 'অর্থনীতি', 'বাংলাদেশ ব্যাংক দেশের কেন্দ্রীয় ব্যাংক এবং মুদ্রানীতি নিয়ন্ত্রণ করে।'),
('পৃথিবীর সবচেয়ে বেশি কথা বলা ভাষা কোনটি?', 'ইংরেজি', 'ম্যান্ডারিন', 'স্প্যানিশ', 'হিন্দি', 'B', 'সাধারণ জ্ঞান', 'ম্যান্ডারিন চাইনিজ পৃথিবীর সবচেয়ে বেশি মানুষের মাতৃভাষা।'),
('বাংলাদেশের জাতীয় পতাকার রং কী কী?', 'সবুজ ও লাল', 'সবুজ ও সাদা', 'লাল ও সাদা', 'নীল ও লাল', 'A', 'সাধারণ জ্ঞান', 'বাংলাদেশের জাতীয় পতাকায় সবুজ ক্ষেত্রের উপর লাল বৃত্ত রয়েছে।'),
('কম্পিউটার ভাইরাস কী?', 'প্রোগ্রাম', 'হার্ডওয়্যার', 'অপারেটিং সিস্টেম', 'অ্যাপ্লিকেশন', 'A', 'প্রযুক্তি', 'কম্পিউটার ভাইরাস হলো ক্ষতিকর সফটওয়্যার প্রোগ্রাম।'),
('বাংলাদেশের সবচেয়ে বড় বিশ্ববিদ্যালয় কোনটি?', 'ঢাকা বিশ্ববিদ্যালয়', 'রাজশাহী বিশ্ববিদ্যালয়', 'চট্টগ্রাম বিশ্ববিদ্যালয়', 'জাহাঙ্গীরনগর বিশ্ববিদ্যালয়', 'A', 'শিক্ষা', 'ঢাকা বিশ্ববিদ্যালয় দেশের প্রাচীনতম ও অন্যতম বৃহত্তম বিশ্ববিদ্যালয়।'),
('পৃথিবীর সবচেয়ে বড় মহাদেশ কোনটি?', 'এশিয়া', 'আফ্রিকা', 'ইউরোপ', 'উত্তর আমেরিকা', 'A', 'ভূগোল', 'এশিয়া পৃথিবীর সবচেয়ে বড় মহাদেশ।'),
('রক্তদানের সময় কোন গ্রুপ সার্বজনীন দাতা?', 'O-', 'A+', 'B+', 'AB+', 'A', 'বিজ্ঞান', 'O নেগেটিভ রক্তগ্রুপকে সার্বজনীন দাতা বলা হয়।'),
('বাংলাদেশের প্রথম প্রধানমন্ত্রী কে ছিলেন?', 'তাজউদ্দীন আহমদ', 'শেখ মুজিবুর রহমান', 'মওলানা ভাসানী', 'হোসেন শহীদ সোহরাওয়ার্দী', 'A', 'ইতিহাস', 'তাজউদ্দীন আহমদ বাংলাদেশের প্রথম প্রধানমন্ত্রী ছিলেন।');

-- More quizzes can be added later from Admin
