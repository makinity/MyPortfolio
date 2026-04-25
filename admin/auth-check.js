// auth-check.js
// This script runs on every admin page load to ensure a valid Supabase session.
// If no session is found, the user is redirected back to the login page.

document.addEventListener('DOMContentLoaded', async () => {
    if (!window.supabase) {
        console.error('Supabase client not loaded');
        return;
    }
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
        // No active session – redirect to login page
        window.location.href = 'login.html';
    }
});
