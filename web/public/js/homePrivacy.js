// Privacy-Aware Homepage Component for SafeVoice
// Shows limited preview for anonymous users, full access for authenticated users

import { initSupabase, supabase } from './supabase.js';
import { isAuthenticated, getPreviewMessage } from './privacySearch.js';

// Initialize Supabase
initSupabase();

// ========================================
// PRIVACY-AWARE HOMEPAGE FUNCTIONS
// ========================================

/**
 * Fetch recent posts for homepage with privacy-aware access
 */
async function fetchRecentPostsPrivacyAware(limit = 6) {
    const isAuth = await isAuthenticated();
    
    if (isAuth) {
        // Full access for authenticated users
        const { data, error } = await supabase
            .from('posts')
            .select('id, title, body, created_at, category, upvotes')
            .order('created_at', { ascending: false })
            .limit(limit);
            
        if (error) {
            console.error('Full recent posts fetch error:', error);
            return [];
        }
        return data || [];
    } else {
        // Limited preview for anonymous users
        const { data, error } = await supabase
            .from('posts')
            .select('id, title, body, created_at, category')
            .order('created_at', { ascending: false })
            .limit(3); // Only 3 posts for preview
            
        if (error) {
            console.error('Preview recent posts fetch error:', error);
            return [];
        }
        return data || [];
    }
}

/**
 * Fetch community stats with privacy-aware access
 */
async function fetchCommunityStats() {
    const isAuth = await isAuthenticated();
    
    if (isAuth) {
        // Full stats for authenticated users
        try {
            const [postsCount, profilesCount] = await Promise.all([
                supabase.from('posts').select('id', { count: 'exact', head: true }),
                supabase.from('profiles').select('id', { count: 'exact', head: true })
            ]);
            
            return {
                totalPosts: postsCount.count || 0,
                totalMembers: profilesCount.count || 0,
                isPreview: false
            };
        } catch (error) {
            console.warn('Stats fetch failed:', error);
            return {
                totalPosts: 'many',
                totalMembers: 'many',
                isPreview: false
            };
        }
    } else {
        // Limited stats for anonymous users
        return {
            totalPosts: 'many',
            totalMembers: 'many',
            isPreview: true
        };
    }
}

/**
 * Render recent posts section with privacy awareness
 */
function renderRecentPosts(posts, isAuthenticated) {
    if (posts.length === 0) {
        return `
            <div class="text-center py-8 text-gray-500">
                <p>No posts yet. Be the first to share!</p>
            </div>
        `;
    }
    
    let html = `
        <div class="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
    `;
    
    posts.forEach(post => {
        const isPreview = !isAuthenticated;
        const previewClass = isPreview ? 'opacity-75' : '';
        const previewOverlay = isPreview ? `
            <div class="absolute inset-0 bg-gradient-to-t from-white/80 to-transparent rounded-xl pointer-events-none"></div>
        ` : '';
        
        const excerpt = (post.body || '').replace(/\s+/g, ' ').slice(0, isPreview ? 60 : 120);
        const date = new Date(post.created_at).toLocaleDateString();
        
        html += `
            <div class="relative ${previewClass} bg-white rounded-xl border border-gray-100 p-6 hover:shadow-md transition-shadow">
                ${previewOverlay}
                <div class="flex items-center justify-between mb-3">
                    <span class="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">${post.category || 'General'}</span>
                    ${isPreview ? '<span class="text-xs bg-orange-100 text-orange-800 px-2 py-1 rounded-full">Preview</span>' : ''}
                </div>
                <h3 class="font-semibold text-gray-800 mb-2 line-clamp-2">${escapeHtml(post.title || 'Post')}</h3>
                <p class="text-gray-600 text-sm mb-3 line-clamp-3">${escapeHtml(excerpt)}${excerpt.length === (isPreview ? 60 : 120) ? '…' : ''}</p>
                <div class="flex items-center justify-between text-xs text-gray-500">
                    <span>${date}</span>
                    ${!isPreview && post.upvotes ? `<span>👍 ${post.upvotes}</span>` : ''}
                </div>
                <div class="mt-3">
                    ${isPreview ? 
                        `<a href="login.html" class="text-xs text-orange-600 hover:text-orange-700 font-medium">Login to read full post</a>` :
                        `<a href="thread.html?id=${post.id}" class="text-xs text-blue-600 hover:text-blue-700 font-medium">Read more</a>`
                    }
                </div>
            </div>
        `;
    });
    
    html += `</div>`;
    
    return html;
}

