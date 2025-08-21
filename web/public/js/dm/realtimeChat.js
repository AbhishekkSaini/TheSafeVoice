// Real-time Chat Integration for SafeVoice DM System
// Integrates with existing backend and UI components

import { supabase, getUser } from '../../supabase.js';

class SafeVoiceRealtimeChat {
    constructor() {
        this.subscriptions = new Map();
        this.messageCallbacks = new Set();
        this.typingCallbacks = new Set();
        this.onlineCallbacks = new Set();
        this.isConnected = false;
        this.currentUser = null;
        this.currentChatUser = null;
        this.messageHistory = [];
    }

    async initialize() {
        try {
            this.currentUser = await getUser();
            if (!this.currentUser) {
                console.warn('User not authenticated for realtime messaging');
                return false;
            }

            // Setup real-time subscriptions
            await this.setupMessageSubscription();
            await this.setupTypingSubscription();
            await this.setupOnlineStatus();
            
            this.isConnected = true;
            console.log('✅ SafeVoice realtime messaging initialized');
            return true;
        } catch (error) {
            console.error('❌ Failed to initialize SafeVoice realtime messaging:', error);
            return false;
        }
    }

    // Subscribe to new messages for current user
    async setupMessageSubscription() {
        const subscription = supabase
            .channel('safevoice_messages')
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'messages',
                filter: `receiver_id=eq.${this.currentUser.id}`
            }, (payload) => {
                console.log('📨 New message received:', payload.new);
                this.notifyMessageCallbacks(payload.new, 'new');
            })
            .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'messages',
                filter: `receiver_id=eq.${this.currentUser.id} OR sender_id=eq.${this.currentUser.id}`
            }, (payload) => {
                console.log('📝 Message updated:', payload.new);
                this.notifyMessageCallbacks(payload.new, 'update');
            })
            .subscribe();

        this.subscriptions.set('messages', subscription);
    }

    // Subscribe to typing indicators
    async setupTypingSubscription() {
        const subscription = supabase
            .channel('safevoice_typing')
            .on('broadcast', { event: 'typing' }, (payload) => {
                if (payload.payload.user_id !== this.currentUser.id) {
                    console.log('⌨️ Typing indicator:', payload.payload);
                    this.notifyTypingCallbacks(payload.payload);
                }
            })
            .subscribe();

        this.subscriptions.set('typing', subscription);
    }

    // Setup online status tracking
    async setupOnlineStatus() {
        // Update user's online status
        await this.updateOnlineStatus(true);

        // Subscribe to online status changes
        const subscription = supabase
            .channel('safevoice_online')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'online_users'
            }, (payload) => {
                if (payload.new?.user_id !== this.currentUser.id) {
                    console.log('👤 Online status changed:', payload.new);
                    this.notifyOnlineCallbacks(payload.new);
                }
            })
            .subscribe();

        this.subscriptions.set('online_users', subscription);

        // Update status when user leaves
        window.addEventListener('beforeunload', () => {
            this.updateOnlineStatus(false);
        });
    }

    // Send typing indicator
    async sendTypingIndicator(receiverId, isTyping = true) {
        try {
            await supabase.channel('safevoice_typing').send({
                type: 'broadcast',
                event: 'typing',
                payload: {
                    user_id: this.currentUser.id,
                    receiver_id: receiverId,
                    is_typing: isTyping,
                    timestamp: new Date().toISOString()
                }
            });
        } catch (error) {
            console.error('Failed to send typing indicator:', error);
        }
    }

    // Update online status
    async updateOnlineStatus(isOnline) {
        try {
            // Use the existing RPC function if available
            if (isOnline) {
                await supabase.rpc('update_online_status');
            }
            
            // Also update the online_users table directly
            const { error } = await supabase
                .from('online_users')
                .upsert({
                    user_id: this.currentUser.id,
                    is_online: isOnline,
                    last_seen: new Date().toISOString()
                });

            if (error) {
                console.error('Failed to update online status:', error);
            }
        } catch (error) {
            console.error('Failed to update online status:', error);
        }
    }

    // Send message with real-time delivery
    async sendMessage(receiverId, message, tempId = null) {
        try {
            // Use the existing RPC function for sending messages
            const { data, error } = await supabase.rpc('send_message_with_storage', {
                p_receiver_id: receiverId,
                p_body: message,
                p_temp_id: tempId
            });

            if (error) {
                throw error;
            }

            console.log('✅ Message sent and stored:', data);
            return data;
        } catch (error) {
            console.error('❌ Failed to send message:', error);
            throw error;
        }
    }

    // Mark messages as read
    async markMessagesAsRead(senderId) {
        try {
            await supabase.rpc('mark_messages_as_read', {
                other_user_id: senderId
            });
            console.log('✅ Messages marked as read');
        } catch (error) {
            console.error('❌ Failed to mark messages as read:', error);
        }
    }

    // Load conversation list (integrate with existing function)
    async getConversationList() {
        try {
            const { data, error } = await supabase.rpc('get_conversation_list');
            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Failed to get conversation list:', error);
            return [];
        }
    }

    // Load message history (integrate with existing function)
    async getMessageHistory(otherUserId, limit = 50, offset = 0) {
        try {
            const { data, error } = await supabase.rpc('get_message_history', {
                other_user_id: otherUserId,
                limit_count: limit,
                offset_count: offset
            });
            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Failed to get message history:', error);
            return [];
        }
    }

    // Set current chat user
    setCurrentChatUser(user) {
        this.currentChatUser = user;
    }

    // Event listeners
    onMessage(callback) {
        this.messageCallbacks.add(callback);
    }

    onTyping(callback) {
        this.typingCallbacks.add(callback);
    }

    onOnlineStatus(callback) {
        this.onlineCallbacks.add(callback);
    }

    // Notify callbacks
    notifyMessageCallbacks(message, type = 'new') {
        this.messageCallbacks.forEach(callback => {
            try {
                callback(message, type);
            } catch (error) {
                console.error('Error in message callback:', error);
            }
        });
    }

    notifyTypingCallbacks(typingData) {
        this.typingCallbacks.forEach(callback => {
            try {
                callback(typingData);
            } catch (error) {
                console.error('Error in typing callback:', error);
            }
        });
    }

    notifyOnlineCallbacks(onlineData) {
        this.onlineCallbacks.forEach(callback => {
            try {
                callback(onlineData);
            } catch (error) {
                console.error('Error in online status callback:', error);
            }
        });
    }

    // Disconnect
    disconnect() {
        this.subscriptions.forEach((subscription, key) => {
            supabase.removeChannel(subscription);
            console.log(`Disconnected from ${key} channel`);
        });
        this.subscriptions.clear();
        this.isConnected = false;
    }

    // Get connection status
    getConnectionStatus() {
        return {
            isConnected: this.isConnected,
            currentUser: this.currentUser?.id,
            currentChatUser: this.currentChatUser?.id,
            activeSubscriptions: this.subscriptions.size
        };
    }
}

// Create singleton instance
const safeVoiceRealtimeChat = new SafeVoiceRealtimeChat();

export default safeVoiceRealtimeChat;
