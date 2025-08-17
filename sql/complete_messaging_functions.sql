-- Complete Messaging Functions - Add these to fix_messaging_system.sql
-- These functions ensure messages are stored and retrieved like Instagram

-- Function to get recent conversations with unread counts (like Instagram's conversation list)
CREATE OR REPLACE FUNCTION get_recent_conversations(limit_count int DEFAULT 20, offset_count int DEFAULT 0)
RETURNS TABLE (
    other_user_id uuid,
    other_user_name text,
    last_message text,
    last_message_time timestamp with time zone,
    unread_count bigint,
    is_online boolean
) AS $$
BEGIN
    RETURN QUERY
    WITH conversation_summaries AS (
        SELECT 
            CASE 
                WHEN m.sender_id = auth.uid() THEN m.receiver_id 
                ELSE m.sender_id 
            END as other_user_id,
            m.body as last_message,
            m.created_at as last_message_time,
            ROW_NUMBER() OVER (
                PARTITION BY 
                    CASE 
                        WHEN m.sender_id = auth.uid() THEN m.receiver_id 
                        ELSE m.sender_id 
                    END 
                ORDER BY m.created_at DESC
            ) as rn
        FROM messages m
        WHERE m.sender_id = auth.uid() OR m.receiver_id = auth.uid()
    ),
    unread_counts AS (
        SELECT 
            sender_id as other_user_id,
            COUNT(*) as unread_count
        FROM messages 
        WHERE receiver_id = auth.uid() AND status != 'read'
        GROUP BY sender_id
    )
    SELECT 
        cs.other_user_id,
        p.display_name,
        cs.last_message,
        cs.last_message_time,
        COALESCE(uc.unread_count, 0) as unread_count,
        ou.is_online AND ou.last_seen > now() - interval '5 minutes' as is_online
    FROM conversation_summaries cs
    JOIN profiles p ON p.id = cs.other_user_id
    LEFT JOIN unread_counts uc ON uc.other_user_id = cs.other_user_id
    LEFT JOIN online_users ou ON ou.user_id = cs.other_user_id
    WHERE cs.rn = 1
    ORDER BY cs.last_message_time DESC
    LIMIT limit_count OFFSET offset_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get all messages for a conversation (like Instagram's chat history)
CREATE OR REPLACE FUNCTION get_messages(other_user_id uuid, limit_count int DEFAULT 50, offset_count int DEFAULT 0)
RETURNS TABLE (
    id uuid,
    sender_id uuid,
    receiver_id uuid,
    body text,
    status text,
    created_at timestamp with time zone,
    read_at timestamp with time zone,
    delivered_at timestamp with time zone
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        m.id,
        m.sender_id,
        m.receiver_id,
        m.body,
        m.status,
        m.created_at,
        m.read_at,
        m.delivered_at
    FROM messages m
    WHERE (m.sender_id = auth.uid() AND m.receiver_id = other_user_id)
       OR (m.sender_id = other_user_id AND m.receiver_id = auth.uid())
    ORDER BY m.created_at ASC  -- Show oldest first (like Instagram)
    LIMIT limit_count OFFSET offset_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user profile by ID
CREATE OR REPLACE FUNCTION get_user_profile(user_id uuid)
RETURNS TABLE (
    id uuid,
    display_name text,
    email text,
    online_status boolean,
    last_seen timestamp with time zone
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id,
        p.display_name,
        p.email,
        ou.is_online AND ou.last_seen > now() - interval '5 minutes' as online_status,
        ou.last_seen
    FROM profiles p
    LEFT JOIN online_users ou ON ou.user_id = p.id
    WHERE p.id = user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions for new functions
GRANT EXECUTE ON FUNCTION get_recent_conversations(int, int) TO authenticated;
GRANT EXECUTE ON FUNCTION get_messages(uuid, int, int) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_profile(uuid) TO authenticated;

-- Add comments
COMMENT ON FUNCTION get_recent_conversations IS 'Get recent conversations with unread counts for sidebar (like Instagram)';
COMMENT ON FUNCTION get_messages IS 'Get all messages for a conversation with pagination (like Instagram chat history)';
COMMENT ON FUNCTION get_user_profile IS 'Get user profile information for chat headers';
