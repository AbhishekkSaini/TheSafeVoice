"use client";
import Image from "next/image";
import type { Profile } from "./ConversationList";
import { getSupabaseClient } from "@/lib/supabaseClient";
import { useEffect, useState } from "react";

export default function ProfileSidebar({ meId, other }: { meId: string | null; other: Profile | null }) {
  const supabase = getSupabaseClient();
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    if (!meId || !other?.id) return;
    (async () => {
      const { data } = await supabase
        .from("user_blocks")
        .select("blocker_id")
        .eq("blocker_id", meId)
        .eq("blocked_id", other.id)
        .maybeSingle();
      setBlocked(!!data);
    })();
  }, [meId, other?.id, supabase]);

  async function toggle() {
    if (!meId || !other?.id) return;
    if (blocked) {
      await supabase.from("user_blocks").delete().eq("blocker_id", meId).eq("blocked_id", other.id);
      setBlocked(false);
    } else {
      await supabase.from("user_blocks").insert({ blocker_id: meId, blocked_id: other.id });
      setBlocked(true);
    }
  }

  if (!other) return <aside className="w-80 border-l hidden lg:block" />;

  return (
    <aside className="w-80 border-l hidden lg:flex flex-col">
      <div className="p-6 flex flex-col items-center gap-3">
        <Image src={other.profile_pic || "/avatar.png"} width={72} height={72} alt="" className="rounded-full" />
        <div className="font-semibold">@{other.username || "member"}</div>
        <div className="text-sm text-gray-600 text-center">{other.bio || "—"}</div>
        <button
          onClick={toggle}
          className={`px-4 py-2 rounded-full border ${blocked ? "bg-red-50 border-red-200 text-red-600" : "hover:bg-gray-50"}`}
        >
          {blocked ? "Unblock" : "Block"}
        </button>
      </div>
    </aside>
  );
}


