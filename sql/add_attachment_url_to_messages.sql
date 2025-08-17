-- Add attachment_url column to messages table
-- This allows users to send files/images in direct messages

ALTER TABLE public.messages 
ADD COLUMN IF NOT EXISTS attachment_url text;

-- Add comment for documentation
COMMENT ON COLUMN public.messages.attachment_url IS 'URL to uploaded file/image attachment for the message';
