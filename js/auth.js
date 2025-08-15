import { initSupabase, supabase, ensureProfile } from './supabase.js';

export function mountAuthUiHooks() {
    initSupabase();

    const signupForm = document.getElementById('signupForm');
    const loginForm = document.getElementById('loginForm');
    const logoutBtn = document.getElementById('logoutBtn');
    const loginGoogle = document.getElementById('loginGoogle');
    const loginFacebook = document.getElementById('loginFacebook');
    const loginTwitter = document.getElementById('loginTwitter');

    if (signupForm) {
        signupForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('email')?.value?.trim();
            const password = document.getElementById('password')?.value;
            const firstName = document.getElementById('firstName')?.value?.trim();
            const lastName = document.getElementById('lastName')?.value?.trim();
            const phone = document.getElementById('phone')?.value?.trim();

            if (!email || !password) return alert('Email and password required');
            if (!phone) return alert('Phone number required');

            // Simple E.164-ish phone validation
            const phoneOk = /^[+]?\d{8,15}$/.test((phone || '').replace(/\s|\-/g, ''));
            if (!phoneOk) return alert('Enter a valid phone number (digits, optional leading +).');
            const submitBtn = signupForm.querySelector('button[type="submit"]');
            const original = submitBtn.textContent;
            submitBtn.textContent = 'Creating account...';
            submitBtn.disabled = true;

            // Prevent duplicate phone before creating auth user (best effort)
            try {
                const { data: existingPhone } = await supabase
                    .from('profiles')
                    .select('id')
                    .eq('phone', phone)
                    .limit(1);
                if ((existingPhone || []).length > 0) {
                    alert('This phone number is already registered. Please log in or use a different number.');
                    submitBtn.textContent = original;
                    submitBtn.disabled = false;
                    return;
                }
            } catch (e) {
                // If profiles table is not yet created, skip the pre-check and continue signup
                console.warn('Skipping phone pre-check (profiles not ready yet).');
            }

            const { data, error } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    // Use a robust relative redirect that works on GitHub Pages (repo subpath) and locally
                    emailRedirectTo: new URL('login.html', window.location.href).href,
                    data: { first_name: firstName, last_name: lastName }
                }
            });
            if (error) {
                alert(error.message);
            } else {
                alert('Check your email to verify your account.');
                // Save intended profile data for after first login (when session exists)
                try {
                    const displayName = [firstName, lastName].filter(Boolean).join(' ').trim();
                    const normalizedPhone = (phone || '').replace(/\s|\-/g, '');
                    localStorage.setItem('sv_pending_profile', JSON.stringify({ displayName, phone: normalizedPhone }));
                } catch {}
                window.location.href = 'login.html';
            }
            submitBtn.textContent = original;
            submitBtn.disabled = false;
        });
    }

    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('email')?.value?.trim();
            const password = document.getElementById('password')?.value;
            if (!email || !password) return alert('Email and password required');
            const submitBtn = loginForm.querySelector('button[type="submit"]');
            const original = submitBtn.textContent;
            submitBtn.textContent = 'Signing in...';
            submitBtn.disabled = true;
            const { data, error } = await supabase.auth.signInWithPassword({ email, password });
            if (error) {
                alert(error.message);
            } else {
                await ensureProfile(data.user.id);
                // Apply any pending profile data saved during sign up
                try {
                    const pending = JSON.parse(localStorage.getItem('sv_pending_profile') || 'null');
                    if (pending) {
                        await supabase.from('profiles').update({
                            display_name: pending.displayName || null,
                            phone: pending.phone || null
                        }).eq('id', data.user.id);
                        localStorage.removeItem('sv_pending_profile');
                    }
                } catch {}
                localStorage.setItem('isLoggedIn', 'true');
                window.location.href = 'forum.html';
            }
            submitBtn.textContent = original;
            submitBtn.disabled = false;
        });
    }

    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            await supabase.auth.signOut();
            localStorage.setItem('isLoggedIn', 'false');
            window.location.href = 'index.html';
        });
    }

    // OAuth providers
    const redirectTo = window.location.origin + '/Safevoice/login.html';
    async function signInWithProvider(provider) {
        try {
            const { error } = await supabase.auth.signInWithOAuth({ provider, options: { redirectTo } });
            if (error) alert(error.message);
        } catch (e) {
            alert(e.message || 'OAuth sign-in failed');
        }
    }
    if (loginGoogle) loginGoogle.addEventListener('click', () => signInWithProvider('google'));
    if (loginFacebook) loginFacebook.addEventListener('click', () => signInWithProvider('facebook'));
    if (loginTwitter) loginTwitter.addEventListener('click', () => signInWithProvider('twitter'));
}


