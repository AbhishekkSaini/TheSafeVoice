import { initSupabase, supabase, ensureProfile, getUser } from './supabase.js';

export function mountAuthUiHooks() {
    initSupabase();

    const signupForm = document.getElementById('signupForm');
    const loginForm = document.getElementById('loginForm');
    const logoutBtn = document.getElementById('logoutBtn');
    const loginGoogle = document.getElementById('loginGoogle');

    const loginFacebook = document.getElementById('loginFacebook');
    const loginTwitter = document.getElementById('loginTwitter');

    // Utility: show logout button only when logged in
    async function updateLogoutVisibility() {
        try {
            const user = await getUser();
            const btn = document.getElementById('logoutBtn');
            if (btn) {
                if (user) btn.classList.remove('hidden'); else btn.classList.add('hidden');
            }
        } catch {}
    }

    updateLogoutVisibility();
    try { supabase.auth.onAuthStateChange(() => updateLogoutVisibility()); } catch {}

    if (signupForm) {
        signupForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('email')?.value?.trim();
            const password = document.getElementById('password')?.value;
            const firstName = document.getElementById('firstName')?.value?.trim();
            const lastName = document.getElementById('lastName')?.value?.trim();
            // in this we have only 10 digit phone number
            const phoneInputEl = document.getElementById('phone10') || document.getElementById('phone');
            const phone10 = phoneInputEl ? String(phoneInputEl.value || '').trim() : '';

            if (!email || !password) return alert('Email and password required');
            if (!phone10) return alert('Phone number required');

            // India-only (+91) phone normalization and validation
            const normalizePhoneIndia = (input) => {
                const digits = (input || '').replace(/\D/g, '');
                if (digits.length === 10) return '+91' + digits;
                return null;
            };
            const normalizedPhone = normalizePhoneIndia(phone10);
            if (!normalizedPhone) return alert('Enter a valid Indian mobile number (10 digits or +91XXXXXXXXXX).');
            // Indian mobile numbers start with 6-9
            if (!/^\+916|\+917|\+918|\+919/.test(normalizedPhone.slice(0,4)) && !/^\+91[6-9][0-9]{9}$/.test(normalizedPhone)) {
                if (!/^\+91[6-9][0-9]{9}$/.test(normalizedPhone)) return alert('Indian mobile must start with 6-9 and be 10 digits (e.g., +919876543210)');
            }
            const submitBtn = signupForm.querySelector('button[type="submit"]');
            const original = submitBtn.textContent;
            submitBtn.textContent = 'Creating account...';
            submitBtn.disabled = true;

            // Preflight duplication check via RPC (blocks before sending email)
            try {
                const { data: ok, error: availErr } = await supabase.rpc('email_or_phone_available', { p_email: emailCi, p_phone: normalizedPhone });
                if (availErr) console.warn('availability check error', availErr);
                if (ok === false) {
                    alert('Account already exists with this email or mobile number');
                    submitBtn.textContent = original;
                    submitBtn.disabled = false;
                    return;
                }
            } catch (e) {
                console.warn('Availability RPC failed; proceeding with caution');
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
                    // Enforce uniqueness at backend immediately; if it throws 23505 we show duplicate message
                    const userId = signData?.user?.id || data?.user?.id;
                    if (userId) {
                        const { error: rpcErr } = await supabase.rpc('upsert_profile_secure', {
                            p_id: userId,
                            p_email: emailCi,
                            p_phone: normalizedPhone,
                            p_display_name: displayName
                        });
                        if (rpcErr) throw rpcErr;
                    }
                } catch (rpcErr) {
                    alert(rpcErr.message || 'Account already exists with this email or mobile number');
                    submitBtn.textContent = original;
                    submitBtn.disabled = false;
                    return;
                }
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
    // Use robust relative URL so it works on GitHub Pages repo subpaths and locally
    const redirectTo = new URL('login.html', window.location.href).href;
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


