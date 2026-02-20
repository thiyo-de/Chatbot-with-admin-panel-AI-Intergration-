// Auth Logic
document.addEventListener('DOMContentLoaded', async () => {

    // 1. Handle Login Form
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            const alertBox = document.getElementById('alert-box');
            const submitBtn = loginForm.querySelector('button');

            try {
                // Reset UI
                alertBox.classList.add('hidden');
                submitBtn.disabled = true;
                submitBtn.textContent = 'Signing in...';

                // Attempt Sign In
                const { data, error } = await window.supabaseClient.auth.signInWithPassword({
                    email,
                    password
                });

                if (error) throw error;

                // Success
                window.location.href = 'admin.html';

            } catch (err) {
                alertBox.textContent = err.message || 'Login failed';
                alertBox.classList.remove('hidden');
                submitBtn.disabled = false;
                submitBtn.textContent = 'Sign In';
            }
        });
    }

    // 2. Check Session (for protected pages)
    // If we are NOT on index.html, we must be logged in
    const path = window.location.pathname;
    const isLoginPage = path.endsWith('index.html') || path.endsWith('/admin/') || path.endsWith('/admin');

    // Only run session check if NOT on login page
    if (!isLoginPage) {
        const { data: { session } } = await window.supabaseClient.auth.getSession();
        if (!session) {
            // No session, redirect to login
            window.location.href = 'index.html';
        }
    }

    // 3. Logout Helper
    window.logout = async () => {
        await window.supabaseClient.auth.signOut();
        window.location.href = 'index.html';
    };
});
