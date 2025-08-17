// Privacy-Aware Search Service for SafeVoice
// Implements Instagram/X-style privacy wall where anonymous users get limited preview

import { initSupabase, supabase } from './supabase.js';

// Initialize Supabase
initSupabase();

// ========================================
// PRIVACY-AWARE SEARCH FUNCTIONS
// ========================================

/**
 * Check if user is authenticated
 */
async function isAuthenticated() {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        return !!user;
    } catch (error) {
        console.warn('Auth check failed:', error);
        return false;
    }
}

/**
 * Fetch posts with privacy-aware access
 * Anonymous: Limited preview (3 posts, basic info)
 * Authenticated: Full access
 */
async function fetchPostsPrivacyAware(query, limit = 10) {
    const isAuth = await isAuthenticated();
    const like = `%${query}%`;
    
    if (isAuth) {
        // Full access for authenticated users
        const { data, error } = await supabase
            .from('posts')
            .select('id, title, body, created_at, upvotes, author_id')
            .or(`title.ilike.${like},body.ilike.${like}`)
            .order('created_at', { ascending: false })
            .limit(limit);
            
        if (error) {
            console.error('Full posts fetch error:', error);
            return [];
        }
        return data || [];
    } else {
        // Limited preview for anonymous users
        const { data, error } = await supabase
            .from('posts')
            .select('id, title, body, created_at') // No upvotes, no author_id
            .or(`title.ilike.${like},body.ilike.${like}`)
            .order('created_at', { ascending: false })
            .limit(3); // Only 3 posts for preview
            
        if (error) {
            console.error('Preview posts fetch error:', error);
            return [];
        }
        return data || [];
    }
}

/**
 * Fetch profiles with privacy-aware access
 * Anonymous: Basic info only (display_name)
 * Authenticated: Full profile access
 */
async function fetchProfilesPrivacyAware(query, limit = 10) {
    const isAuth = await isAuthenticated();
    const like = `%${query}%`;
    
    if (isAuth) {
        // Full access for authenticated users
        const [exactMatches, partialMatches] = await Promise.all([
            supabase.from('profiles').select('id, display_name, email, created_at')
                .eq('display_name', query).limit(3),
            supabase.from('profiles').select('id, display_name, email, created_at')
                .ilike('display_name', like).limit(limit - 3)
        ]);
        
        const results = [];
        if (exactMatches.data) results.push(...exactMatches.data);
        if (partialMatches.data) {
            // Avoid duplicates
            partialMatches.data.forEach(profile => {
                if (!results.find(r => r.id === profile.id)) {
                    results.push(profile);
                }
            });
        }
        return results;
    } else {
        // Limited preview for anonymous users
        const [exactMatches, partialMatches] = await Promise.all([
            supabase.from('profiles').select('id, display_name') // No email
                .eq('display_name', query).limit(2),
            supabase.from('profiles').select('id, display_name') // No email
                .ilike('display_name', like).limit(3)
        ]);
        
        const results = [];
        if (exactMatches.data) results.push(...exactMatches.data);
        if (partialMatches.data) {
            // Avoid duplicates
            partialMatches.data.forEach(profile => {
                if (!results.find(r => r.id === profile.id)) {
                    results.push(profile);
                }
            });
        }
        return results;
    }
}

/**
 * Main privacy-aware search function
 */
export async function privacyAwareSearch(query) {
    if (!query || query.trim().length < 2) {
        return {
            results: [],
            isAuthenticated: false,
            hasPreview: false
        };
    }
    
    const isAuth = await isAuthenticated();
    
    try {
        // Fetch both posts and profiles
        const [posts, profiles] = await Promise.all([
            fetchPostsPrivacyAware(query),
            fetchProfilesPrivacyAware(query)
        ]);
        
        // Combine and rank results
        let combinedResults = [];
        
        // Add profile results (higher priority)
        profiles.forEach(profile => {
            combinedResults.push({
                type: 'profile',
                data: profile,
                score: profile.display_name && profile.display_name.toLowerCase() === query.toLowerCase() ? 100 : 70,
                isPreview: !isAuth
            });
        });
        
        // Add post results
        posts.forEach(post => {
            let score = 50;
            if (post.title && post.title.toLowerCase().includes(query.toLowerCase())) {
                score += 20;
            }
            if (post.body && post.body.toLowerCase().includes(query.toLowerCase())) {
                score += 10;
            }
            
            combinedResults.push({
                type: 'post',
                data: post,
                score: score,
                isPreview: !isAuth
            });
        });
        
        // Sort by score
        combinedResults.sort((a, b) => b.score - a.score);
        
        return {
            results: combinedResults,
            isAuthenticated: isAuth,
            hasPreview: !isAuth && combinedResults.length > 0
        };
        
    } catch (error) {
        console.error('Privacy-aware search error:', error);
        return {
            results: [],
            isAuthenticated: isAuth,
            hasPreview: false,
            error: error.message
        };
    }
}

/**
 * Get preview stats for anonymous users
 */
export async function getPreviewStats() {
    const isAuth = await isAuthenticated();
    
    if (isAuth) {
        return null; // No preview needed for authenticated users
    }
    
    try {
        // Get total counts for preview message
        const [postsCount, profilesCount] = await Promise.all([
            supabase.from('posts').select('id', { count: 'exact', head: true }),
            supabase.from('profiles').select('id', { count: 'exact', head: true })
        ]);
        
        return {
            totalPosts: postsCount.count || 0,
            totalProfiles: profilesCount.count || 0,
            previewPosts: 3,
            previewProfiles: 5
        };
    } catch (error) {
        console.warn('Preview stats fetch failed:', error);
        return {
            totalPosts: 'many',
            totalProfiles: 'many',
            previewPosts: 3,
            previewProfiles: 5
        };
    }
}

/**
 * Check if content should be blurred/previewed
 */
export function shouldShowPreview(isAuthenticated, contentType = 'post') {
    if (isAuthenticated) return false;
    
    // Define what gets previewed for anonymous users
    const previewRules = {
        post: true,      // Posts are previewed
        profile: true,   // Profiles are previewed
        comment: true,   // Comments are previewed
        message: true    // Messages are always private
    };
    
    return previewRules[contentType] || false;
}

/**
 * Get preview message for anonymous users
 */
export function getPreviewMessage(stats = null) {
    if (!stats) {
        return {
            title: "🔒 Login to see more",
            message: "Sign up to access all posts, profiles, and features",
            cta: "Login Now"
        };
    }
    
    return {
        title: "🔒 Preview Mode",
        message: `Showing ${stats.previewPosts} of ${stats.totalPosts} posts and ${stats.previewProfiles} of ${stats.totalProfiles} profiles`,
        cta: "Login to see everything"
    };
}

// Export individual functions for specific use cases
export {
    isAuthenticated,
    fetchPostsPrivacyAware,
    fetchProfilesPrivacyAware
};
