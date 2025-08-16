"use client";

import { useEffect, useMemo, useState } from "react";
import { getSupabaseClient } from "@/lib/supabaseClient";
import Link from "next/link";

type Post = {
  id: string;
  title: string;
  body: string;
  category: string | null;
  is_anonymous: boolean;
  author_display_name?: string | null;
  upvotes?: number | null;
  created_at: string;
  comments_count?: number | null;
};

const CATEGORIES = [
  { key: "", label: "All" },
  { key: "safety_tips", label: "Safety Tips" },
  { key: "legal_advice", label: "Legal Advice" },
  { key: "emergency_help", label: "SOS & Immediate Help" },
  { key: "survivor_stories", label: "Survivor Stories" },
];

export default function ForumPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState("");
  const [query, setQuery] = useState("");

  const fetchPosts = async () => {
    setLoading(true);
    setError(null);
    const supabase = getSupabaseClient();
    let q = supabase.from("posts_view").select("*").order("created_at", { ascending: false }).limit(50);
    if (category) q = q.eq("category", category);
    if (query) q = q.ilike("title", `%${query}%`);
    let { data, error } = await q;
    if (error) {
      // fallback to posts table
      let qp = supabase.from("posts").select("*").order("created_at", { ascending: false }).limit(50);
      if (category) qp = qp.eq("category", category);
      if (query) qp = qp.ilike("title", `%${query}%`);
      const r = await qp;
      error = r.error;
      data = (r.data || []).map((p) => ({ ...p, author_display_name: "", comments_count: 0 }));
    }
    if (error) setError(error.message);
    setPosts((data as Post[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchPosts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category]);

  const onSearch = useMemo(
    () =>
      debounce((v: string) => {
        setQuery(v);
      }, 250),
    []
  );

  useEffect(() => {
    fetchPosts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  return (
    <div className="max-w-3xl mx-auto p-6">
      <div className="flex items-center gap-3 mb-4">
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
        <input
          className="flex-1 border rounded px-3 py-2"
          placeholder="Search titles"
          onChange={(e) => onSearch(e.target.value)}
        />
        <Link href="/thread/new" className="bg-black text-white rounded px-3 py-2">
          New Post
        </Link>
      </div>

      {loading && <p>Loading…</p>}
      {error && <p className="text-red-600">{error}</p>}

      <div className="space-y-3">
        {posts.map((p) => (
          <article key={p.id} className="border rounded-xl p-4">
            <div className="flex items-center justify-between mb-1 text-sm text-gray-600">
              <span>{categoryBadge(p.category)}</span>
              <span>{new Date(p.created_at).toLocaleString()}</span>
            </div>
            <h3 className="font-semibold text-lg mb-1">{p.title}</h3>
            <p className="text-gray-700 mb-2">{truncate(p.body, 240)}</p>
            <div className="flex items-center justify-between text-sm text-gray-600">
              <div>
                by {p.is_anonymous ? "Anonymous" : p.author_display_name || "Member"}
              </div>
              <div className="flex items-center gap-4">
                <div>💬 {p.comments_count || 0}</div>
                <div>⬆️ {p.upvotes || 0}</div>
                <Link href={`/thread/${p.id}`} className="px-3 py-1 border rounded">
                  Open
                </Link>
              </div>
            </div>
          </article>
        ))}
        {!loading && posts.length === 0 && (
          <p className="text-gray-600">No posts yet.</p>
        )}
      </div>
    </div>
  );
}

function categoryBadge(k: string | null) {
  const found = CATEGORIES.find((c) => c.key === k);
  return found?.label || "General";
}

function truncate(s: string, n: number) {
  if (!s) return "";
  return s.length > n ? s.slice(0, n) + "…" : s;
}

function debounce<TArgs extends unknown[]>(
  fn: (...args: TArgs) => void,
  wait: number
) {
  let t: ReturnType<typeof setTimeout> | null = null;
  return (...args: TArgs) => {
    if (t) clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
}


