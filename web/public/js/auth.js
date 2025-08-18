import { initSupabase, supabase, ensureProfile, getUser } from './supabase.js';

export function mountAuthUiHooks() {
    initSupabase();

    // Handle OAuth errors returned in URL and clean up URL
    try {
        const rawHash = window.location.hash || "";
        const params = new URLSearchParams((rawHash.startsWith('#') ? rawHash.replace('#', '?') : rawHash) || window.location.search || "");
        const oauthError = params.get('error') || params.get('error_description');
        if (oauthError) {
            alert(decodeURIComponent(oauthError));
            // Remove tokens/error params from URL without reloading
            try { window.history.replaceState({}, document.title, window.location.pathname); } catch {}
        }
    } catch {}

    const signupForm = document.getElementById('signupForm');
    const loginForm = document.getElementById('loginForm');
    // Support multiple logout buttons across pages (desktop + mobile)
    const logoutBtns = document.querySelectorAll('[id="logoutBtn"], .logoutBtn');
    const loginBtns = document.querySelectorAll('#loginBtn, #mobileLoginBtn');
    const signupBtns = document.querySelectorAll('#signupBtn, #mobileSignupBtn');
    const messagesLinks = document.querySelectorAll('[id="messagesLink"], .messagesLink');

    // Optimistic first paint based on localStorage to avoid flicker after login
    try {
        const logged = localStorage.getItem('isLoggedIn') === 'true';
        const toggle = (el, hidden) => { if (!el) return; el.classList.toggle('hidden', !!hidden); };
        logoutBtns.forEach((el) => toggle(el, !logged));
        loginBtns.forEach((el) => toggle(el, logged));
        signupBtns.forEach((el) => toggle(el, logged));
        messagesLinks.forEach((el) => toggle(el, !logged));
    } catch {}
    const loginGoogle = document.getElementById('loginGoogle');

    const loginFacebook = document.getElementById('loginFacebook');
    const loginTwitter = document.getElementById('loginTwitter');
    // Optional alias id from user's snippet
    const twitterLoginBtn = document.getElementById('twitterLoginBtn');

    // Utility: show logout button only when logged in
    async function updateLogoutVisibility() {
        try {
            const user = await getUser();
            const showWhenLoggedIn = (el, show) => { if (!el) return; el.classList.toggle('hidden', !show); };
            const showWhenLoggedOut = (el, show) => { if (!el) return; el.classList.toggle('hidden', !show); };
            logoutBtns.forEach((btn) => {
                if (!btn) return;
                showWhenLoggedIn(btn, !!user);
            });
            loginBtns.forEach((btn) => showWhenLoggedOut(btn, !user));
            signupBtns.forEach((btn) => showWhenLoggedOut(btn, !user));
            messagesLinks.forEach((el) => showWhenLoggedIn(el, !!user));
        } catch {}
    }

    updateLogoutVisibility();
    try {
        supabase.auth.onAuthStateChange(async (event, session) => {
            updateLogoutVisibility();
            const path = window.location.pathname || '';
            const isAuthPage = /login\.html$|signup\.html$/i.test(path);
            const hasOAuthToken = /(access_token|code)=/i.test(window.location.hash || window.location.search);
            if (session) {
                try {
                    // Ensure profile exists for OAuth sign-ins as well
                    await ensureProfile(session.user?.id);
                } catch {}
                try { localStorage.setItem('isLoggedIn', 'true'); } catch {}
                if (isAuthPage || hasOAuthToken) {
                    window.location.href = 'forum.html';
                }
            }
        });
    } catch {}

    if (signupForm) {
        signupForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('email')?.value?.trim();
            const password = document.getElementById('password')?.value;
            const confirmPassword = document.getElementById('confirmPassword')?.value;
            const firstName = document.getElementById('firstName')?.value?.trim();
            const lastName = document.getElementById('lastName')?.value?.trim();
            const username = document.getElementById('username')?.value?.trim();
            // in this we have only 10 digit phone number
            const phoneInputEl = document.getElementById('phone10') || document.getElementById('phone');
            const phone10 = phoneInputEl ? String(phoneInputEl.value || '').trim() : '';

            if (!email || !password) return alert('Email and password required');
            if (!phone10) return alert('Phone number required');
            
            // Password confirmation validation
            if (password !== confirmPassword) {
                alert('❌ Passwords do not match! Please make sure both passwords are identical.');
                document.getElementById('confirmPassword').focus();
                return;
            }
            
            // Password strength validation
            if (password.length < 8) {
                alert('❌ Password must be at least 8 characters long.');
                document.getElementById('password').focus();
                return;
            }
            
            if (!/[A-Z]/.test(password)) {
                alert('❌ Password must contain at least one uppercase letter.');
                document.getElementById('password').focus();
                return;
            }
            
            if (!/\d/.test(password)) {
                alert('❌ Password must contain at least one number.');
                document.getElementById('password').focus();
                return;
            }

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
                const emailCi = (email || '').trim().toLowerCase();
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
                    const emailCi = (email || '').trim().toLowerCase();
                    const displayName = [firstName, lastName].filter(Boolean).join(' ').trim();
                    // Enforce uniqueness at backend immediately; if it throws 23505 we show duplicate message
                    const userId = data?.user?.id;
                    if (userId) {
                        const { error: rpcErr } = await supabase.rpc('upsert_profile_secure', {
                            p_id: userId,
                            p_email: emailCi,
                            p_phone: normalizedPhone,
                            p_display_name: displayName
                        });
                        if (rpcErr) throw rpcErr;
                        // set username if provided
                        if (username && username.length >= 3) {
                            await supabase.rpc('set_username', { p_username: username });
                        }
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

    if (logoutBtns && logoutBtns.length) {
        logoutBtns.forEach((btn) => btn.addEventListener('click', async () => {
            try { await supabase.auth.signOut(); } catch {}
            localStorage.setItem('isLoggedIn', 'false');
            window.location.href = 'index.html';
        }));
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
    if (twitterLoginBtn) twitterLoginBtn.addEventListener('click', () => signInWithProvider('twitter'));
}


