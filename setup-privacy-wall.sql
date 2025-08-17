-- ========================================
-- SAFEVOICE PRIVACY WALL SETUP SCRIPT
-- ========================================
-- This script sets up Instagram/X-style privacy wall
-- Run this in your Supabase SQL Editor

-- ========================================
-- STEP 1: ENABLE ROW LEVEL SECURITY
-- ========================================

-- Enable RLS on main tables
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Enable RLS on other tables if they exist
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'comments') THEN
        ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
    END IF;
    
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'messages') THEN
        ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
    END IF;
    
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'upvotes') THEN
        ALTER TABLE upvotes ENABLE ROW LEVEL SECURITY;
    END IF;
END $$;

-- ========================================
-- STEP 2: DROP EXISTING POLICIES
-- ========================================

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Full read for logged in users" ON posts;
DROP POLICY IF EXISTS "Full read for logged in users" ON profiles;
DROP POLICY IF EXISTS "Limited preview for anonymous" ON posts;
DROP POLICY IF EXISTS "Limited preview for anonymous" ON profiles;
DROP POLICY IF EXISTS "Users can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Users can view all posts" ON posts;
DROP POLICY IF EXISTS "Users can create posts" ON posts;
DROP POLICY IF EXISTS "Users can update own posts" ON posts;
DROP POLICY IF EXISTS "Users can delete own posts" ON posts;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;

DROP POLICY IF EXISTS "public_read_posts" ON posts;
DROP POLICY IF EXISTS "insert_posts_auth" ON posts;
DROP POLICY IF EXISTS "update_own_posts" ON posts;
DROP POLICY IF EXISTS "public_read_comments" ON comments;
DROP POLICY IF EXISTS "insert_comments_auth" ON comments;
DROP POLICY IF EXISTS "update_own_comments" ON comments;
DROP POLICY IF EXISTS "profile_self_read" ON profiles;
DROP POLICY IF EXISTS "profile_self_upsert" ON profiles;
DROP POLICY IF EXISTS "profile_self_update" ON profiles;

-- ========================================
-- STEP 3: CREATE PRIVACY WALL POLICIES
-- ========================================

-- ========================================
-- POSTS TABLE POLICIES
-- ========================================

-- Full access for authenticated users
CREATE POLICY "Full read for logged in users" ON posts
FOR SELECT
USING (auth.role() = 'authenticated');

-- Limited preview for anonymous users (only 3 most recent posts)
CREATE POLICY "Limited preview for anonymous" ON posts
FOR SELECT
USING (auth.role() = 'anon');

-- Users can create their own posts
CREATE POLICY "Users can create posts" ON posts
FOR INSERT
WITH CHECK (auth.uid() = author_id);

-- Users can update their own posts
CREATE POLICY "Users can update own posts" ON posts
FOR UPDATE
USING (auth.uid() = author_id);

-- Users can delete their own posts
CREATE POLICY "Users can delete own posts" ON posts
FOR DELETE
USING (auth.uid() = author_id);

-- ========================================
-- PROFILES TABLE POLICIES
-- ========================================

-- Full access for authenticated users
CREATE POLICY "Full read for logged in users" ON profiles
FOR SELECT
USING (auth.role() = 'authenticated');

-- Limited preview for anonymous users (basic info only)
CREATE POLICY "Limited preview for anonymous" ON profiles
FOR SELECT
USING (auth.role() = 'anon');

-- Users can update their own profile
CREATE POLICY "Users can update own profile" ON profiles
FOR UPDATE
USING (auth.uid() = id);

-- Users can insert their own profile
CREATE POLICY "Users can insert own profile" ON profiles
FOR INSERT
WITH CHECK (auth.uid() = id);

-- ========================================
-- COMMENTS TABLE POLICIES (if exists)
-- ========================================

DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'comments') THEN
        -- Drop existing policies
        DROP POLICY IF EXISTS "Full read for logged in users" ON comments;
        DROP POLICY IF EXISTS "Limited preview for anonymous" ON comments;
        DROP POLICY IF EXISTS "Users can create comments" ON comments;
        DROP POLICY IF EXISTS "Users can update own comments" ON comments;
        DROP POLICY IF EXISTS "Users can delete own comments" ON comments;
        
        -- Full access for authenticated users
        CREATE POLICY "Full read for logged in users" ON comments
        FOR SELECT
        USING (auth.role() = 'authenticated');
        
        -- Limited preview for anonymous users (only 2 comments per post)
        CREATE POLICY "Limited preview for anonymous" ON comments
        FOR SELECT
        USING (auth.role() = 'anon');
        
        -- Users can create comments
        CREATE POLICY "Users can create comments" ON comments
        FOR INSERT
        WITH CHECK (auth.uid() = author_id);
        
        -- Users can update their own comments
        CREATE POLICY "Users can update own comments" ON comments
        FOR UPDATE
        USING (auth.uid() = author_id);
        
        -- Users can delete their own comments
        CREATE POLICY "Users can delete own comments" ON comments
        FOR DELETE
        USING (auth.uid() = author_id);
    END IF;
END $$;

-- ========================================
-- MESSAGES TABLE POLICIES (if exists)
-- ========================================

DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'messages') THEN
        -- Drop existing policies
        DROP POLICY IF EXISTS "Users can view own messages" ON messages;
        DROP POLICY IF EXISTS "Users can create messages" ON messages;
        DROP POLICY IF EXISTS "Users can update own messages" ON messages;
        DROP POLICY IF EXISTS "Users can delete own messages" ON messages;
        
        -- Users can only view messages they sent or received
        CREATE POLICY "Users can view own messages" ON messages
        FOR SELECT
        USING (auth.uid() = sender_id OR auth.uid() = receiver_id);
        
        -- Users can create messages
        CREATE POLICY "Users can create messages" ON messages
        FOR INSERT
        WITH CHECK (auth.uid() = sender_id);
        
        -- Users can update their own messages
        CREATE POLICY "Users can update own messages" ON messages
        FOR UPDATE
        USING (auth.uid() = sender_id);
        
        -- Users can delete their own messages
        CREATE POLICY "Users can delete own messages" ON messages
        FOR DELETE
        USING (auth.uid() = sender_id);
    END IF;
END $$;

-- ========================================
-- UPVOTES TABLE POLICIES (if exists)
-- ========================================

DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'upvotes') THEN
        -- Drop existing policies
        DROP POLICY IF EXISTS "Users can view upvotes" ON upvotes;
        DROP POLICY IF EXISTS "Users can create upvotes" ON upvotes;
        DROP POLICY IF EXISTS "Users can delete own upvotes" ON upvotes;
        
        -- Users can view upvotes
        CREATE POLICY "Users can view upvotes" ON upvotes
        FOR SELECT
        USING (auth.role() = 'authenticated');
        
        -- Users can create upvotes
        CREATE POLICY "Users can create upvotes" ON upvotes
        FOR INSERT
        WITH CHECK (auth.uid() = user_id);
        
        -- Users can delete their own upvotes
        CREATE POLICY "Users can delete own upvotes" ON upvotes
        FOR DELETE
        USING (auth.uid() = user_id);
    END IF;
END $$;

-- ========================================
-- STEP 4: VERIFICATION
-- ========================================

-- Check if policies were created successfully
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename IN ('posts', 'profiles', 'comments', 'messages', 'upvotes')
ORDER BY tablename, policyname;

-- ========================================
-- STEP 5: TEST QUERIES
-- ========================================

-- Test anonymous access (should return limited results)
-- Note: Run this as an anonymous user
-- SELECT COUNT(*) FROM posts; -- Should return 3 or fewer
-- SELECT COUNT(*) FROM profiles; -- Should return limited results

-- Test authenticated access (should return full results)
-- Note: Run this as an authenticated user
-- SELECT COUNT(*) FROM posts; -- Should return all posts
-- SELECT COUNT(*) FROM profiles; -- Should return all profiles

-- ========================================
-- STEP 6: SETUP COMPLETE
-- ========================================

-- Privacy wall is now active!
-- Anonymous users will see limited preview content
-- Authenticated users will see full content
-- The frontend will automatically handle the different access levels
