// auth-check.js
// This script runs on every admin page load to ensure a valid Supabase session.
// If no session is found, the user is redirected back to the login page.

(async function protectPage() {
    // We use a self-invoking async function to run immediately
    const checkAuth = async () => {
        if (!window.supabase) {
            // Wait a bit for supabase to initialize if needed
            await new Promise(resolve => setTimeout(resolve, 50));
            if (!window.supabase) {
                console.error('Supabase client not loaded');
                return;
            }
        }

        const { data: { session } } = await window.supabase.auth.getSession();
        
        if (!session) {
            // No active session – redirect to login page immediately
            // We use replace to prevent the user from going back to the protected page
            window.location.replace('login/');
        } else {
            // Valid session – show the page content
            document.addEventListener('DOMContentLoaded', () => {
                document.body.classList.remove('auth-hidden');
            });
            // If DOM is already loaded
            if (document.readyState === 'interactive' || document.readyState === 'complete') {
                document.body.classList.remove('auth-hidden');
            }
        }
    };

    checkAuth();
})();
