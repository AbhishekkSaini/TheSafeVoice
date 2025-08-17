-- Real-time Messaging System with Optimistic Updates (FIXED VERSION)
-- This creates a fast, reliable messaging system like Instagram/WhatsApp

-- 1. Optimize messages table for real-time performance
CREATE INDEX IF NOT EXISTS idx_messages_receiver_created ON messages(receiver_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_sender_created ON messages(sender_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(sender_id, receiver_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_status ON messages(status, created_at);

-- 2. Add message status tracking for optimistic updates
ALTER TABLE public.messages 
ADD COLUMN IF NOT EXISTS temp_id text, -- for optimistic updates
ADD COLUMN IF NOT EXISTS status text DEFAULT 'sending' CHECK (status IN ('sending', 'sent', 'delivered', 'read', 'failed'));

-- 3. Create lightweight typing status table
DROP TABLE IF EXISTS public.typing_status CASCADE;
CREATE TABLE public.typing_status (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    conversation_id text not null, -- format: "user1_id:user2_id" (sorted)
    is_typing boolean not null default true,
    created_at timestamp with time zone default now()
);

-- 4. Create lightweight online users table (ensure it's a table, not a view)
DROP TABLE IF EXISTS public.online_users CASCADE;
CREATE TABLE public.online_users (
    user_id uuid primary key references auth.users(id) on delete cascade,
    last_seen timestamp with time zone default now(),
    is_online boolean default true
);

-- 5. Create conversation ID function
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

-- 6. Optimistic message sending function
CREATE OR REPLACE FUNCTION send_message_optimistic(
    p_receiver_id uuid,
    p_body text,
    p_temp_id text DEFAULT NULL
)
RETURNS json AS $$
DECLARE
    v_message_id uuid;
    v_result json;
BEGIN
    -- Insert message with optimistic status
    INSERT INTO messages (sender_id, receiver_id, body, temp_id, status, created_at)
    VALUES (auth.uid(), p_receiver_id, p_body, p_temp_id, 'sent', now())
    RETURNING id INTO v_message_id;
    
    -- Return message data for immediate UI update
    SELECT json_build_object(
        'id', v_message_id,
        'temp_id', p_temp_id,
        'sender_id', auth.uid(),
        'receiver_id', p_receiver_id,
        'body', p_body,
        'status', 'sent',
        'created_at', now()
    ) INTO v_result;
    
    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Mark messages as read function
CREATE OR REPLACE FUNCTION mark_messages_read(other_user_id uuid)
RETURNS void AS $$
BEGIN
    UPDATE messages 
    SET status = 'read', read_at = now()
    WHERE sender_id = other_user_id 
    AND receiver_id = auth.uid() 
    AND status != 'read';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Update typing status function
CREATE OR REPLACE FUNCTION update_typing_status(other_user_id uuid, p_is_typing boolean)
RETURNS void AS $$
DECLARE
    v_conversation_id text;
BEGIN
    v_conversation_id := get_conversation_id(auth.uid(), other_user_id);
    
    -- Remove old typing status
    DELETE FROM typing_status 
    WHERE user_id = auth.uid() 
    AND conversation_id = v_conversation_id;
    
    -- Add new typing status if typing
    IF p_is_typing THEN
        INSERT INTO typing_status (user_id, conversation_id, is_typing)
        VALUES (auth.uid(), v_conversation_id, true);
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. Update online status function
CREATE OR REPLACE FUNCTION update_online_status()
RETURNS void AS $$
BEGIN
    INSERT INTO online_users (user_id, last_seen, is_online)
    VALUES (auth.uid(), now(), true)
    ON CONFLICT (user_id) 
    DO UPDATE SET 
        last_seen = now(),
        is_online = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 10. Get recent conversations with pagination
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

-- 11. Get messages with pagination for smooth scrolling
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
    ORDER BY m.created_at DESC
    LIMIT limit_count OFFSET offset_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 12. Clean up old typing status (runs every 5 minutes)
CREATE OR REPLACE FUNCTION cleanup_typing_status()
RETURNS void AS $$
BEGIN
    DELETE FROM typing_status 
    WHERE created_at < now() - interval '5 minutes';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 13. Clean up offline users (runs every 10 minutes)
CREATE OR REPLACE FUNCTION cleanup_offline_users()
RETURNS void AS $$
BEGIN
    UPDATE online_users 
    SET is_online = false 
    WHERE last_seen < now() - interval '10 minutes';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 14. Enable RLS on tables (AFTER creating them as tables)
ALTER TABLE public.typing_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.online_users ENABLE ROW LEVEL SECURITY;

-- 15. Create RLS policies for typing_status
DROP POLICY IF EXISTS "typing_status_participants" ON public.typing_status;
CREATE POLICY "typing_status_participants" ON public.typing_status
    FOR ALL USING (
        conversation_id LIKE '%' || auth.uid()::text || '%'
    );

-- 16. Create RLS policies for online_users
DROP POLICY IF EXISTS "online_users_read" ON public.online_users;
DROP POLICY IF EXISTS "online_users_update_own" ON public.online_users;
DROP POLICY IF EXISTS "online_users_insert_own" ON public.online_users;

CREATE POLICY "online_users_read" ON public.online_users
    FOR SELECT USING (true);

CREATE POLICY "online_users_update_own" ON public.online_users
    FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "online_users_insert_own" ON public.online_users
    FOR INSERT WITH CHECK (user_id = auth.uid());

-- 17. Grant permissions
GRANT EXECUTE ON FUNCTION send_message_optimistic(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION mark_messages_read(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION update_typing_status(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION update_online_status() TO authenticated;
GRANT EXECUTE ON FUNCTION get_recent_conversations(int, int) TO authenticated;
GRANT EXECUTE ON FUNCTION get_messages(uuid, int, int) TO authenticated;
GRANT EXECUTE ON FUNCTION cleanup_typing_status() TO authenticated;
GRANT EXECUTE ON FUNCTION cleanup_offline_users() TO authenticated;

-- 18. Create triggers for automatic cleanup
CREATE OR REPLACE FUNCTION trigger_cleanup_typing()
RETURNS trigger AS $$
BEGIN
    -- Clean up typing status when user goes offline
    IF NEW.is_online = false AND OLD.is_online = true THEN
        DELETE FROM typing_status WHERE user_id = NEW.user_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS cleanup_typing_trigger ON online_users;
CREATE TRIGGER cleanup_typing_trigger
    AFTER UPDATE ON online_users
    FOR EACH ROW
    EXECUTE FUNCTION trigger_cleanup_typing();

-- 19. Add comments for documentation
COMMENT ON TABLE public.typing_status IS 'Lightweight typing indicators for real-time messaging';
COMMENT ON TABLE public.online_users IS 'User online status tracking for real-time presence';
COMMENT ON COLUMN public.messages.temp_id IS 'Temporary ID for optimistic updates';
COMMENT ON COLUMN public.messages.status IS 'Message status: sending, sent, delivered, read, failed';
COMMENT ON FUNCTION send_message_optimistic IS 'Send message with optimistic updates for instant UI feedback';
COMMENT ON FUNCTION get_recent_conversations IS 'Get recent conversations with pagination for smooth scrolling';
COMMENT ON FUNCTION get_messages IS 'Get messages with pagination for efficient chat loading';
