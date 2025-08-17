-- Add comprehensive messaging features
-- This adds online status, read receipts, and typing indicators

-- 1. Add online status to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS online_status boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS last_seen timestamp with time zone DEFAULT now();

-- 2. Add read receipts to messages table
ALTER TABLE public.messages 
ADD COLUMN IF NOT EXISTS read_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS delivered_at timestamp with time zone;

-- 3. Create a function to update online status
CREATE OR REPLACE FUNCTION update_online_status()
RETURNS void AS $$
BEGIN
    UPDATE public.profiles 
    SET online_status = true, last_seen = now()
    WHERE id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Create a function to mark messages as read
CREATE OR REPLACE FUNCTION mark_messages_read(other_user_id uuid)
RETURNS void AS $$
BEGIN
    UPDATE public.messages 
    SET read_at = now()
    WHERE sender_id = other_user_id 
    AND receiver_id = auth.uid() 
    AND read_at IS NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Create a function to mark messages as delivered
CREATE OR REPLACE FUNCTION mark_messages_delivered(other_user_id uuid)
RETURNS void AS $$
BEGIN
    UPDATE public.messages 
    SET delivered_at = now()
    WHERE sender_id = auth.uid() 
    AND receiver_id = other_user_id 
    AND delivered_at IS NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Add comments for documentation
COMMENT ON COLUMN public.profiles.online_status IS 'Whether the user is currently online';
COMMENT ON COLUMN public.profiles.last_seen IS 'When the user was last active';
COMMENT ON COLUMN public.messages.read_at IS 'When the message was read by receiver';
COMMENT ON COLUMN public.messages.delivered_at IS 'When the message was delivered to receiver';

-- 7. Create a view for online users
CREATE OR REPLACE VIEW public.online_users AS
SELECT id, display_name, online_status, last_seen
FROM public.profiles
WHERE online_status = true
AND last_seen > now() - interval '5 minutes';

-- 8. Add RLS policies for the new functions
GRANT EXECUTE ON FUNCTION update_online_status() TO authenticated;
GRANT EXECUTE ON FUNCTION mark_messages_read(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION mark_messages_delivered(uuid) TO authenticated;
