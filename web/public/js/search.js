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
    const { data } = await supabase
      .from('profiles')
      .select('username,profile_pic,display_name')
      .ilike('username', q + '%')
      .limit(8);
    const users = data || [];
    if (users.length === 0){ results.classList.add('hidden'); results.innerHTML=''; return; }
    results.innerHTML = users.map(u => `
      <div class="flex items-center justify-between px-3 py-2 hover:bg-gray-50 cursor-pointer">
        <a href="user.html?u=${encodeURIComponent(u.username)}" class="flex items-center gap-2 min-w-0">
          <img src="${u.profile_pic||'/avatar.png'}" class="w-8 h-8 rounded-full"/>
          <div class="min-w-0">
            <div class="text-sm font-medium truncate">@${u.username}</div>
            <div class="text-[11px] text-gray-500 truncate">${u.display_name||''}</div>
          </div>
        </a>
        <a href="messages.html?to=${encodeURIComponent(u.username)}" class="text-xs px-2 py-1 rounded-full border">Message</a>
      </div>
    `).join('');
    results.classList.remove('hidden');
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


