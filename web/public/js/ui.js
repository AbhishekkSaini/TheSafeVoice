export function showError(message){
  // Create overlay once
  let overlay = document.getElementById('sv-error-overlay');
  if (!overlay){
    overlay = document.createElement('div');
    overlay.id = 'sv-error-overlay';
    overlay.style.position='fixed';
    overlay.style.inset='0';
    overlay.style.background='rgba(0,0,0,0.4)';
    overlay.style.display='flex';
    overlay.style.alignItems='center';
    overlay.style.justifyContent='center';
    overlay.style.zIndex='10000';
    overlay.innerHTML = `
      <div style="width:360px; max-width:90%; background:white; border-radius:16px; box-shadow:0 10px 30px rgba(0,0,0,.2); overflow:hidden; font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto">
        <div style="padding:20px; text-align:center">
          <div style="font-weight:700; margin-bottom:8px">Error</div>
          <div id="sv-error-text" style="color:#374151; font-size:14px; line-height:20px"></div>
        </div>
        <div style="border-top:1px solid #e5e7eb; padding:12px; text-align:center">
          <button id="sv-error-dismiss" style="background:#111827; color:white; padding:8px 16px; border-radius:8px">Dismiss</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    overlay.addEventListener('click',(e)=>{
      if (e.target.id==='sv-error-overlay' || e.target.id==='sv-error-dismiss') overlay.remove();
    });
  }
  const text = overlay.querySelector('#sv-error-text');
  if (text) text.textContent = message || 'Something went wrong';
}


