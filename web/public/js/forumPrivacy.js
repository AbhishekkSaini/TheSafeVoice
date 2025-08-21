// Privacy-Aware Forum Component for SafeVoice
// Shows limited preview for anonymous users, full access for authenticated users

import { initSupabase, supabase, getUser } from './supabase.js';
import { privacyAwareSearch, isAuthenticated, getPreviewMessage } from './privacySearch.js';

// Initialize Supabase
initSupabase();

// ========================================
// PRIVACY-AWARE FORUM FUNCTIONS
// ========================================

/**
 * Fetch forum posts with privacy-aware access
 */
async function fetchForumPostsPrivacyAware(limit = 20, category = null) {
    const isAuth = await isAuthenticated();
    
    let query = supabase
        .from('posts')
        .select('id, title, body, created_at, category, author_id')
        .order('created_at', { ascending: false });
    
    if (category && category !== 'all') {
        query = query.eq('category', category);
    }
    
    if (isAuth) {
        // Full access for authenticated users
        query = query.select('id, title, body, created_at, category, author_id, upvotes');
        const { data, error } = await query.limit(limit);
        
        if (error) {
            console.error('Full forum fetch error:', error);
            return [];
        }
        return data || [];
    } else {
        // Limited preview for anonymous users
        const { data, error } = await query.limit(5); // Only 5 posts for preview
        
        if (error) {
            console.error('Preview forum fetch error:', error);
            return [];
        }
        return data || [];
    }
}

/**
 * Fetch categories with privacy-aware access
 */
async function fetchCategoriesPrivacyAware() {
    const isAuth = await isAuthenticated();
    
    if (isAuth) {
        // Full access for authenticated users
        const { data, error } = await supabase
            .from('posts')
            .select('category')
            .not('category', 'is', null);
            
        if (error) {
            console.error('Categories fetch error:', error);
            return [];
        }
        
        // Get unique categories
        const categories = [...new Set(data.map(post => post.category))].filter(Boolean);
        return categories;
    } else {
        // Limited categories for anonymous users
        return ['safety_tips', 'legal_advice', 'emergency_help', 'survivor_stories']; // Basic categories only
    }
}

/**
 * Render forum posts with privacy awareness
 */
function renderForumPosts(posts, isAuthenticated) {
    if (posts.length === 0) {
        return '<div class="text-center py-8 text-gray-500">No posts found</div>';
    }
    
    let html = '';
    
    posts.forEach(post => {
        const isPreview = !isAuthenticated;
        const previewClass = isPreview ? 'opacity-75' : '';
        const previewOverlay = isPreview ? `
            <div class="absolute inset-0 bg-gradient-to-t from-white/80 to-transparent rounded-xl pointer-events-none"></div>
        ` : '';
        
        const excerpt = (post.body || '').replace(/\s+/g, ' ').slice(0, isPreview ? 80 : 200);
        const date = new Date(post.created_at).toLocaleDateString();
        
        html += `
            <div class="relative ${previewClass} bg-white rounded-xl border border-gray-100 p-6 mb-4 hover:shadow-md transition-shadow">
                ${previewOverlay}
                <div class="flex items-start justify-between mb-3">
                    <div class="flex items-center gap-2">
                        <span class="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">${post.category || 'General'}</span>
                        ${isPreview ? '<span class="text-xs bg-orange-100 text-orange-800 px-2 py-1 rounded-full">Preview</span>' : ''}
                    </div>
                    <span class="text-xs text-gray-500">${date}</span>
                </div>
                <h3 class="font-semibold text-gray-800 mb-2">${escapeHtml(post.title || 'Post')}</h3>
                <p class="text-gray-600 text-sm mb-3">${escapeHtml(excerpt)}${excerpt.length === (isPreview ? 80 : 200) ? '…' : ''}</p>
                <div class="flex items-center justify-between">
                    <div class="flex items-center gap-4 text-xs text-gray-500">
                        ${!isPreview && post.upvotes ? `<span>👍 ${post.upvotes}</span>` : ''}
                        <span>💬 Forum</span>
                    </div>
                    ${isPreview ? 
                        `<a href="login.html" class="text-xs text-orange-600 hover:text-orange-700 font-medium">Login to read full post</a>` :
                        `<a href="thread.html?id=${post.id}" class="text-xs text-blue-600 hover:text-blue-700 font-medium">Read more</a>`
                    }
                </div>
            </div>
        `;
    });
    
    return html;
}

