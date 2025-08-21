-- Check SafeVoice Real-time Status
-- This script shows what's already configured and what needs to be done

-- Check which tables are already in realtime publication
SELECT 
    'Realtime Tables Status' as check_type,
    tablename as table_name,
    CASE 
        WHEN tablename IS NOT NULL THEN '✅ Enabled'
        ELSE '❌ Not Enabled'
    END as status
FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime'
AND tablename IN ('messages', 'online_users')

UNION ALL

SELECT 
    'Missing Tables' as check_type,
    table_name,
    '❌ Not Enabled' as status
FROM (VALUES ('messages'), ('online_users')) AS t(table_name)
WHERE table_name NOT IN (
    SELECT tablename 
    FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime'
);

-- Check if required functions exist
SELECT 
    'Functions Status' as check_type,
    routine_name as function_name,
    CASE 
        WHEN routine_name IS NOT NULL THEN '✅ Exists'
        ELSE '❌ Missing'
    END as status
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
    'Missing Functions' as check_type,
    function_name,
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

-- Check if online_users table exists
SELECT 
    'Tables Status' as check_type,
    table_name,
    CASE 
        WHEN table_name IS NOT NULL THEN '✅ Exists'
        ELSE '❌ Missing'
    END as status
FROM information_schema.tables 
WHERE table_schema = 'public'
AND table_name = 'online_users'

UNION ALL

SELECT 
    'Missing Tables' as check_type,
    'online_users' as table_name,
    '❌ Missing' as status
WHERE NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'online_users'
);

-- Check RLS policies for online_users
SELECT 
    'RLS Policies' as check_type,
    policyname as policy_name,
    CASE 
        WHEN policyname IS NOT NULL THEN '✅ Exists'
        ELSE '❌ Missing'
    END as status
FROM pg_policies 
WHERE tablename = 'online_users'
AND policyname IN ('view_online_status', 'update_own_online_status', 'insert_own_online_status')

UNION ALL

SELECT 
    'Missing Policies' as check_type,
    policy_name,
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

-- Summary
SELECT 
    'SUMMARY' as check_type,
    'Real-time Setup Status' as function_name,
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
        THEN '✅ COMPLETE - Ready for real-time messaging!'
        ELSE '⚠️ INCOMPLETE - Run the safe migration script'
    END as status;
