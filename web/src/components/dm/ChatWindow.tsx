"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { getSupabaseClient } from "@/lib/supabaseClient";
import type { Profile } from "./ConversationList";

type Msg = {
  id: string;
  sender_id: string;
  receiver_id: string;
  body: string | null;
  attachment_url?: string | null;
  seen: boolean;
  created_at: string;
};

export default function ChatWindow({
  meId,
  other,
}: {
  meId: string | null;
  other: Profile | null;
}) {
  const supabase = getSupabaseClient();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [typing, setTyping] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const otherId = other?.id || null;
  const pairKey = useMemo(() => (meId && otherId ? `${meId}:${otherId}` : null), [meId, otherId]);

  useEffect(() => {
    if (!meId || !otherId) return;
    let cancelled = false;
    async function load() {
      const { data } = await supabase
        .from("messages")
        .select("id,sender_id,receiver_id,body,attachment_url,seen,created_at")
        .or(`and(sender_id.eq.${meId},receiver_id.eq.${otherId}),and(sender_id.eq.${otherId},receiver_id.eq.${meId})`)
        .order("created_at", { ascending: true });
      if (!cancelled) setMessages((data as Msg[]) || []);
      // Mark inbound unseen as seen
      await supabase
        .from("messages")
        .update({ seen: true })
        .eq("receiver_id", meId)
        .eq("sender_id", otherId)
        .eq("seen", false);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [meId, otherId, supabase]);

  useEffect(() => {
    if (!meId || !otherId) return;
    // Inbound
    const chIn = supabase
      .channel(`dm:in:${otherId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `receiver_id=eq.${meId}` },
        (pl) => {
          const m = pl.new as Msg;
          if (m.sender_id !== otherId) return;
          setMessages((prev) => [...prev, m]);
          scrollBottom();
        }
      )
      .subscribe();

    // Outbound (reflect my sent rows)
    const chOut = supabase
      .channel(`dm:out:${otherId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `receiver_id=eq.${otherId}` },
        (pl) => {
          const m = pl.new as Msg;
          if (m.sender_id !== meId) return;
          setMessages((prev) => [...prev, m]);
          scrollBottom();
        }
      )
      .subscribe();

    // Typing broadcast
    let typingTimeout: any;
    const typingChannel = supabase.channel(`typing:${meId}:${otherId}`, { config: { broadcast: { self: true } } });
    typingChannel.on("broadcast", { event: "typing" }, (p) => {
      if (p?.userId === otherId) return; // self safeguard
      // Show when other types
      setTyping(true);
      clearTimeout(typingTimeout);
      typingTimeout = setTimeout(() => setTyping(false), 1500);
    });
    typingChannel.subscribe();

    return () => {
      supabase.removeChannel(chIn);
      supabase.removeChannel(chOut);
      try {
        typingChannel.unsubscribe();
      } catch {}
    };
  }, [meId, other?.id, supabase]);

  useEffect(() => {
    scrollBottom();
  }, [messages.length]);

  function scrollBottom() {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }

  if (!other) {
    return <div className="flex-1 grid place-items-center text-gray-500">Select a conversation</div>;
  }

  return (
    <section className="flex-1 flex flex-col h-full">
      <header className="h-14 border-b px-4 flex items-center gap-3">
        <Image src={other.profile_pic || "/avatar.png"} width={32} height={32} alt="" className="rounded-full" />
        <div className="font-semibold">@{other.username || "member"}</div>
        <div className={`ml-2 w-2 h-2 rounded-full ${other.online_status ? "bg-green-500" : "bg-gray-300"}`} />
        {typing && <div className="ml-3 text-xs text-gray-500">Typing…</div>}
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2 bg-white">
        {messages.map((m) => {
          const mine = m.sender_id === meId;
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[75%] rounded-2xl px-3 py-2 ${mine ? "bg-black text-white" : "bg-white border"}`}>
                {m.attachment_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={m.attachment_url} alt="" className="rounded mb-1 max-h-64 object-cover" />
                )}
                {m.body && <div className="whitespace-pre-wrap break-words">{m.body}</div>}
                <div className="text-[10px] opacity-60 mt-1">
                  {new Date(m.created_at).toLocaleTimeString()} {mine ? (m.seen ? "✓✓" : "✓") : ""}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
    </section>
  );
}


