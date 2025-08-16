import { initSupabase, supabase, getUser, ensureProfile } from './supabase.js';

const CATEGORY_KEYS = [
    { key: 'safety_tips', label: 'Safety Tips' },
    { key: 'legal_advice', label: 'Legal Advice' },
    { key: 'emergency_help', label: 'SOS & Immediate Help' },
    { key: 'survivor_stories', label: 'Survivor Stories' }
];

function q(sel, parent = document) { return parent.querySelector(sel); }
function qa(sel, parent = document) { return Array.from(parent.querySelectorAll(sel)); }

export async function mountForum() {
    initSupabase();
    const user = await getUser();
    if (user) await ensureProfile(user.id);
    await renderCategories();
    await renderFeed();
    mountComposer(user);
    mountFilters();
}

function categoryBadge(catKey) {
    const found = CATEGORY_KEYS.find(c => c.key === catKey);
    return `<span class="px-2 py-1 text-xs rounded bg-orange-100 text-orange-700">${found?.label || 'General'}</span>`;
}

async function renderCategories() {
    const container = q('#forum-categories');
    if (!container) return;
    container.innerHTML = CATEGORY_KEYS.map(c => `
        <button class="group bg-gradient-to-br from-orange-50 to-red-50 p-6 rounded-2xl border border-orange-100 hover:shadow-xl transition-all w-full text-left" data-cat="${c.key}">
            <div class="flex items-center justify-between">
                <div>
                    <h3 class="text-lg font-semibold text-gray-800">${c.label}</h3>
                    <p class="text-sm text-gray-600 mt-1">Discuss ${c.label.toLowerCase()} with the community</p>
                </div>
                <i data-lucide="chevron-right" class="w-5 h-5 text-orange-600"></i>
            </div>
        </button>
    `).join('');

    qa('[data-cat]').forEach(btn => btn.addEventListener('click', () => {
        const cat = btn.getAttribute('data-cat');
        const select = q('#filter-category');
        if (select) {
            select.value = cat;
            select.dispatchEvent(new Event('change'));
        }
    }));
    window.lucide && window.lucide.createIcons();
}

function mountFilters() {
    const select = q('#filter-category');
    if (!select) return;
    select.innerHTML = `<option value="">All Categories</option>` + CATEGORY_KEYS.map(c => `<option value="${c.key}">${c.label}</option>`).join('');
    select.addEventListener('change', renderFeed);
    const qInput = q('#filter-q');
    if (qInput) qInput.addEventListener('input', debounce(renderFeed, 250));
}

function mountComposer(user) {
    const form = q('#post-composer');
    if (!form) return;
    const anonToggle = q('#composer-anon');
    const catSelect = q('#composer-category');
    if (catSelect) catSelect.innerHTML = CATEGORY_KEYS.map(c => `<option value="${c.key}">${c.label}</option>`).join('');
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const title = q('#composer-title')?.value?.trim();
        const body = q('#composer-body')?.value?.trim();
        const category = catSelect?.value || null;
        const isAnonymous = !!anonToggle?.checked;
        if (!title || !body) return alert('Please provide a title and content');

        const sessionUser = await getUser();
        const userId = sessionUser?.id || null;

        const { data, error } = await supabase.from('posts').insert({
            title,
            body,
            category,
            is_anonymous: isAnonymous,
            author_id: userId
        }).select('id').single();
        if (error) return alert(error.message);
        form.reset();
        await renderFeed();
    });
}

async function renderFeed() {
    const list = q('#forum-feed');
    if (!list) return;
    const select = q('#filter-category');
    const category = select?.value || '';
    const qInput = q('#filter-q');
    const qtext = qInput?.value?.trim() || '';

    let query = supabase.from('posts_view').select('*').order('created_at', { ascending: false }).limit(50);
    if (category) query = query.eq('category', category);
    if (qtext) query = query.ilike('title', `%${qtext}%`);
    let { data, error } = await query;
    if (error) {
        const msg = (error.message || '').toLowerCase();
        if (msg.includes('posts_view') || msg.includes('schema')) {
            // Fallback when the view or schema cache is not ready – use posts table
            let q2 = supabase.from('posts').select('*').order('created_at', { ascending: false }).limit(50);
            if (category) q2 = q2.eq('category', category);
            if (qtext) q2 = q2.ilike('title', `%${qtext}%`);
            const { data: d2, error: e2 } = await q2;
            error = e2;
            data = (d2 || []).map(p => ({ ...p, author_display_name: '', comments_count: 0 }));
        }
    }
    if (error) {
        list.innerHTML = `<div class="text-red-600">${error.message}</div>`;
        return;
    }

    list.innerHTML = (data || []).map(post => renderPostItem(post)).join('') || `<div class="text-gray-500">No posts yet.</div>`;
    qa('[data-action="open-thread"]').forEach(btn => btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        window.location.href = `thread.html?id=${encodeURIComponent(id)}`;
    }));
    window.lucide && window.lucide.createIcons();
}

function renderPostItem(p) {
    const created = new Date(p.created_at);
    const authorLabel = p.is_anonymous ? 'Anonymous' : (p.author_display_name || 'Member');
    return `
    <article class="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 mb-4 hover:shadow-xl smooth-transition">
        <div class="flex items-center justify-between mb-2">
            ${categoryBadge(p.category)}
            <span class="text-sm text-gray-500">${created.toLocaleString()}</span>
        </div>
        <h3 class="text-xl font-bold text-gray-800 mb-2">${escapeHtml(p.title)}</h3>
        <p class="text-gray-700 mb-4">${escapeHtml(p.body).slice(0, 240)}${p.body.length > 240 ? '…' : ''}</p>
        <div class="flex items-center justify-between">
            <div class="text-sm text-gray-600">by <span class="font-medium">${escapeHtml(authorLabel)}</span></div>
            <div class="flex items-center space-x-3">
                <button class="px-3 py-1 rounded bg-gray-100 text-gray-700 hover:bg-gray-200" data-action="open-thread" data-id="${p.id}">Open</button>
                <div class="flex items-center text-gray-500">
                    <i data-lucide="message-square" class="w-4 h-4 mr-1"></i>${p.comments_count || 0}
                </div>
                <div class="flex items-center text-gray-500">
                    <i data-lucide="arrow-up" class="w-4 h-4 mr-1"></i>${p.upvotes || 0}
                </div>
            </div>
        </div>
    </article>`;
}

function escapeHtml(s = '') {
    return s.replace(/[&<>"]+/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

function debounce(fn, wait) {
    let t = null;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn.apply(null, args), wait); };
}


