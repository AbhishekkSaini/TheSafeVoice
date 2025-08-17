export function showError(message, opts = {}){
  // Options: { timeoutMs?: number, title?: string, variant?: 'error'|'warning'|'success' }
  const title = opts.title || 'Error';
  const timeoutMs = opts.timeoutMs || 0;
  const variant = opts.variant || 'error';

  let overlay = document.getElementById('sv-error-overlay');
  if (!overlay){
    overlay = document.createElement('div');
    overlay.id = 'sv-error-overlay';
    overlay.style.position='fixed';
    overlay.style.inset='0';
    overlay.style.background='rgba(0,0,0,0.45)';
    overlay.style.display='flex';
    overlay.style.alignItems='center';
    overlay.style.justifyContent='center';
    overlay.style.zIndex='10000';
    overlay.innerHTML = `
      <div id="sv-error-card" style="width:360px; max-width:90%; background:#fff; border-radius:18px; box-shadow:0 20px 60px rgba(0,0,0,.25); overflow:hidden; font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto">
        <div style="padding:22px 20px 12px; text-align:center">
          <div id="sv-error-title" style="font-weight:800; font-size:18px; letter-spacing:.2px">${title}</div>
          <div id="sv-error-text" style="color:#4b5563; font-size:14px; line-height:20px; margin-top:6px"></div>
        </div>
        <div style="padding:14px; display:flex; justify-content:center; gap:12px; border-top:1px solid #e5e7eb">
          <button id="sv-error-dismiss" style="appearance:none; border:0; background:#111827; color:#fff; padding:10px 18px; border-radius:999px; font-weight:600; box-shadow:0 6px 16px rgba(17,24,39,.25)">Dismiss</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    overlay.addEventListener('click',(e)=>{
      if (e.target.id==='sv-error-overlay' || e.target.id==='sv-error-dismiss') overlay.remove();
    });
  }

  const textEl = overlay.querySelector('#sv-error-text');
  if (textEl) textEl.textContent = message || 'Something went wrong';
  const titleEl = overlay.querySelector('#sv-error-title');
  if (titleEl) titleEl.textContent = title;
  const card = overlay.querySelector('#sv-error-card');
  if (card){
    // simple variant color tweak
    card.style.borderTop = variant==='warning' ? '4px solid #f59e0b' : (variant==='success' ? '4px solid #10b981' : '4px solid #ef4444');
  }

  if (timeoutMs > 0){
    setTimeout(()=>{ try { overlay.remove(); } catch {} }, timeoutMs);
  }
}

export function replaceNativeAlerts(){
  const originalAlert = window.alert;
  window.alert = function(msg){
    try { showError(String(msg)); } catch { originalAlert(msg); }
  };
}


