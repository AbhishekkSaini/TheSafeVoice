# 🧪 Testing Guide - SafeVoice Messaging System

## 🚀 Quick Start Testing

### 1. **Start the Test Server**
```bash
cd Safevoice/web/public
python -m http.server 8000
```

### 2. **Open Test Page**
Navigate to: `http://localhost:8000/test-messaging.html`

### 3. **Test Steps**

#### **Step 1: Connection Test**
- ✅ Should show "Connection Successful" in green
- ✅ If red, check your `config.js` file has correct Supabase credentials

#### **Step 2: Authentication Test**
- 🔐 Click "Login" to sign in
- ✅ Should show your email and user ID
- ✅ Should enable search and messaging sections

#### **Step 3: User Search Test**
- 🔍 Type a display name in the search box
- ✅ Should show matching users
- ✅ Should show "Message" buttons

#### **Step 4: Messaging Test**
- 💬 Click "Message" on any user
- ✅ Should open chat window
- ✅ Type a message and click "Send"
- ✅ Should see message appear in chat

## 📋 Test Checklist

### **Connection & Authentication**
- [ ] Supabase connection works
- [ ] User can login/logout
- [ ] User info displays correctly

### **User Search**
- [ ] Search by display name works
- [ ] Search results show correctly
- [ ] Message buttons appear

### **Messaging**
- [ ] Can start conversation
- [ ] Can send messages
- [ ] Messages appear in chat
- [ ] Real-time updates work

### **Privacy Wall**
- [ ] Anonymous users see limited content
- [ ] Login prompts appear
- [ ] Authenticated users see full content

## 🔧 Troubleshooting

### **Connection Issues**
```javascript
// Check your config.js has correct values:
window.SAFEVOICE_CONFIG = {
    supabaseUrl: "https://your-project.supabase.co",
    supabaseAnonKey: "your-anon-key-here"
};
```

### **Authentication Issues**
- Make sure you have users in your database
- Check Supabase Auth settings
- Verify email confirmation if enabled

### **Search Issues**
- Ensure profiles table has `display_name` field
- Check RLS policies allow reading profiles
- Verify user has proper permissions

### **Messaging Issues**
- Check messages table exists
- Verify RLS policies for messages
- Ensure sender_id and receiver_id are correct

## 🎯 Expected Results

### **All Tests Pass** ✅
- Connection: Green checkmark
- Authentication: Green checkmark  
- User Search: Green checkmark
- Messaging: Green checkmark

### **If Tests Fail** ❌
- Check browser console for errors
- Verify Supabase credentials
- Check database schema and RLS policies
- Ensure all required tables exist

## 🚀 Production Testing

### **Test Real User Scenarios**
1. **User Registration**: Sign up new users
2. **Profile Creation**: Set display names
3. **User Discovery**: Search for other users
4. **Conversation Start**: Send first message
5. **Message Exchange**: Back and forth messaging
6. **Privacy Wall**: Test anonymous vs authenticated access

### **Performance Testing**
- Test with multiple users
- Check message delivery speed
- Verify real-time updates
- Test search performance

## 📱 Mobile Testing
- Test on mobile browsers
- Check responsive design
- Verify touch interactions
- Test keyboard behavior

---

**Need Help?** Check the browser console for detailed error messages and refer to the `SECURITY.md` file for configuration help.
