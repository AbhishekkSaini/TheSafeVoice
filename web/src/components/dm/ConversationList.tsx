"use client";
import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { getSupabaseClient } from "@/lib/supabaseClient";

export type Profile = { id: string; username?: string | null; profile_pic?: string | null; bio?: string | null; online_status?: boolean | null };

export type ConversationItem = {
  other: Profile;
  lastMessage: string;
  updatedAt: string;
};

export default function ConversationList({
  meId,
  activeOtherId,
  onOpen,
}: {
  meId: string | null;
  activeOtherId?: string | null;
  onOpen: (other: Profile) => void;
}) {
  const [items, setItems] = useState<ConversationItem[]>([]);
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search) return items;
    const n = search.toLowerCase();
    return items.filter((it) => (it.other.username || "").toLowerCase().includes(n));
  }, [items, search]);

  useEffect(() => {
    if (!meId) return;
    const supabase = getSupabaseClient();
    let cancelled = false;

    async function load() {
      // Pull last 80 messages where I'm a participant, group by other user
      const { data: msgs } = await supabase
        .from("messages")
        .select("id, sender_id, receiver_id, body, created_at")
        .or(`sender_id.eq.${meId},receiver_id.eq.${meId}`)
        .order("created_at", { ascending: false })
        .limit(80);

      const map: Record<string, { last: string; at: string }> = {};
      (msgs || []).forEach((m: any) => {
        const otherId = m.sender_id === meId ? m.receiver_id : m.sender_id;
        if (!otherId) return;
        if (!map[otherId]) map[otherId] = { last: m.body || "", at: m.created_at };
      });
      const otherIds = Object.keys(map);
      if (otherIds.length === 0) {
        if (!cancelled) setItems([]);
        return;
      }
      const { data: users } = await supabase
        .from("profiles")
        .select("id, username, profile_pic, bio, online_status")
        .in("id", otherIds);
      const list: ConversationItem[] = (users || []).map((u: any) => ({
        other: u,
        lastMessage: map[u.id]?.last || "",
        updatedAt: map[u.id]?.at || new Date().toISOString(),
      }));
      list.sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt));
      if (!cancelled) setItems(list);
    }

    load();
    const t = setInterval(load, 15000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [meId]);

  return (
    <aside className="w-full md:w-80 border-r h-full flex flex-col">
      <div className="p-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search"
          className="w-full border rounded-full px-4 py-2 text-sm outline-none"
        />
      </div>
      <div className="flex-1 overflow-y-auto">
        {filtered.map((c) => {
          const isActive = c.other.id === activeOtherId;
          return (
            <button
              key={c.other.id}
              onClick={() => onOpen(c.other)}
              className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 ${
                isActive ? "bg-gray-100" : ""
              }`}
            >
              <Image
                src={c.other.profile_pic || "/avatar.png"}
                alt=""
                width={44}
                height={44}
                className="rounded-full"
              />
              <div className="flex-1 text-left min-w-0">
                <div className="flex items-center gap-2">
                  <div className="font-medium truncate">@{c.other.username || "member"}</div>
                  <div
                    className={`w-2 h-2 rounded-full ${
                      c.other.online_status ? "bg-green-500" : "bg-gray-300"
                    }`}
                  />
                </div>
                <div className="text-xs text-gray-500 truncate">{c.lastMessage || "Say hi"}</div>
              </div>
              <div className="text-[11px] text-gray-400">
                {new Date(c.updatedAt).toLocaleTimeString()}
              </div>
            </button>
          );
        })}
        {filtered.length === 0 && (
          <div className="px-4 py-8 text-sm text-gray-500">No conversations yet.</div>
        )}
      </div>
    </aside>
  );
}


