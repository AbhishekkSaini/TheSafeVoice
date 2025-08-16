import { initSupabase, supabase, getUser } from './supabase.js';

function q(sel, parent = document) { return parent.querySelector(sel); }
function qa(sel, parent = document) { return Array.from(parent.querySelectorAll(sel)); }

export async function mountThread() {
    initSupabase();
    const postId = new URLSearchParams(location.search).get('id');
    if (!postId) {
        q('#thread-container').innerHTML = '<div class="text-red-600">Missing thread id</div>';
        return;
    }
    await renderPost(postId);
    await renderComments(postId);
    mountCommentComposer(postId);
}

async function renderPost(postId) {
    const container = q('#thread-post');
    const { data, error } = await supabase.from('posts_view').select('*').eq('id', postId).single();
    if (error) {
        container.innerHTML = `<div class="text-red-600">${error.message}</div>`;
        return;
    }
    const p = data;
    const created = new Date(p.created_at);
    const authorLabel = p.is_anonymous ? 'Anonymous' : (p.author_display_name || 'Member');
    container.innerHTML = `
    <article class="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 mb-4">
        <div class="flex items-center justify-between mb-2">
            <span class="px-2 py-1 text-xs rounded bg-orange-100 text-orange-700">${p.category || 'General'}</span>
            <span class="text-sm text-gray-500">${created.toLocaleString()}</span>
        </div>
        <h1 class="text-2xl font-bold text-gray-800 mb-2">${escapeHtml(p.title)}</h1>
        <p class="text-gray-800">${escapeHtml(p.body)}</p>
        <div class="mt-4 text-sm text-gray-600">by <span class="font-medium">${escapeHtml(authorLabel)}</span></div>
        <div class="mt-4 flex items-center gap-3 text-sm">
            <button data-action="post-upvote" class="px-3 py-1 rounded bg-gray-100 hover:bg-gray-200">▲ <span data-count="up">${p.upvotes || 0}</span></button>
            <button data-action="post-downvote" class="px-3 py-1 rounded bg-gray-100 hover:bg-gray-200">▼ <span data-count="down">${p.downvotes || 0}</span></button>
            <button data-action="post-reshare" class="px-3 py-1 rounded bg-gray-100 hover:bg-gray-200">↻ <span data-count="re">${p.reshares || 0}</span></button>
        </div>
    </article>`;

    // Vote/reshare handlers
    container.querySelector('[data-action="post-upvote"]').addEventListener('click', async () => {
        await supabase.rpc('post_upvote', { p_id: postId });
        await renderPost(postId);
    });
    container.querySelector('[data-action="post-downvote"]').addEventListener('click', async () => {
        await supabase.rpc('post_downvote', { p_id: postId });
        await renderPost(postId);
    });
    container.querySelector('[data-action="post-reshare"]').addEventListener('click', async () => {
        await supabase.rpc('post_reshare', { p_id: postId });
        await renderPost(postId);
    });
}

async function renderComments(postId) {
    const container = q('#thread-comments');
    let { data, error } = await supabase
        .from('comments_view')
        .select('*')
        .eq('post_id', postId)
        .order('created_at', { ascending: true });
    // Fallback if comments_view missing → use comments table
    if (error) {
        let e = (error.message || '').toLowerCase();
        if (e.includes('comments_view') || e.includes('schema')) {
            const r = await supabase
                .from('comments')
                .select('*')
                .eq('post_id', postId)
                .order('created_at', { ascending: true });
            data = r.data || [];
            error = r.error || null;
        }
    }
    if (error) { container.innerHTML = `<div class="text-red-600">${error.message}</div>`; return; }
    container.innerHTML = (data || []).map(c => {
        const created = new Date(c.created_at);
        const authorLabel = c.is_anonymous ? 'Anonymous' : (c.author_display_name || 'Member');
        return `
        <div class="bg-white rounded-xl border border-gray-100 p-4 mb-3">
            <div class="flex items-center justify-between mb-1">
                <div class="text-sm text-gray-600">${escapeHtml(authorLabel)}</div>
                <div class="text-xs text-gray-500">${created.toLocaleString()}</div>
            </div>
            <div class="text-gray-800">${escapeHtml(c.body)}</div>
            <div class="mt-2">
                <button class="px-2 py-1 rounded bg-gray-100 hover:bg-gray-200" data-action="comment-upvote" data-id="${c.id}">▲ Upvote</button>
            </div>
        </div>`;
    }).join('') || `<div class="text-gray-500">No comments yet.</div>`;

    // Delegate click handler for comment upvotes
    container.addEventListener('click', async (e) => {
        const btn = e.target.closest('[data-action="comment-upvote"]');
        if (!btn) return;
        const cid = btn.getAttribute('data-id');
        if (!cid) return;
        await supabase.rpc('comment_upvote', { p_id: cid });
        await renderComments(postId);
    }, { once: true });
}

function mountCommentComposer(postId) {
    const form = q('#comment-composer');
    if (!form) return;
    const anonToggle = q('#comment-anon');
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const body = q('#comment-body')?.value?.trim();
        if (!body) return;
        const user = await getUser();
        const { error } = await supabase.from('comments').insert({
            post_id: postId,
            body,
            is_anonymous: !!anonToggle?.checked,
            author_id: user?.id || null
        });
        if (error) return alert(error.message);
        form.reset();
        await renderComments(postId);
    });
}

function escapeHtml(s = '') {
    return s.replace(/[&<>"]+/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}


