"use client";
import { useEffect, useState } from "react";
import ConversationList, { type Profile } from "@/components/dm/ConversationList";
import ChatWindow from "@/components/dm/ChatWindow";
import MessageInput from "@/components/dm/MessageInput";
import ProfileSidebar from "@/components/dm/ProfileSidebar";
import { getSupabaseClient } from "@/lib/supabaseClient";

export default function DMPage(){
  const supabase = getSupabaseClient();
  const [meId, setMeId] = useState<string|null>(null);
  const [other, setOther] = useState<Profile|null>(null);

  useEffect(()=>{
    supabase.auth.getUser().then(({data})=>{ setMeId(data?.user?.id || null); });
  },[supabase]);

  return (
    <div className="h-[calc(100vh-56px)] flex">
      <ConversationList meId={meId} activeOtherId={other?.id||null} onOpen={setOther} />
      <div className="flex-1 flex flex-col">
        <ChatWindow meId={meId} other={other} />
        <MessageInput meId={meId} otherId={other?.id||null} />
      </div>
        <ProfileSidebar meId={meId} other={other} />
    </div>
  );
}


