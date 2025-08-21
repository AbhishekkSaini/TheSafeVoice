# Migration Guide - Fix Post Functionality

## Main Issues Identified

1. **Messaging System**: The database schema is missing required columns and tables that the messaging functions expect.
2. **Forum Posting**: The forum posting functionality is not working due to database schema and RLS policy issues.

## Required Migrations

You need to run two migrations to fix both the messaging and forum posting functionality:

1. **`complete_messaging_storage.sql`** - For messaging system
2. **`fix_search_views.sql`** - For forum posting functionality

### Steps to Fix:

1. **Open your Supabase Dashboard**
   - Go to your Supabase project dashboard
   - Navigate to the SQL Editor

2. **Run the First Migration (Messaging)**
   - Copy the contents of `sql/complete_messaging_storage.sql`
   - Paste it into the SQL Editor
   - Click "Run" to execute the migration

3. **Run the Second Migration (Forum)**
   - Copy the contents of `sql/fix_search_views.sql`
   - Paste it into the SQL Editor
   - Click "Run" to execute the migration

4. **Verify the Migrations**
   - **Messaging Migration** will add:
     - `temp_id` column (for temporary message IDs)
     - `status` column (for message status like 'sent', 'delivered', 'read')
     - `read_at` column (timestamp when message was read)
     - `delivered_at` column (timestamp when message was delivered)
     - `conversations` table (for managing chat conversations)
     - `online_users` table (for tracking user online status)
     - Required database functions for messaging

   - **Forum Migration** will fix:
     - `posts_view` and `comments_view` creation
     - RLS policies for forum posting
     - Proper permissions for authenticated users

5. **Test the Fixes**
   - **For Messaging**: Open `web/public/test-message-storage-complete.html`
   - **For Forum Posting**: Open `web/public/test-forum-posting.html`
   - Both test pages will show diagnostic information about what's working

## What the Migrations Do

### `complete_messaging_storage.sql`:

1. **Adds missing columns** to the messages table
2. **Creates new tables** for conversation management
3. **Sets up database functions** for:
   - `send_message_with_storage()` - Sends messages with permanent storage
   - `get_conversation_list()` - Gets list of conversations (like Instagram)
   - `get_message_history()` - Gets message history between users
   - `mark_messages_as_read()` - Marks messages as read
   - `update_online_status()` - Updates user online status

4. **Sets up proper permissions** and Row Level Security (RLS)

### `fix_search_views.sql`:

1. **Fixes posts_view and comments_view** - Recreates them without SECURITY DEFINER
2. **Updates RLS policies** - Ensures proper permissions for forum posting
3. **Grants necessary permissions** - Allows authenticated users to create posts
4. **Refreshes schema cache** - Ensures PostgREST recognizes the changes

## Alternative: Quick Fix

If you want to test immediately without running the full migrations, you can manually fix the most common issues:

```sql
-- Fix forum posting (if posts_view doesn't exist)
CREATE OR REPLACE VIEW public.posts_view AS
SELECT 
    p.id, p.title, p.body, p.category, p.is_anonymous, p.created_at, p.upvotes, p.author_id,
    CASE 
        WHEN p.is_anonymous THEN 'Anonymous'
        ELSE COALESCE(pr.display_name, 'Member')
    END as author_display_name,
    COALESCE(comment_counts.count, 0) as comments_count
FROM public.posts p
LEFT JOIN public.profiles pr ON p.author_id = pr.id
LEFT JOIN (
    SELECT post_id, COUNT(*) as count 
    FROM public.comments 
    GROUP BY post_id
) comment_counts ON p.id = comment_counts.post_id;

-- Fix RLS policies for forum posting
DROP POLICY IF EXISTS "insert_posts_auth" ON public.posts;
CREATE POLICY "insert_posts_auth" ON public.posts
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Grant permissions
GRANT SELECT ON public.posts_view TO anon, authenticated;
```

However, the full migrations are recommended as they set up the complete system properly.

## After Migration

Once you've run both migrations:

1. **Forum posting** should work properly
2. **Messaging system** will work with permanent storage (like Instagram)
3. **Conversation management** will be available
4. **Real-time messaging** will work with persistent storage
5. **All database views** will be properly configured

## Troubleshooting

If you still have issues after running the migration:

1. Check the browser console for any JavaScript errors
2. Verify that the Supabase configuration in `js/config.js` is correct
3. Make sure you're authenticated (logged in) before testing
4. Check the test page diagnostics for specific error messages
