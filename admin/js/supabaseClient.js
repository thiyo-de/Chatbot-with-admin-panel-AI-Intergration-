// Initialize Supabase Client
// Ensure this script is loaded AFTER config.js and the Supabase CDN script

if (typeof supabase === 'undefined') {
    console.error('Supabase JS library not loaded. Check your script tags.');
} else if (!SUPABASE_URL || !SUPABASE_ANON_KEY || SUPABASE_URL.startsWith('INSERT')) {
    console.error('Supabase credentials not set in config.js');
} else {
    // Global supabase client instance
    window.supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}
