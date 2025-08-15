import { initSupabase, supabase, getUser } from './supabase.js';

export function mountSosButton(selector = '#sosBtn') {
    const btn = document.querySelector(selector);
    if (!btn) return;
    btn.addEventListener('click', async () => {
        try {
            await sendSOS();
        } catch (e) {
            alert(e.message || 'Failed to send SOS');
        }
    });
}

export async function sendSOS() {
    initSupabase();
    const user = await getUser();
    const loc = await getLocation();
    const payload = {
        user_id: user?.id || null,
        lat: loc?.coords?.latitude || null,
        lng: loc?.coords?.longitude || null,
        accuracy_m: loc?.coords?.accuracy || null
    };
    const { data, error } = await supabase.from('sos_events').insert(payload).select('*').single();
    if (error) throw error;
    // Notify emergency contacts via database function or webhook
    // Optionally anchor the event hash on-chain (if enabled)
    if (window.SAFEVOICE_CONFIG?.blockchain?.enabled) {
        try { await anchorSosHash(JSON.stringify(data)); } catch {}
    }
    alert('SOS sent. Help is on the way.');
    return data;
}

function getLocation() {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) return reject(new Error('Location not supported'));
        navigator.geolocation.getCurrentPosition(resolve, (err) => reject(err), {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 5000
        });
    });
}

async function anchorSosHash(data) {
    // Placeholder for optional blockchain integration.
    // You could compute a keccak256 hash and POST to a minimal relay service.
    console.info('Blockchain anchoring not implemented in frontend.');
}


