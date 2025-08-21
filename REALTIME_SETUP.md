# Real-time Messaging Setup Guide

## Overview

This guide shows you how to add real-time messaging (WebSocket-like functionality) to your SafeVoice application using Supabase Realtime.

## What You Get

✅ **Instant message delivery** - Messages appear immediately  
✅ **Typing indicators** - See when someone is typing  
✅ **Online/offline status** - Know who's available  
✅ **Message read receipts** - See when messages are read  
✅ **Real-time notifications** - Get notified of new messages  

## Setup Steps

### 1. Enable Supabase Realtime

1. **Go to your Supabase Dashboard**
   - Navigate to your project
   - Go to **Database** → **Replication**

2. **Enable Realtime for tables**
   - Find the `messages` table
   - Toggle **Enable Realtime** to ON
   - Do the same for `online_users` table

3. **Configure Realtime settings**
   - Go to **Settings** → **API**
   - Make sure **Realtime** is enabled
   - Note your **Project URL** and **Anon Key**

### 2. Run Database Migrations

Execute these SQL commands in your Supabase SQL Editor:

```sql
-- Enable realtime for messages table
ALTER PUBLICATION supabase_realtime ADD TABLE messages;

-- Enable realtime for online_users table  
ALTER PUBLICATION supabase_realtime ADD TABLE online_users;

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

-- Grant permissions
GRANT EXECUTE ON FUNCTION update_online_status() TO authenticated;
```

### 3. Test the Real-time Chat

1. **Open the demo page**: `web/public/realtime-chat.html`
2. **Login with two different accounts** (in different browser windows)
3. **Start chatting** - you should see messages appear instantly!

## How It Works

### Supabase Realtime (Recommended)
- **Built-in WebSocket support** - No additional server needed
- **Automatic scaling** - Handles thousands of concurrent users
- **Real-time subscriptions** - Listen for database changes
- **Typing indicators** - Broadcast events between users
- **Online status** - Track who's currently active

### Alternative: Custom WebSocket Server

If you want to build your own WebSocket server:

```javascript
// Example with Node.js + Socket.io
const io = require('socket.io')(server);

io.on('connection', (socket) => {
    // User joins
    socket.on('join', (userId) => {
        socket.join(userId);
        socket.broadcast.emit('user_online', userId);
    });
    
    // Send message
    socket.on('send_message', (data) => {
        // Save to database
        saveMessage(data);
        // Broadcast to recipient
        socket.to(data.receiverId).emit('new_message', data);
    });
    
    // Typing indicator
    socket.on('typing', (data) => {
        socket.to(data.receiverId).emit('user_typing', data);
    });
});
```

## Features Implemented

### 1. Real-time Message Delivery
```javascript
// Listen for new messages
realtimeMessaging.onMessage((message, type) => {
    if (type === 'new') {
        displayNewMessage(message);
    }
});
```

### 2. Typing Indicators
```javascript
// Send typing indicator
await realtimeMessaging.sendTypingIndicator(receiverId, true);

// Listen for typing
realtimeMessaging.onTyping((typingData) => {
    showTypingIndicator(typingData.user_id);
});
```

### 3. Online Status
```javascript
// Update online status
await realtimeMessaging.updateOnlineStatus(true);

// Listen for status changes
realtimeMessaging.onOnlineStatus((onlineData) => {
    updateUserStatus(onlineData.user_id, onlineData.is_online);
});
```

### 4. Message Read Receipts
```javascript
// Mark messages as read
await realtimeMessaging.markMessagesAsRead(senderId);
```

## Integration with Existing Code

### Update your existing messaging pages:

```javascript
// In your existing chat pages
import realtimeMessaging from 'js/realtime-messaging.js';

// Initialize real-time
await realtimeMessaging.initialize();

// Send message with real-time delivery
const message = await realtimeMessaging.sendMessage(receiverId, text);
```

## Performance Considerations

### Supabase Realtime Limits:
- **Free tier**: 2 concurrent connections per user
- **Pro tier**: 100 concurrent connections per user
- **Enterprise**: Custom limits

### Optimization Tips:
1. **Disconnect unused subscriptions**
2. **Use filters** to only receive relevant messages
3. **Implement reconnection logic**
4. **Cache message history** locally

## Troubleshooting

### Common Issues:

1. **Messages not appearing in real-time**
   - Check if Realtime is enabled in Supabase
   - Verify table is added to realtime publication
   - Check browser console for errors

2. **Connection drops**
   - Implement automatic reconnection
   - Check network connectivity
   - Verify Supabase project status

3. **Typing indicators not working**
   - Check broadcast permissions
   - Verify channel subscription
   - Test with simple broadcast first

### Debug Tools:
- Use `realtime-chat.html` to test functionality
- Check browser console for connection status
- Monitor Supabase dashboard for real-time metrics

## Next Steps

1. **Test the real-time chat** with multiple users
2. **Integrate into your existing messaging pages**
3. **Add push notifications** for offline users
4. **Implement message encryption** for security
5. **Add file/image sharing** capabilities

## Support

If you encounter issues:
1. Check the Supabase documentation
2. Review the browser console for errors
3. Test with the provided demo pages
4. Verify your database migrations ran successfully

Your SafeVoice app now has WhatsApp-level real-time messaging! 🚀