/**
 * Render community stats with privacy awareness
 */
function renderCommunityStats(stats, isAuthenticated) {
    const isPreview = stats.isPreview;
    
    return `
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div class="bg-white rounded-xl border border-gray-100 p-6 text-center ${isPreview ? 'opacity-75' : ''}">
                <div class="text-3xl font-bold text-orange-600 mb-2">
                    ${isPreview ? 'Many' : stats.totalPosts}
                </div>
                <div class="text-gray-600">Community Posts</div>
                ${isPreview ? '<div class="text-xs text-orange-600 mt-1">(Preview)</div>' : ''}
            </div>
            <div class="bg-white rounded-xl border border-gray-100 p-6 text-center ${isPreview ? 'opacity-75' : ''}">
                <div class="text-3xl font-bold text-red-600 mb-2">
                    ${isPreview ? 'Many' : stats.totalMembers}
                </div>
                <div class="text-gray-600">Active Members</div>
                ${isPreview ? '<div class="text-xs text-orange-600 mt-1">(Preview)</div>' : ''}
            </div>
            <div class="bg-white rounded-xl border border-gray-100 p-6 text-center">
                <div class="text-3xl font-bold text-green-600 mb-2">24/7</div>
                <div class="text-gray-600">SOS Support</div>
            </div>
        </div>
    `;
}

/**
 * Render preview banner for anonymous users
 */
