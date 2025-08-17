-- Fix Messaging System - Clean Setup
-- This will fix the online_users issue and set up real-time messaging

-- 1. First, drop any existing problematic objects
DROP VIEW IF EXISTS public.online_users CASCADE;
DROP TABLE IF EXISTS public.online_users CASCADE;
DROP TABLE IF EXISTS public.typing_status CASCADE;

-- 2. Create the online_users table properly
CREATE TABLE public.online_users (
    user_id uuid primary key references auth.users(id) on delete cascade,
    last_seen timestamp with time zone default now(),
    is_online boolean default true
);

-- 3. Create the typing_status table
CREATE TABLE public.typing_status (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    conversation_id text not null,
    is_typing boolean not null default true,
    created_at timestamp with time zone default now()
);

-- 4. Add message status columns if they don't exist
ALTER TABLE public.messages 
ADD COLUMN IF NOT EXISTS temp_id text,
ADD COLUMN IF NOT EXISTS status text DEFAULT 'sending' CHECK (status IN ('sending', 'sent', 'delivered', 'read', 'failed'));

-- 5. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_messages_receiver_created ON messages(receiver_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_sender_created ON messages(sender_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(sender_id, receiver_id, created_at DESC);

-- 6. Enable RLS on the tables
ALTER TABLE public.online_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.typing_status ENABLE ROW LEVEL SECURITY;

-- 7. Create RLS policies
CREATE POLICY "online_users_read" ON public.online_users FOR SELECT USING (true);
CREATE POLICY "online_users_update_own" ON public.online_users FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "online_users_insert_own" ON public.online_users FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "typing_status_participants" ON public.typing_status
    FOR ALL USING (conversation_id LIKE '%' || auth.uid()::text || '%');

-- 8. Create essential functions
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
    INSERT INTO messages (sender_id, receiver_id, body, temp_id, status, created_at)
    VALUES (auth.uid(), p_receiver_id, p_body, p_temp_id, 'sent', now())
    RETURNING id INTO v_message_id;
    
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

CREATE OR REPLACE FUNCTION update_typing_status(other_user_id uuid, p_is_typing boolean)
RETURNS void AS $$
DECLARE
    v_conversation_id text;
BEGIN
    v_conversation_id := get_conversation_id(auth.uid(), other_user_id);
    
    DELETE FROM typing_status 
    WHERE user_id = auth.uid() 
    AND conversation_id = v_conversation_id;
    
    IF p_is_typing THEN
        INSERT INTO typing_status (user_id, conversation_id, is_typing)
        VALUES (auth.uid(), v_conversation_id, true);
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

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

-- 9. Grant permissions
GRANT EXECUTE ON FUNCTION send_message_optimistic(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION update_online_status() TO authenticated;
GRANT EXECUTE ON FUNCTION update_typing_status(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION mark_messages_read(uuid) TO authenticated;

-- 10. Add comments
COMMENT ON TABLE public.online_users IS 'User online status tracking for real-time presence';
COMMENT ON TABLE public.typing_status IS 'Lightweight typing indicators for real-time messaging';
COMMENT ON COLUMN public.messages.temp_id IS 'Temporary ID for optimistic updates';
COMMENT ON COLUMN public.messages.status IS 'Message status: sending, sent, delivered, read, failed';
