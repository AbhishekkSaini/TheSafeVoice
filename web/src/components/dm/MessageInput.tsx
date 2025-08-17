"use client";
import { useEffect, useRef, useState } from "react";
import { getSupabaseClient } from "@/lib/supabaseClient";

const EMOJIS = ["😀","😂","😍","👍","🔥","🙏","🎉","❤️","😢","😎"]; 

export default function MessageInput({ meId, otherId }:{ meId: string|null; otherId: string|null }){
  const supabase = getSupabaseClient();
  const [text,setText] = useState("");
  const [showEmoji,setShowEmoji] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const typingRef = useRef<any>(null);
  const chanRef = useRef<any>(null);

  useEffect(()=>{
    if(!meId || !otherId) return;
    const chan = supabase.channel(`typing:${meId}:${otherId}`, { config:{ broadcast:{ self:true }}}).subscribe();
    chanRef.current = chan;
    return ()=>{ try{ chan.unsubscribe(); }catch{} };
  },[meId,otherId,supabase]);

  function onType(){
    try{ chanRef.current?.send({ type:"broadcast", event:"typing", payload:{ userId: meId }}); }catch{}
    clearTimeout(typingRef.current);
    typingRef.current = setTimeout(()=>{}, 800);
  }

  async function send(content?:string, file?: File|null){
    if(!meId || !otherId) return;
    let attachment_url: string|null = null;
    if(file){
      const path = `dm/${meId}-${otherId}/${Date.now()}-${file.name}`;
      const { data, error } = await supabase.storage.from("dm_media").upload(path, file, { upsert:false });
      if(error) return;
      attachment_url = supabase.storage.from("dm_media").getPublicUrl(path).data.publicUrl;
    }
    await supabase.from("messages").insert({ sender_id: meId, receiver_id: otherId, body: content||null, attachment_url });
  }

  async function onSend(){
    const file = fileRef.current?.files?.[0] || null;
    if(!text && !file) return;
    await send(text, file);
    setText(""); if(fileRef.current) fileRef.current.value = "";
  }

  return (
    <div className="border-t px-3 py-2 flex items-center gap-2 bg-white">
      <button onClick={()=>setShowEmoji(v=>!v)} className="p-2 hover:bg-gray-100 rounded">😊</button>
      {showEmoji && (
        <div className="absolute bottom-16 left-1/2 -translate-x-1/2 bg-white border rounded-xl p-2 grid grid-cols-5 gap-1 shadow">
          {EMOJIS.map(e=> <button key={e} onClick={()=>setText(t=>t+e)} className="text-xl">{e}</button>)}
        </div>
      )}
      <button onClick={()=>fileRef.current?.click()} className="p-2 hover:bg-gray-100 rounded">📎</button>
      <input ref={fileRef} type="file" hidden accept="image/*,.pdf,.doc,.docx" />
      <input value={text} onChange={e=>{ setText(e.target.value); onType(); }} placeholder="Message…" className="flex-1 border rounded-full px-4 py-2 outline-none" />
      <button onClick={onSend} className="bg-black text-white rounded-full px-4 py-2">Send</button>
    </div>
  );
}