function renderPreviewBanner() {
    const previewMsg = getPreviewMessage();
    
    return `
        <div class="bg-gradient-to-r from-orange-50 to-red-50 border border-orange-200 rounded-xl p-6 mb-8">
            <div class="flex items-center justify-between">
                <div>
                    <h3 class="font-semibold text-orange-800 text-lg">${previewMsg.title}</h3>
                    <p class="text-sm text-orange-700 mt-2">${previewMsg.message}</p>
                    <p class="text-xs text-orange-600 mt-1">Join our community to access all features and connect with others</p>
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
 * Main privacy-aware homepage mount function
 */
export async function mountPrivacyAwareHomepage() {
    const recentPostsContainer = document.getElementById('recent-posts');
    const communityStatsContainer = document.getElementById('community-stats');
    const previewBannerContainer = document.getElementById('preview-banner');
    
    // Check authentication status
    const isAuth = await isAuthenticated();
    
    try {
        // Fetch data
        const [posts, stats] = await Promise.all([
            fetchRecentPostsPrivacyAware(),
            fetchCommunityStats()
        ]);
        
        // Render content
        if (recentPostsContainer) {
            recentPostsContainer.innerHTML = renderRecentPosts(posts, isAuth);
        }
        
        if (communityStatsContainer) {
            communityStatsContainer.innerHTML = renderCommunityStats(stats, isAuth);
        }
        
        // Add preview banner for anonymous users
        if (!isAuth && previewBannerContainer) {
            previewBannerContainer.innerHTML = renderPreviewBanner();
        }
        
        // Update page title and meta for anonymous users
        if (!isAuth) {
            document.title = 'TheSafeVoice — Preview • Women\'s Safety Community';
            const metaDesc = document.querySelector('meta[name="description"]');
            if (metaDesc) {
                metaDesc.content = 'Preview TheSafeVoice: A trusted, privacy-first forum for women\'s safety. Sign up to access all features.';
            }
        }
        
    } catch (error) {
        console.error('Homepage data load error:', error);
        
        if (recentPostsContainer) {
            recentPostsContainer.innerHTML = `
                <div class="text-center py-8 text-red-500">
                    Failed to load recent posts. Please try again.
                </div>
            `;
        }
    }
}

/**
 * Initialize privacy-aware search functionality
 */
export function initPrivacyAwareSearch() {
    const searchInputs = ['#nav-user-search', '#mobile-search'];
    
    searchInputs.forEach(selector => {
        const input = document.querySelector(selector);
        const resultsContainer = document.querySelector(selector === '#nav-user-search' ? '#nav-user-results' : '#mobile-search-results');
        
        if (input && resultsContainer) {
            input.addEventListener('input', async (e) => {
                const query = e.target.value.trim();
                
                if (query.length < 2) {
                    resultsContainer.classList.add('hidden');
                    return;
                }
                
                // Show loading state
                resultsContainer.innerHTML = '<div class="p-3 text-gray-500 text-sm">Searching...</div>';
                resultsContainer.classList.remove('hidden');
                
                try {
                    // Import and use privacy-aware search
                    const { privacyAwareSearch } = await import('./privacySearch.js');
                    const searchResult = await privacyAwareSearch(query);
                    
                    if (searchResult.error) {
                        resultsContainer.innerHTML = `<div class="p-3 text-red-500 text-sm">Search failed</div>`;
                        return;
                    }
                    
                    const { results, isAuthenticated, hasPreview } = searchResult;
                    
                    if (results.length === 0) {
                        resultsContainer.innerHTML = '<div class="p-3 text-gray-500 text-sm">No results found</div>';
                        return;
                    }
                    
                    // Render results
                    let html = '';
                    
                    if (hasPreview) {
                        html += `
                            <div class="p-3 bg-orange-50 border-b border-orange-200">
                                <div class="text-xs text-orange-700 font-medium">🔒 Preview Mode</div>
                                <div class="text-xs text-orange-600">Login to see all results</div>
                            </div>
                        `;
                    }
                    
                    results.slice(0, 5).forEach(result => {
                        if (result.type === 'profile') {
                            html += renderSearchUser(result.data, result.isPreview);
                        } else if (result.type === 'post') {
                            html += renderSearchPost(result.data, result.isPreview);
                        }
                    });
                    
                    resultsContainer.innerHTML = html;
                    
                } catch (error) {
                    console.error('Search error:', error);
                    resultsContainer.innerHTML = '<div class="p-3 text-red-500 text-sm">Search failed</div>';
                }
            });
            
            // Hide results when clicking outside
            document.addEventListener('click', (e) => {
                if (!input.contains(e.target) && !resultsContainer.contains(e.target)) {
                    resultsContainer.classList.add('hidden');
                }
            });
        }
    });
}

/**
 * Render user in search results
 */
function renderSearchUser(user, isPreview) {
    return `
        <div class="p-3 hover:bg-gray-50 border-b border-gray-100 last:border-b-0 ${isPreview ? 'opacity-75' : ''}">
            <div class="flex items-center gap-3">
                <div class="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
                    <span class="text-gray-500 text-sm">👤</span>
                </div>
                <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2">
                        <a href="${isPreview ? 'login.html' : `user.html?u=${encodeURIComponent(user.id)}`}" class="font-medium text-gray-800 text-sm">@${user.display_name || 'User'}</a>
                        ${isPreview ? '<span class="text-xs text-orange-600 bg-orange-100 px-1 rounded">Preview</span>' : ''}
                    </div>
                    <div class="text-xs text-gray-500 truncate">${user.display_name || ''}</div>
                </div>
            </div>
        </div>
    `;
}

/**
 * Render post in search results
 */
function renderSearchPost(post, isPreview) {
    const excerpt = (post.body || '').replace(/\s+/g, ' ').slice(0, isPreview ? 40 : 80);
    
    return `
        <div class="p-3 hover:bg-gray-50 border-b border-gray-100 last:border-b-0 ${isPreview ? 'opacity-75' : ''}">
            <a href="${isPreview ? 'login.html' : `thread.html?id=${post.id}`}" class="block">
                <div class="flex items-center gap-2 mb-1">
                    <span class="text-xs text-gray-500 bg-gray-100 px-1 rounded">Post</span>
                    ${isPreview ? '<span class="text-xs text-orange-600 bg-orange-100 px-1 rounded">Preview</span>' : ''}
                </div>
                <div class="font-medium text-gray-800 text-sm mb-1">${escapeHtml(post.title || 'Post')}</div>
                <div class="text-xs text-gray-600">${escapeHtml(excerpt)}${excerpt.length === (isPreview ? 40 : 80) ? '…' : ''}</div>
            </a>
        </div>
    `;
}

// Utility function
function escapeHtml(s = '') {
    return s.replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;"}[c]));
}

// Export for use in other modules
export {
    fetchRecentPostsPrivacyAware,
    fetchCommunityStats,
    renderRecentPosts,
    renderCommunityStats,
    renderPreviewBanner
};
