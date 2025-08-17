-- Optimized Real-time Messaging System
-- This creates a high-performance messaging system with optimistic updates

-- 1. Optimize existing tables with proper indexing
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(sender_id, receiver_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_receiver ON messages(receiver_id, read_at);
CREATE INDEX IF NOT EXISTS idx_profiles_online ON profiles(online_status, last_seen);

-- 2. Add typing indicators table
CREATE TABLE IF NOT EXISTS public.typing_indicators (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    conversation_id text not null, -- format: "user1_id:user2_id" (sorted)
    is_typing boolean not null default true,
    created_at timestamp with time zone default now()
);

-- 3. Add message status tracking
ALTER TABLE public.messages 
ADD COLUMN IF NOT EXISTS temp_id text, -- for optimistic updates
ADD COLUMN IF NOT EXISTS status text DEFAULT 'sent' CHECK (status IN ('sent', 'delivered', 'read', 'failed'));

-- 4. Create optimized functions for real-time messaging

-- Function to get conversation ID (sorted user IDs)
CREATE OR REPLACE FUNCTION get_conversation_id(user1_id uuid, user2_id uuid)
RETURNS text AS $$
BEGIN
    IF user1_id < user2_id THEN
        RETURN user1_id::text || ':' || user2_id::text;
    ELSE
        RETURN user2_id::text || ':' || user1_id::text;
    END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to send message with optimistic updates
CREATE OR REPLACE FUNCTION send_message_optimistic(
    p_receiver_id uuid,
    p_body text,
    p_temp_id text DEFAULT NULL
)
RETURNS json AS $$
DECLARE
    v_message_id uuid;
    v_conversation_id text;
    v_result json;
BEGIN
    -- Generate conversation ID
    v_conversation_id := get_conversation_id(auth.uid(), p_receiver_id);
    
    -- Insert message
    INSERT INTO messages (sender_id, receiver_id, body, temp_id, status)
    VALUES (auth.uid(), p_receiver_id, p_body, p_temp_id, 'sent')
    RETURNING id INTO v_message_id;
    
    -- Mark as delivered immediately (optimistic)
    UPDATE messages 
    SET delivered_at = now(), status = 'delivered'
    WHERE id = v_message_id;
    
    -- Return message data
    SELECT json_build_object(
        'id', v_message_id,
        'temp_id', p_temp_id,
        'sender_id', auth.uid(),
        'receiver_id', p_receiver_id,
        'body', p_body,
        'status', 'delivered',
        'created_at', now(),
        'delivered_at', now()
    ) INTO v_result;
    
    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to mark messages as read
CREATE OR REPLACE FUNCTION mark_messages_read_optimistic(other_user_id uuid)
RETURNS void AS $$
BEGIN
    UPDATE messages 
    SET read_at = now(), status = 'read'
    WHERE sender_id = other_user_id 
    AND receiver_id = auth.uid() 
    AND read_at IS NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update typing indicator
CREATE OR REPLACE FUNCTION update_typing_indicator(other_user_id uuid, p_is_typing boolean)
RETURNS void AS $$
DECLARE
    v_conversation_id text;
BEGIN
    v_conversation_id := get_conversation_id(auth.uid(), other_user_id);
    
    -- Remove old typing indicators
    DELETE FROM typing_indicators 
    WHERE user_id = auth.uid() 
    AND conversation_id = v_conversation_id;
    
    -- Add new typing indicator if typing
    IF p_is_typing THEN
        INSERT INTO typing_indicators (user_id, conversation_id, is_typing)
        VALUES (auth.uid(), v_conversation_id, true);
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get recent conversations with unread counts
CREATE OR REPLACE FUNCTION get_recent_conversations()
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
        WHERE receiver_id = auth.uid() AND read_at IS NULL
        GROUP BY sender_id
    )
    SELECT 
        cs.other_user_id,
        p.display_name,
        cs.last_message,
        cs.last_message_time,
        COALESCE(uc.unread_count, 0) as unread_count,
        p.online_status AND p.last_seen > now() - interval '5 minutes' as is_online
    FROM conversation_summaries cs
    JOIN profiles p ON p.id = cs.other_user_id
    LEFT JOIN unread_counts uc ON uc.other_user_id = cs.other_user_id
    WHERE cs.rn = 1
    ORDER BY cs.last_message_time DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Create materialized view for online users (refreshed every 30 seconds)
CREATE MATERIALIZED VIEW IF NOT EXISTS online_users_view AS
SELECT 
    id,
    display_name,
    online_status,
    last_seen
FROM profiles 
WHERE online_status = true 
AND last_seen > now() - interval '5 minutes';

CREATE UNIQUE INDEX IF NOT EXISTS idx_online_users_view_id ON online_users_view(id);

-- Function to refresh online users view
CREATE OR REPLACE FUNCTION refresh_online_users()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY online_users_view;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Add RLS policies for new tables
ALTER TABLE public.typing_indicators ENABLE ROW LEVEL SECURITY;

CREATE POLICY "typing_indicators_participants" ON public.typing_indicators
    FOR ALL USING (
        conversation_id LIKE '%' || auth.uid()::text || '%'
    );

-- 7. Grant permissions
GRANT EXECUTE ON FUNCTION send_message_optimistic(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION mark_messages_read_optimistic(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION update_typing_indicator(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION get_recent_conversations() TO authenticated;
GRANT EXECUTE ON FUNCTION refresh_online_users() TO authenticated;

-- 8. Create trigger to auto-refresh online users view
CREATE OR REPLACE FUNCTION trigger_refresh_online_users()
RETURNS trigger AS $$
BEGIN
    PERFORM refresh_online_users();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER refresh_online_users_trigger
    AFTER UPDATE ON profiles
    FOR EACH ROW
    WHEN (OLD.online_status IS DISTINCT FROM NEW.online_status OR OLD.last_seen IS DISTINCT FROM NEW.last_seen)
    EXECUTE FUNCTION trigger_refresh_online_users();

-- 9. Add comments for documentation
COMMENT ON TABLE public.typing_indicators IS 'Real-time typing indicators for conversations';
COMMENT ON COLUMN public.messages.temp_id IS 'Temporary ID for optimistic updates';
COMMENT ON COLUMN public.messages.status IS 'Message status: sent, delivered, read, failed';
COMMENT ON FUNCTION send_message_optimistic IS 'Send message with optimistic updates for real-time feel';
COMMENT ON FUNCTION get_recent_conversations IS 'Get recent conversations with unread counts for sidebar';
