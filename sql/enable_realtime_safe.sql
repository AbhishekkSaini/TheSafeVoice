-- Safe Supabase Realtime Setup for SafeVoice messaging system
-- This migration safely enables real-time functionality without errors

-- Function to safely add table to realtime publication
CREATE OR REPLACE FUNCTION add_table_to_realtime(table_name TEXT)
RETURNS void AS $$
BEGIN
    -- Check if table is already in the publication
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND tablename = table_name
    ) THEN
        EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE %I', table_name);
        RAISE NOTICE 'Added table % to realtime publication', table_name;
    ELSE
        RAISE NOTICE 'Table % is already in realtime publication', table_name;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Safely enable realtime for messages table
SELECT add_table_to_realtime('messages');

-- Safely enable realtime for online_users table  
SELECT add_table_to_realtime('online_users');

-- Create function to update online status
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

-- Grant permissions for online status function
GRANT EXECUTE ON FUNCTION update_online_status() TO authenticated;

-- Create function to get conversation list with real-time data
CREATE OR REPLACE FUNCTION get_conversation_list()
RETURNS TABLE (
    other_user_id UUID,
    other_user_name TEXT,
    last_message TEXT,
    last_message_time TIMESTAMPTZ,
    unread_count BIGINT
) AS $$
BEGIN
    RETURN QUERY
    WITH conversation_data AS (
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
        cd.other_user_id,
        COALESCE(p.display_name, 'User ' || cd.other_user_id::text) as other_user_name,
        cd.last_message,
        cd.last_message_time,
        COALESCE(uc.unread_count, 0) as unread_count
    FROM conversation_data cd
    LEFT JOIN profiles p ON cd.other_user_id = p.id
    LEFT JOIN unread_counts uc ON cd.other_user_id = uc.other_user_id
    WHERE cd.rn = 1
    ORDER BY cd.last_message_time DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions for conversation list function
GRANT EXECUTE ON FUNCTION get_conversation_list() TO authenticated;

-- Create function to get message history with real-time support
CREATE OR REPLACE FUNCTION get_message_history(
    other_user_id UUID,
    limit_count INTEGER DEFAULT 50,
    offset_count INTEGER DEFAULT 0
)
RETURNS TABLE (
    id UUID,
    body TEXT,
    created_at TIMESTAMPTZ,
    sender_id UUID,
    receiver_id UUID,
    read_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    status TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        m.id,
        m.body,
        m.created_at,
        m.sender_id,
        m.receiver_id,
        m.read_at,
        m.delivered_at,
        m.status
    FROM messages m
    WHERE (m.sender_id = auth.uid() AND m.receiver_id = other_user_id)
       OR (m.sender_id = other_user_id AND m.receiver_id = auth.uid())
    ORDER BY m.created_at DESC
    LIMIT limit_count
    OFFSET offset_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions for message history function
GRANT EXECUTE ON FUNCTION get_message_history(UUID, INTEGER, INTEGER) TO authenticated;

-- Create function to mark messages as read
CREATE OR REPLACE FUNCTION mark_messages_as_read(other_user_id UUID)
RETURNS void AS $$
BEGIN
    UPDATE messages 
    SET read_at = now(), status = 'read'
    WHERE sender_id = other_user_id 
      AND receiver_id = auth.uid() 
      AND read_at IS NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions for mark as read function
GRANT EXECUTE ON FUNCTION mark_messages_as_read(UUID) TO authenticated;

-- Create function to send message with storage (enhanced for real-time)
CREATE OR REPLACE FUNCTION send_message_with_storage(
    p_receiver_id UUID,
    p_body TEXT,
    p_temp_id TEXT DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    body TEXT,
    created_at TIMESTAMPTZ,
    sender_id UUID,
    receiver_id UUID,
    temp_id TEXT,
    status TEXT
) AS $$
DECLARE
    v_message_id UUID;
BEGIN
    -- Insert the message
    INSERT INTO messages (
        sender_id, 
        receiver_id, 
        body, 
        temp_id, 
        status,
        delivered_at
    ) VALUES (
        auth.uid(), 
        p_receiver_id, 
        p_body, 
        p_temp_id, 
        'sent',
        now()
    ) RETURNING id INTO v_message_id;
    
    -- Return the created message
    RETURN QUERY
    SELECT 
        m.id,
        m.body,
        m.created_at,
        m.sender_id,
        m.receiver_id,
        m.temp_id,
        m.status
    FROM messages m
    WHERE m.id = v_message_id;
    
    -- Update online status
    PERFORM update_online_status();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions for send message function
GRANT EXECUTE ON FUNCTION send_message_with_storage(UUID, TEXT, TEXT) TO authenticated;

-- Ensure online_users table exists and has proper structure
CREATE TABLE IF NOT EXISTS online_users (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    is_online BOOLEAN DEFAULT true,
    last_seen TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Add RLS policies for online_users table (only if not exists)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'online_users' 
        AND policyname = 'view_online_status'
    ) THEN
        ALTER TABLE online_users ENABLE ROW LEVEL SECURITY;
        
        -- Policy to allow users to see online status of other users
        CREATE POLICY "view_online_status" ON online_users
            FOR SELECT USING (true);
            
        -- Policy to allow users to update their own online status
        CREATE POLICY "update_own_online_status" ON online_users
            FOR UPDATE USING (auth.uid() = user_id);
            
        -- Policy to allow users to insert their own online status
        CREATE POLICY "insert_own_online_status" ON online_users
            FOR INSERT WITH CHECK (auth.uid() = user_id);
    END IF;
END $$;

-- Grant permissions for online_users table
GRANT SELECT, INSERT, UPDATE ON online_users TO authenticated;

-- Refresh schema cache to ensure PostgREST recognizes the changes
NOTIFY pgrst, 'reload schema';

-- Clean up helper function
DROP FUNCTION IF EXISTS add_table_to_realtime(TEXT);

-- Log the completion
DO $$
BEGIN
    RAISE NOTICE 'SafeVoice real-time messaging setup completed successfully!';
    RAISE NOTICE 'Realtime enabled for: messages, online_users tables';
    RAISE NOTICE 'Functions created: update_online_status, get_conversation_list, get_message_history, mark_messages_as_read, send_message_with_storage';
    RAISE NOTICE 'All functions and tables are ready for real-time messaging!';
END $$;