/**
 * Render preview banner for anonymous users
 */
function renderPreviewBanner() {
    const previewMsg = getPreviewMessage();
    
    return `
        <div class="bg-gradient-to-r from-orange-50 to-red-50 border border-orange-200 rounded-xl p-6 mb-6">
            <div class="flex items-center justify-between">
                <div>
                    <h3 class="font-semibold text-orange-800 text-lg">${previewMsg.title}</h3>
                    <p class="text-sm text-orange-700 mt-2">${previewMsg.message}</p>
                    <p class="text-xs text-orange-600 mt-1">Showing 5 of many posts • Sign up to see everything</p>
                </div>
                <div class="flex gap-3">
                    <a href="login.html" class="px-6 py-3 bg-orange-600 text-white rounded-lg text-sm font-medium hover:bg-orange-700 transition-colors">
                        ${previewMsg.cta}
                    </a>
                    <a href="signup.html" class="px-6 py-3 border border-orange-600 text-orange-600 rounded-lg text-sm font-medium hover:bg-orange-50 transition-colors">
                        Sign Up
                    </a>
                </div>
            </div>
        </div>
    `;
}

/**
 * Render categories with privacy awareness
 */
function renderCategories(categories, isAuthenticated) {
    if (categories.length === 0) {
        return '<div class="text-gray-500 text-sm">No categories available</div>';
    }
    
    let html = '';
    
    categories.forEach(category => {
        const isPreview = !isAuthenticated;
        const previewClass = isPreview ? 'opacity-75' : '';
        
        html += `
            <div class="relative ${previewClass}">
                <button class="w-full text-left px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors text-sm text-gray-700 category-filter" data-category="${category}">
                    ${category}
                    ${isPreview ? '<span class="text-xs text-orange-600 ml-2">(Preview)</span>' : ''}
                </button>
            </div>
        `;
    });
    
    return html;
}

/**
 * Main privacy-aware forum mount function
 */
