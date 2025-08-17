-- Fix Search Issues: Security Definer Views and RLS
-- Run this in Supabase SQL Editor

-- 1. Drop and recreate posts_view without SECURITY DEFINER
DROP VIEW IF EXISTS public.posts_view;

CREATE VIEW public.posts_view AS
SELECT 
    p.id,
    p.title,
    p.body,
    p.category,
    p.is_anonymous,
    p.created_at,
    p.updated_at,
    p.upvotes,
    p.author_id,
    CASE 
        WHEN p.is_anonymous THEN 'Anonymous'
        ELSE COALESCE(pr.display_name, pr.username, 'Member')
    END as author_display_name,
    COALESCE(comment_counts.count, 0) as comments_count
FROM public.posts p
LEFT JOIN public.profiles pr ON p.author_id = pr.id
LEFT JOIN (
    SELECT post_id, COUNT(*) as count 
    FROM public.comments 
    GROUP BY post_id
) comment_counts ON p.id = comment_counts.post_id;

-- 2. Drop and recreate comments_view without SECURITY DEFINER
DROP VIEW IF EXISTS public.comments_view;

CREATE VIEW public.comments_view AS
SELECT 
    c.id,
    c.post_id,
    c.body,
    c.created_at,
    c.updated_at,
    c.upvotes,
    c.author_id,
    CASE 
        WHEN c.is_anonymous THEN 'Anonymous'
        ELSE COALESCE(pr.display_name, pr.username, 'Member')
    END as author_display_name
FROM public.comments c
LEFT JOIN public.profiles pr ON c.author_id = pr.id;

-- 3. Enable RLS on profile_username_changes table
ALTER TABLE public.profile_username_changes ENABLE ROW LEVEL SECURITY;

-- 4. Add RLS policy for profile_username_changes
DROP POLICY IF EXISTS "Users can view their own username changes" ON public.profile_username_changes;
CREATE POLICY "Users can view their own username changes" ON public.profile_username_changes
    FOR SELECT USING (auth.uid() = user_id);

-- 5. Add public read policies for search functionality
-- Allow public read access to profiles for search
DROP POLICY IF EXISTS "Allow public read profiles" ON public.profiles;
CREATE POLICY "Allow public read profiles" ON public.profiles
    FOR SELECT USING (true);

-- Allow public read access to posts for search
DROP POLICY IF EXISTS "Allow public read posts" ON public.posts;
CREATE POLICY "Allow public read posts" ON public.posts
    FOR SELECT USING (true);

-- 6. Grant necessary permissions
GRANT SELECT ON public.posts_view TO anon, authenticated;
GRANT SELECT ON public.comments_view TO anon, authenticated;
GRANT SELECT ON public.profiles TO anon, authenticated;
GRANT SELECT ON public.posts TO anon, authenticated;

-- 7. Refresh the schema cache
NOTIFY pgrst, 'reload schema';
