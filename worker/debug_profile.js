
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://zvcqgvbmrumithlyqmyi.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp2Y3FndmJtcnVtaXRobHlxbXlpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcxMDI0ODUsImV4cCI6MjA5MjY3ODQ4NX0.dVDbx-UxWVqGe4o9-kXDfph2-zZbO1tBiXHag-Ed57w';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function check() {
    const { data, error } = await supabase.from('profile').select('gmail_enabled, gmail_email, gmail_refresh_token').single();
    if (error) console.error(error);
    else {
        console.log('Gmail Enabled:', data.gmail_enabled);
        console.log('Gmail Email:', data.gmail_email);
        console.log('Has Refresh Token:', !!data.gmail_refresh_token);
        if (data.gmail_refresh_token) {
             console.log('Token starts with:', data.gmail_refresh_token.substring(0, 5));
        }
    }
}

check();
