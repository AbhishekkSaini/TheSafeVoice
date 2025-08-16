"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabaseClient";

type Post = {
  id: string;
  title: string;
  body: string;
  category: string | null;
  is_anonymous: boolean;
  upvotes?: number | null;
  downvotes?: number | null;
  reshares?: number | null;
  author_display_name?: string | null;
  created_at: string;
};

type Comment = {
  id: string;
  post_id: string;
  body: string;
  is_anonymous: boolean;
  author_display_name?: string | null;
  created_at: string;
};

export default function ThreadPage() {
  const params = useParams<{ id: string }>();
  const postId = params?.id as string;

  const [post, setPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [comment, setComment] = useState("");
  const [anon, setAnon] = useState(false);

  const fetchPost = async () => {
    setError(null);
    const supabase = getSupabaseClient();
    const { data, error: fetchError } = await supabase
      .from("posts_view")
      .select("*")
      .eq("id", postId)
      .single();
    if (fetchError) {
      setError(fetchError.message);
    }
     setPost((data as Post) || null);
  };

  const fetchComments = async () => {
    const supabase = getSupabaseClient();
    const r = await supabase
      .from("comments_view")
      .select("*")
      .eq("post_id", postId)
      .order("created_at", { ascending: true });
    if (r.error) {
      setError(r.error.message);
      return;
    }
    setComments((r.data as Comment[]) || []);
  };

  useEffect(() => {
    if (!postId) return;
    (async () => {
      setLoading(true);
      await fetchPost();
      await fetchComments();
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postId]);

  const submitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!comment.trim()) return;
    const supabase = getSupabaseClient();
    const user = (await supabase.auth.getUser()).data.user;
    const { error } = await supabase.from("comments").insert({
      post_id: postId,
      body: comment.trim(),
      is_anonymous: anon,
      author_id: user?.id || null,
    });
    if (error) {
      setError(error.message);
      return;
    }
    setComment("");
    await fetchComments();
  };

  const vote = async (kind: "up" | "down" | "re") => {
    const supabase = getSupabaseClient();
    const fn =
      kind === "up" ? "post_upvote" : kind === "down" ? "post_downvote" : "post_reshare";
    await supabase.rpc(fn, { p_id: postId });
    await fetchPost();
  };

  if (loading) return <div className="p-6">Loading…</div>;
  if (!post) return <div className="p-6">Not found</div>;

  const author = post.is_anonymous ? "Anonymous" : post.author_display_name || "Member";

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-4">
      <article className="border rounded-xl p-4">
        <div className="flex items-center justify-between mb-2 text-sm text-gray-600">
          <span>{post.category || "General"}</span>
          <span>{new Date(post.created_at).toLocaleString()}</span>
        </div>
        <h1 className="text-2xl font-semibold mb-2">{post.title}</h1>
        <p className="text-gray-800">{post.body}</p>
        <div className="mt-3 text-sm text-gray-600">by {author}</div>
        <div className="mt-4 flex items-center gap-2 text-sm">
          <button className="border rounded px-3 py-1" onClick={() => vote("up")}>
            ▲ {post.upvotes || 0}
          </button>
          <button className="border rounded px-3 py-1" onClick={() => vote("down")}>
            ▼ {post.downvotes || 0}
          </button>
          <button className="border rounded px-3 py-1" onClick={() => vote("re")}>
            ↻ {post.reshares || 0}
          </button>
        </div>
      </article>

      <section>
        <h2 className="font-semibold mb-2">Comments</h2>
        <div className="space-y-3 mb-4">
          {comments.map((c) => (
            <div key={c.id} className="border rounded-xl p-3">
              <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                <div>{c.is_anonymous ? "Anonymous" : c.author_display_name || "Member"}</div>
                <div>{new Date(c.created_at).toLocaleString()}</div>
              </div>
              <div>{c.body}</div>
            </div>
          ))}
          {comments.length === 0 && <p className="text-gray-600">No comments yet.</p>}
        </div>

        <form onSubmit={submitComment} className="space-y-2">
          <textarea
            className="w-full border rounded px-3 py-2"
            placeholder="Write a comment"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
          />
          <label className="inline-flex items-center gap-2 text-sm">
            <input type="checkbox" checked={anon} onChange={(e) => setAnon(e.target.checked)} />
            Post as anonymous
          </label>
          <div>
            <button className="bg-black text-white rounded px-4 py-2">Comment</button>
          </div>
        </form>
      </section>
    </div>
  );
}


