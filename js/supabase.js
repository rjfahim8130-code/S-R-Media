// js/supabase.js
// NnowQuiz - Supabase Configuration (New Project)

const SUPABASE_URL = 'https://rejqktrpkyycjjoeviqw.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJlanFrdHJwa3l5Y2pqb2V2aXF3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMyMzk1NzcsImV4cCI6MjEwODgxNTU3N30.ISEz7r3crnLl73UUBSVYrgPoIYzCVfb24LVqWOQuM-U';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ======================
// Auth Helper Functions
// ======================

async function getCurrentUser() {
  try {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return null;
    return user;
  } catch (e) {
    console.error('getCurrentUser error:', e);
    return null;
  }
}

async function getProfile() {
  const user = await getCurrentUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (error) {
    console.error('Profile fetch error:', error);
    return null;
  }
  return data;
}

async function isAdmin() {
  const profile = await getProfile();
  return profile && profile.is_admin === true;
}

async function requireAuth() {
  const user = await getCurrentUser();
  if (!user) {
    window.location.href = 'login.html';
    return null;
  }
  return user;
}

async function requireAdmin() {
  const user = await requireAuth();
  if (!user) return null;

  const admin = await isAdmin();
  if (!admin) {
    window.location.href = 'home.html';
    return null;
  }
  return user;
}

async function signOut() {
  await supabase.auth.signOut();
  window.location.href = 'login.html';
}

// ======================
// Utility Functions
// ======================

function showToast(message, type = 'success') {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerText = message;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('show');
  }, 10);

  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

function formatNumber(num) {
  return new Intl.NumberFormat('en-BD').format(num);
}

function timeAgo(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now - date) / 1000);

  if (seconds < 60) return 'এইমাত্র';
  if (seconds < 3600) return Math.floor(seconds / 60) + ' মিনিট আগে';
  if (seconds < 86400) return Math.floor(seconds / 3600) + ' ঘণ্টা আগে';
  return Math.floor(seconds / 86400) + ' দিন আগে';
}