export async function mountPrivacyAwareForum() {
    const feedContainer = document.getElementById('forum-feed');
    const categoriesContainer = document.getElementById('forum-categories');
    const filterSelect = document.getElementById('filter-category');
    const postComposer = document.getElementById('post-composer');
    
    if (!feedContainer) {
        console.error('Forum feed container not found');
        return;
    }
    
    // Check authentication status
    const isAuth = await isAuthenticated();
    
    // Hide post composer for anonymous users
    if (postComposer) {
        if (!isAuth) {
            postComposer.style.display = 'none';
            // Add a message instead
            const composerContainer = postComposer.parentElement;
            composerContainer.innerHTML = `
                <div class="bg-gradient-to-r from-orange-50 to-red-50 border border-orange-200 rounded-xl p-6 text-center">
                    <h3 class="font-semibold text-orange-800 mb-2">🔒 Login to Create Posts</h3>
                    <p class="text-sm text-orange-700 mb-4">Join our community to start discussions and share your thoughts.</p>
                    <div class="flex gap-3 justify-center">
                        <a href="login.html" class="px-4 py-2 bg-orange-600 text-white rounded-lg text-sm font-medium hover:bg-orange-700 transition-colors">
                            Login
                        </a>
                        <a href="signup.html" class="px-4 py-2 border border-orange-600 text-orange-600 rounded-lg text-sm font-medium hover:bg-orange-50 transition-colors">
                            Sign Up
                        </a>
                    </div>
                </div>
            `;
        } else {
            // Authenticated users: intercept submit and insert via Supabase without page refresh
            const titleEl = document.getElementById('composer-title');
            const bodyEl = document.getElementById('composer-body');
            const anonToggle = document.getElementById('composer-anon');
            const catSelect = document.getElementById('composer-category');
            
            // Set up category options if not already set
            if (catSelect && !catSelect.options.length) {
                const fallbackCats = ['safety_tips', 'legal_advice', 'emergency_help', 'survivor_stories'];
                catSelect.innerHTML = fallbackCats.map(c => `<option value="${c}">${c.replace(/_/g, ' ')}</option>`).join('');
            }
            
            // Remove required attributes to prevent browser validation from interfering
            if (titleEl) titleEl.removeAttribute('required');
            if (bodyEl) bodyEl.removeAttribute('required');
            
            // Add submit event listener with proper error handling
            postComposer.addEventListener('submit', async (e) => {
                e.preventDefault(); // Prevent form submission
                e.stopPropagation(); // Stop event bubbling
                
                console.log('Form submission intercepted'); // Debug log
                
                const title = titleEl?.value?.trim();
                const body = bodyEl?.value?.trim();
                const category = catSelect?.value || null;
                const isAnonymous = !!anonToggle?.checked;
                
                // Client-side validation
                if (!title || !body) { 
                    alert('Please provide both a title and content for your post'); 
                    return; 
                }
                
                // Disable submit button to prevent double submission
                const submitBtn = postComposer.querySelector('button[type="submit"]');
                if (submitBtn) {
                    submitBtn.disabled = true;
                    submitBtn.textContent = 'Posting...';
                }
                
                try {
                    console.log('Creating post with data:', { title, body, category, isAnonymous }); // Debug log
                    
                    const user = await getUser();
                    if (!user) {
                        alert('You must be logged in to create posts');
                        return;
                    }
                    
                    const { data, error } = await supabase.from('posts').insert({
                        title,
                        body,
                        category,
                        is_anonymous: isAnonymous,
                        author_id: user.id
                    }).select('id, title, created_at').single();
                    
                    if (error) { 
                        console.error('Post creation error:', error); // Debug log
                        alert('Failed to create post: ' + error.message); 
                        return; 
                    }
                    
                    console.log('Post created successfully:', data); // Debug log
                    
                    // Clear form
                    postComposer.reset();
                    
                    // Show success message
                    const successMsg = document.createElement('div');
                    successMsg.className = 'bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4';
                    successMsg.textContent = 'Post created successfully!';
                    postComposer.parentNode.insertBefore(successMsg, postComposer);
                    
                    // Remove success message after 3 seconds
                    setTimeout(() => {
                        if (successMsg.parentNode) {
                            successMsg.parentNode.removeChild(successMsg);
                        }
                    }, 3000);
                    
                    // Refresh the forum feed
                    await loadForumData(category);
                    
                } catch (err) {
                    console.error('Post creation exception:', err); // Debug log
                    alert('Failed to create post: ' + (err?.message || 'Unknown error'));
                } finally {
                    // Re-enable submit button
                    if (submitBtn) {
                        submitBtn.disabled = false;
                        submitBtn.textContent = 'Post';
                    }
                }
            });
            
            // Also prevent form submission on Enter key in textarea
            if (bodyEl) {
                bodyEl.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter' && e.ctrlKey) {
                        e.preventDefault();
                        postComposer.dispatchEvent(new Event('submit'));
                    }
                });
            }
        }
    }
    
    // Load initial data
    await loadForumData();
    
    // Set up event listeners
    if (filterSelect) {
        filterSelect.addEventListener('change', async (e) => {
            await loadForumData(e.target.value);
        });
    }
    
    // Category filter buttons
    document.addEventListener('click', async (e) => {
        if (e.target.classList.contains('category-filter')) {
            const category = e.target.dataset.category;
            await loadForumData(category);
        }
    });
    
    async function loadForumData(category = null) {
        try {
            // Show loading state
            feedContainer.innerHTML = '<div class="text-center py-8 text-gray-500">Loading posts...</div>';
            
            // Fetch data
            const [posts, categories] = await Promise.all([
                fetchForumPostsPrivacyAware(20, category),
                fetchCategoriesPrivacyAware()
            ]);
            
            // Render content
            let html = '';
            
            // Add preview banner for anonymous users
            if (!isAuth) {
                html += renderPreviewBanner();
            }
            
            // Render posts
            html += renderForumPosts(posts, isAuth);
            
            // Render categories
            if (categoriesContainer) {
                categoriesContainer.innerHTML = renderCategories(categories, isAuth);
            }
            
            // Update filter select
            if (filterSelect) {
                filterSelect.innerHTML = `
                    <option value="">All Categories</option>
                    ${categories.map(cat => `<option value="${cat}" ${category === cat ? 'selected' : ''}>${cat}</option>`).join('')}
                `;
            }
            
            feedContainer.innerHTML = html;
            
        } catch (error) {
            console.error('Forum data load error:', error);
            feedContainer.innerHTML = `
                <div class="text-center py-8 text-red-500">
                    Failed to load posts. Please try again.
                </div>
            `;
        }
    }
}

// Utility function
function escapeHtml(s = '') {
    return s.replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;"}[c]));
}

// Export for use in other modules
export {
    fetchForumPostsPrivacyAware,
    fetchCategoriesPrivacyAware,
    renderForumPosts,
    renderPreviewBanner,
    renderCategories
};
