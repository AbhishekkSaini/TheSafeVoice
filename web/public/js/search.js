import { initSupabase, supabase } from './supabase.js';

function debounce(fn, wait){ let t=null; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a),wait); } }

export function mountUserSearch(inputSelector, resultsSelector){
  initSupabase();
  const input = document.querySelector(inputSelector);
  const results = document.querySelector(resultsSelector);
  if (!input || !results) return;

  results.classList.add('hidden');

  async function run(){
    const q = (input.value||'').trim();
    if (q.length < 2){ results.classList.add('hidden'); results.innerHTML = ''; return; }
    
    const like = `%${q}%`;
    
    // Search both users and posts
    const [usersExact, usersPartial, postsSearch] = await Promise.all([
      // Exact username matches (highest priority)
      supabase.from('profiles').select('username,display_name,profile_pic').eq('username', q).limit(3),
      // Partial username matches
      supabase.from('profiles').select('username,display_name,profile_pic').ilike('username', like).limit(5),
      // Posts that match in title OR body
      supabase.from('posts').select('id,title,body,created_at,upvotes').or(`title.ilike.${like},body.ilike.${like}`).order('created_at',{ascending:false}).limit(5)
    ]);
    
    let searchResults = [];
    
    // Add user results
    (usersExact.data||[]).forEach(u=>searchResults.push({
      type:'user', 
      key:u.username, 
      score:100, 
      item:u
    }));
    
    (usersPartial.data||[]).forEach(u=>{
      if (!searchResults.find(r => r.type === 'user' && r.key === u.username)) {
        searchResults.push({
          type:'user', 
          key:u.username, 
          score:70, 
          item:u
        });
      }
    });
    
    // Add post results
    (postsSearch.data||[]).forEach(p=>{
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
    
    // Sort by score and limit results
    const ranked = searchResults.sort((a,b)=>b.score - a.score).slice(0,8);
    
    if (ranked.length === 0){ 
      results.classList.add('hidden'); 
      results.innerHTML=''; 
      return; 
    }
    
    results.innerHTML = ranked.map(r => r.type === 'user' ? renderUser(r.item) : renderPost(r.item)).join('');
    results.classList.remove('hidden');
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


