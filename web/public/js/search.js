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
        // Exact username matches (highest priority)
        retryRequest(() => supabase.from('profiles').select('username,display_name,profile_pic').eq('username', q).limit(3)),
        // Partial username matches
        retryRequest(() => supabase.from('profiles').select('username,display_name,profile_pic').ilike('username', `%${q}%`).limit(5)),
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
          key:u.username, 
          score:100, 
          item:u
        }));
      }
      
      if (usersPartial.status === 'fulfilled' && usersPartial.value.data && usersPartial.value.data.length > 0) {
        usersPartial.value.data.forEach(u=>{
          if (!searchResults.find(r => r.type === 'user' && r.key === u.username)) {
            searchResults.push({
              type:'user', 
              key:u.username, 
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
          if (p.title && p.title.toLowerCase().includes(q.toLowerCase())) score += 20;
          if (p.body && p.body.toLowerCase().includes(q.toLowerCase())) score += 10;
          
          searchResults.push({
            type:'post', 
            key:p.id, 
            score:score, 
            item:p
          });
        });
      }
      
      // Check if any requests failed
      const failedRequests = [usersExact, usersPartial, postsSearch].filter(req => req.status === 'rejected');
      if (failedRequests.length > 0) {
        console.warn('Some search requests failed:', failedRequests);
      }
      
      // Sort by score and limit results
      const ranked = searchResults.sort((a,b)=>b.score - a.score).slice(0,8);
      
      console.log('Final ranked results:', ranked);
      
      if (ranked.length === 0){ 
        results.classList.remove('hidden');
        results.innerHTML = '<div class="px-3 py-2 text-gray-500 text-sm">No results found</div>';
        return; 
      }
      
      results.innerHTML = ranked.map(r => r.type === 'user' ? renderUser(r.item) : renderPost(r.item)).join('');
      results.classList.remove('hidden');
      
    } catch (error) {
      console.error('Search error:', error);
      results.classList.remove('hidden');
      
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
    return `<div class="flex items-center justify-between px-3 py-2 hover:bg-gray-50 cursor-pointer border-b border-gray-100">
      <a href="user.html?u=${encodeURIComponent(u.username)}" class="flex items-center gap-2 min-w-0">
        <img src="${u.profile_pic||'/avatar.png'}" class="w-8 h-8 rounded-full"/>
        <div class="min-w-0">
          <div class="text-sm font-medium truncate">@${u.username}</div>
          <div class="text-[11px] text-gray-500 truncate">${u.display_name||''}</div>
        </div>
      </a>
      <a href="messages.html?to=${encodeURIComponent(u.username)}" class="text-xs px-2 py-1 rounded-full border">Message</a>
    </div>`;
  }
  
  function renderPost(p){
    const excerpt = (p.body||'').replace(/\s+/g,' ').slice(0,80);
    return `<a href="thread.html?id=${p.id}" class="block px-3 py-2 hover:bg-gray-50 cursor-pointer border-b border-gray-100">
      <div class="flex items-center gap-2 mb-1">
        <span class="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">Post</span>
        <span class="text-xs text-gray-500">${new Date(p.created_at).toLocaleDateString()}</span>
      </div>
      <div class="text-sm font-medium text-gray-800 mb-1">${escapeHtml(p.title||'Post')}</div>
      <div class="text-xs text-gray-600">${escapeHtml(excerpt)}${excerpt.length===80?'…':''}</div>
    </a>`;
  }
  
  function escapeHtml(s=''){ 
    return s.replace(/[&<>"']/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;"}[c])); 
  }

  const debounced = debounce(run, 250);
  input.addEventListener('input', debounced);
  input.addEventListener('focus', run);
  input.addEventListener('keydown', (e)=>{
    if (e.key === 'Enter'){
      const q = (input.value||'').trim();
      if (q) window.location.href = `search.html?q=${encodeURIComponent(q)}`;
    }
  });

  document.addEventListener('click', (e)=>{
    if (!results.contains(e.target) && e.target !== input){ results.classList.add('hidden'); }
  });
}


