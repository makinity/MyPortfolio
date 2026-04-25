const SUPABASE_URL = 'https://zvcqgvbmrumithlyqmyi.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp2Y3FndmJtcnVtaXRobHlxbXlpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcxMDI0ODUsImV4cCI6MjA5MjY3ODQ4NX0.dVDbx-UxWVqGe4o9-kXDfph2-zZbO1tBiXHag-Ed57w';
// Initialize Supabase client and expose globally
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
window.supabase = supabaseClient;
