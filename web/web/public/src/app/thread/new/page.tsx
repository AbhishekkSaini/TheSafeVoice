"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabaseClient";

const CATEGORIES = [
  { key: "safety_tips", label: "Safety Tips" },
  { key: "legal_advice", label: "Legal Advice" },
  { key: "emergency_help", label: "SOS & Immediate Help" },
  { key: "survivor_stories", label: "Survivor Stories" },
];

export default function NewThreadPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState<string>(CATEGORIES[0].key);
  const [anon, setAnon] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const supabase = getSupabaseClient();
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) router.push("/login");
    });
  }, [router]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !body.trim()) return;
    setLoading(true);
    setError(null);
    const supabase = getSupabaseClient();
    const user = (await supabase.auth.getUser()).data.user;
    const { data, error } = await supabase
      .from("posts")
      .insert({
        title: title.trim(),
        body: body.trim(),
        category,
        is_anonymous: anon,
        author_id: user?.id || null,
      })
      .select("id")
      .single();
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }
    router.push(`/thread/${data?.id}`);
  };

  return (
    <div className="max-w-3xl mx-auto p-6">
      <h1 className="text-2xl font-semibold mb-4">New Post</h1>
      <form onSubmit={onSubmit} className="space-y-3">
        <input
          className="w-full border rounded px-3 py-2"
          placeholder="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <textarea
          className="w-full border rounded px-3 py-2 h-40"
          placeholder="Write your content"
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
        <div className="flex items-center gap-3">
          <select
            className="border rounded px-3 py-2"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            {CATEGORIES.map((c) => (
              <option key={c.key} value={c.key}>
                {c.label}
              </option>
            ))}
          </select>
          <label className="inline-flex items-center gap-2 text-sm">
            <input type="checkbox" checked={anon} onChange={(e) => setAnon(e.target.checked)} />
            Post as anonymous
          </label>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button className="bg-black text-white rounded px-4 py-2" disabled={loading}>
          {loading ? "Publishing…" : "Publish"}
        </button>
      </form>
    </div>
  );
}


