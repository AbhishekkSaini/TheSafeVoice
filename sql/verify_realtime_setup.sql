-- Verify SafeVoice Real-time Setup
-- Run this after the fix_all_realtime_errors.sql script

-- Check real-time tables
SELECT 
    'REALTIME TABLES' as category,
    tablename as item,
    '✅ Enabled' as status
FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime'
AND tablename IN ('messages', 'online_users')

UNION ALL

SELECT 
    'MISSING REALTIME TABLES' as category,
    table_name as item,
    '❌ Not Enabled' as status
FROM (VALUES ('messages'), ('online_users')) AS t(table_name)
WHERE table_name NOT IN (
    SELECT tablename 
    FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime'
);

-- Check functions
SELECT 
    'FUNCTIONS' as category,
    routine_name as item,
    '✅ Exists' as status
FROM information_schema.routines 
WHERE routine_schema = 'public'
AND routine_name IN (
    'update_online_status',
    'get_conversation_list', 
    'get_message_history',
    'mark_messages_as_read',
    'send_message_with_storage'
)

UNION ALL

SELECT 
    'MISSING FUNCTIONS' as category,
    function_name as item,
    '❌ Missing' as status
FROM (VALUES 
    ('update_online_status'),
    ('get_conversation_list'),
    ('get_message_history'),
    ('mark_messages_as_read'),
    ('send_message_with_storage')
) AS f(function_name)
WHERE function_name NOT IN (
    SELECT routine_name
    FROM information_schema.routines 
    WHERE routine_schema = 'public'
);

-- Check tables
SELECT 
    'TABLES' as category,
    table_name as item,
    '✅ Exists' as status
FROM information_schema.tables 
WHERE table_schema = 'public'
AND table_name = 'online_users'

UNION ALL

SELECT 
    'MISSING TABLES' as category,
    'online_users' as item,
    '❌ Missing' as status
WHERE NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'online_users'
);

-- Check RLS policies
SELECT 
    'RLS POLICIES' as category,
    policyname as item,
    '✅ Exists' as status
FROM pg_policies 
WHERE tablename = 'online_users'
AND policyname IN ('view_online_status', 'update_own_online_status', 'insert_own_online_status')

UNION ALL

SELECT 
    'MISSING POLICIES' as category,
    policy_name as item,
    '❌ Missing' as status
FROM (VALUES 
    ('view_online_status'),
    ('update_own_online_status'),
    ('insert_own_online_status')
) AS p(policy_name)
WHERE policy_name NOT IN (
    SELECT policyname
    FROM pg_policies 
    WHERE tablename = 'online_users'
);

-- Final status
SELECT 
    'FINAL STATUS' as category,
    CASE 
        WHEN (
            SELECT COUNT(*) FROM pg_publication_tables 
            WHERE pubname = 'supabase_realtime' 
            AND tablename IN ('messages', 'online_users')
        ) = 2
        AND (
            SELECT COUNT(*) FROM information_schema.routines 
            WHERE routine_schema = 'public'
            AND routine_name IN (
                'update_online_status',
                'get_conversation_list', 
                'get_message_history',
                'mark_messages_as_read',
                'send_message_with_storage'
            )
        ) = 5
        AND (
            SELECT COUNT(*) FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'online_users'
        ) = 1
        AND (
            SELECT COUNT(*) FROM pg_policies 
            WHERE tablename = 'online_users'
            AND policyname IN ('view_online_status', 'update_own_online_status', 'insert_own_online_status')
        ) = 3
        THEN '🎉 COMPLETE - Real-time messaging ready!'
        ELSE '⚠️ INCOMPLETE - Check missing items above'
    END as item,
    'Status' as status;
