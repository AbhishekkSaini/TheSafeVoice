// Supabase client initializer
// Requires `Safevoice/js/config.js` to be present at runtime (copy from config.example.js)

export let supabase = null;
export let supabaseUrl = "";

function ensureConfig() {
    if (!window.SAFEVOICE_CONFIG || !window.SAFEVOICE_CONFIG.supabaseUrl || !window.SAFEVOICE_CONFIG.supabaseAnonKey) {
        console.error("TheSafeVoice: Missing Supabase config. Copy js/config.example.js to js/config.js and fill in your keys.");
        return false;
    }
    return true;
}

export function initSupabase() {
    if (!ensureConfig()) return null;
    if (supabase) return supabase;
    supabaseUrl = window.SAFEVOICE_CONFIG.supabaseUrl;
    const anonKey = window.SAFEVOICE_CONFIG.supabaseAnonKey;

    if (!window.supabase) {
        console.error("TheSafeVoice: Supabase JS not loaded. Include https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2 in a script tag.");
        return null;
    }
    supabase = window.supabase.createClient(supabaseUrl, anonKey, {
        auth: {
            persistSession: true,
            detectSessionInUrl: true,
            autoRefreshToken: true
        },
        global: {
            headers: {
                "x-client-info": "thesafevoice-web"
            }
        }
    });
    return supabase;
}

export async function getSession() {
    if (!supabase) initSupabase();
    const { data } = await supabase.auth.getSession();
    return data.session || null;
}

export async function getUser() {
    if (!supabase) initSupabase();
    const { data } = await supabase.auth.getUser();
    return data.user || null;
}

export async function requireAuth(redirectTo = 'login.html') {
    const session = await getSession();
    if (!session) {
        window.location.href = redirectTo;
        return null;
    }
    return session;
}

export async function ensureProfile(userId) {
    if (!supabase) initSupabase();
    if (!userId) return null;
    const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single();
    if (error && error.code !== 'PGRST116') {
        console.warn('Failed to fetch profile', error);
        return null;
    }
    if (!data) {
        const { data: insertData, error: insertError } = await supabase.from('profiles').insert({ id: userId }).select().single();
        if (insertError) {
            console.warn('Failed to create profile', insertError);
            return null;
        }
        return insertData;
    }
    return data;
}


