# 🐦 Twitter OAuth Setup Guide

## 🚨 Current Issue
The error "Cannot read properties of null (reading 'auth')" indicates that Twitter OAuth is not properly configured in your Supabase project.

## 🔧 Quick Fix Options

### **Option 1: Use Google OAuth (Recommended - Easier)**
1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project: `afyipizxltydgtjjecyi`
3. Go to **Authentication → Providers**
4. Enable **Google**
5. Add your Google OAuth credentials

### **Option 2: Configure Twitter OAuth**

#### **Step 1: Create Twitter App**
1. Go to [Twitter Developer Portal](https://developer.twitter.com/en/portal/dashboard)
2. Sign in with your Twitter account
3. Click **Create App**
4. Fill in app details:
   - **App name**: SafeVoice
   - **Description**: SafeVoice social platform
   - **Website URL**: `https://afyipizxltydgtjjecyi.supabase.co`
   - **Callback URL**: `https://afyipizxltydgtjjecyi.supabase.co/auth/v1/callback`

#### **Step 2: Get Twitter Credentials**
1. In your Twitter app dashboard, go to **Keys and Tokens**
2. Copy your **API Key** and **API Secret Key**
3. Keep these secure!

#### **Step 3: Configure Supabase**
1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project: `afyipizxltydgtjjecyi`
3. Go to **Authentication → Providers**
4. Find **Twitter** and click **Enable**
5. Paste your Twitter API Key and Secret
6. Save configuration

#### **Step 4: Test**
1. Go to your login page
2. Click the Twitter button
3. Should redirect to Twitter for authorization

## 🛠️ Troubleshooting

### **Common Issues:**

#### **1. "Invalid callback URL"**
- Make sure callback URL in Twitter app matches exactly: `https://afyipizxltydgtjjecyi.supabase.co/auth/v1/callback`

#### **2. "App not approved"**
- Twitter apps need approval for OAuth
- Use Google OAuth instead (easier approval process)

#### **3. "Cannot read properties of null"**
- This means Supabase client isn't initialized
- Check your `config.js` has correct credentials
- Make sure `initSupabase()` is called before using auth

### **Quick Test:**
1. Open: `http://localhost:8000/test-connection.html`
2. Check if basic connection works
3. Test Twitter OAuth button
4. Look for specific error messages

## 🎯 Recommended Solution

**Use Google OAuth instead of Twitter** because:
- ✅ Easier to set up
- ✅ Faster approval process
- ✅ More reliable
- ✅ Better user experience

### **Google OAuth Setup:**
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable Google+ API
4. Create OAuth 2.0 credentials
5. Add authorized redirect URI: `https://afyipizxltydgtjjecyi.supabase.co/auth/v1/callback`
6. Copy Client ID and Secret to Supabase

## 🔒 Security Note
- Never commit OAuth secrets to git
- Use environment variables in production
- Rotate keys regularly
- Monitor for unauthorized access

---

**Need Help?** Check the browser console for detailed error messages and refer to the Supabase documentation for OAuth setup.
