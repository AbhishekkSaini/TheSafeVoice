import { initSupabase, supabase } from './supabase.js';

function debounce(fn, wait){ let t=null; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a),wait); } }

// Add retry function for network requests
async function retryRequest(requestFn, maxRetries = 3, delay = 1000) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await requestFn();
    } catch (error) {
      console.warn(`Search attempt ${attempt} failed:`, error);
      
      if (attempt === maxRetries) {
        throw error;
      }
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delay * attempt));
    }
  }
}

// Check network connectivity
function checkNetworkConnectivity() {
  return navigator.onLine;
}

export function mountUserSearch(inputSelector, resultsSelector){
  initSupabase();
  const input = document.querySelector(inputSelector);
  const results = document.querySelector(resultsSelector);
  if (!input || !results) return;

  results.classList.add('hidden');

  async function run(){
    const q = (input.value||'').trim();
    if (q.length < 2){ results.classList.add('hidden'); results.innerHTML = ''; return; }
    
    // Check network connectivity first
    if (!checkNetworkConnectivity()) {
      results.classList.remove('hidden');
      results.innerHTML = '<div class="px-3 py-2 text-red-600 text-sm">⚠️ No internet connection. Please check your network and try again.</div>';
      return;
    }
    
    // Debug: Check if supabase is initialized
    if (!supabase) {
      console.error('Supabase not initialized');
      results.classList.remove('hidden');
      results.innerHTML = '<div class="px-3 py-2 text-red-600 text-sm">⚠️ Search service not available. Please refresh the page.</div>';
      return;
    }
    
    // Show loading state
    results.classList.remove('hidden');
    results.innerHTML = '<div class="px-3 py-2 text-gray-600 text-sm">🔍 Searching...</div>';
    
    try {
      // Search both users and posts with retry logic and proper error handling
      const searchPromises = [
        // Exact display_name matches (highest priority)
        retryRequest(() => supabase.from('profiles').select('id,display_name,email').eq('display_name', q).limit(3)),
        // Partial display_name matches
        retryRequest(() => supabase.from('profiles').select('id,display_name,email').ilike('display_name', `%${q}%`).limit(5)),
        // Posts that match in title OR body - fixed .or() syntax
        retryRequest(() => supabase.from('posts').select('id,title,body,created_at,upvotes').or(`title.ilike.%${q}%,body.ilike.%${q}%`).order('created_at',{ascending:false}).limit(5))
      ];
      
      const [usersExact, usersPartial, postsSearch] = await Promise.allSettled(searchPromises);
      
      // Debug: Log all results to see what's happening
      console.log('Search Debug:', { q, usersExact, usersPartial, postsSearch });
      
      let searchResults = [];
      
      // Handle user results with error checking
      if (usersExact.status === 'fulfilled' && usersExact.value.data && usersExact.value.data.length > 0) {
        usersExact.value.data.forEach(u=>searchResults.push({
          type:'user', 
          key:u.id, 
          score:100, 
          item:u
        }));
      }
      
      if (usersPartial.status === 'fulfilled' && usersPartial.value.data && usersPartial.value.data.length > 0) {
        usersPartial.value.data.forEach(u=>{
          if (!searchResults.find(r => r.type === 'user' && r.key === u.id)) {
            searchResults.push({
              type:'user', 
              key:u.id, 
              score:70, 
              item:u
            });
          }
        });
      }
      
      // Handle post results with error checking
      if (postsSearch.status === 'fulfilled' && postsSearch.value.data && postsSearch.value.data.length > 0) {
        postsSearch.value.data.forEach(p=>{
          let score = 50;
          if (p.title && p.title.toLowerCase().includes(q.toLowerCase())) {
            score += 20;
          }
          if (p.body && p.body.toLowerCase().includes(q.toLowerCase())) {
            score += 10;
          }
          searchResults.push({
            type:'post', 
            key:p.id, 
            score:score, 
            item:p
          });
        });
      }
      
      // Sort by score and render
      searchResults.sort((a,b)=>b.score-a.score);
      
      if (searchResults.length === 0) {
        results.innerHTML = '<div class="px-3 py-2 text-gray-500 text-sm">No results found</div>';
      } else {
        results.innerHTML = searchResults.map(r=>r.type==='user' ? renderUser(r.item) : renderPost(r.item)).join('');
      }
      
    } catch (error) {
      console.error('Search error:', error);
      
      // Provide user-friendly error messages
      let errorMessage = 'Search failed. Please try again.';
      if (error.message?.includes('network') || error.message?.includes('fetch')) {
        errorMessage = '⚠️ Network error. Please check your internet connection and try again.';
      } else if (error.message?.includes('timeout')) {
        errorMessage = '⏱️ Request timed out. Please try again.';
      }
      
      results.innerHTML = `<div class="px-3 py-2 text-red-600 text-sm">${errorMessage}</div>`;
    }
  }
  
  function renderUser(u){
    return `<div class="p-3 hover:bg-gray-50 border-b border-gray-100 last:border-b-0">
      <div class="flex items-center gap-3">
        <div class="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
          <span class="text-gray-500 text-sm">👤</span>
        </div>
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2">
            <a href="user.html?u=${encodeURIComponent(u.id)}" class="font-medium text-gray-800 text-sm">@${u.display_name || 'User'}</a>
          </div>
          <div class="text-xs text-gray-500 truncate">${u.display_name || ''}</div>
        </div>
      </div>
    </div>`;
  }
  
  function renderPost(p){
    const excerpt = (p.body||'').replace(/\s+/g,' ').slice(0,80);
    return `<div class="p-3 hover:bg-gray-50 border-b border-gray-100 last:border-b-0">
      <a href="thread.html?id=${p.id}" class="block">
        <div class="flex items-center gap-2 mb-1">
          <span class="text-xs text-gray-500 bg-gray-100 px-1 rounded">Post</span>
        </div>
        <div class="font-medium text-gray-800 text-sm mb-1">${escapeHtml(p.title || 'Post')}</div>
        <div class="text-xs text-gray-600">${escapeHtml(excerpt)}${excerpt.length===80?'…':''}</div>
      </a>
    </div>`;
  }
  
  function escapeHtml(s=''){ return s.replace(/[&<>"']/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;"}[c])); }
  
  input.addEventListener('input', debounce(run, 300));
  
  // Hide results when clicking outside
  document.addEventListener('click', (e) => {
    if (!input.contains(e.target) && !results.contains(e.target)) {
      results.classList.add('hidden');
    }
  });
}


