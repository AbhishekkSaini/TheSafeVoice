# 🔒 Security Guide - SafeVoice

## ⚠️ CRITICAL: Credentials Exposed

**Your Supabase credentials have been exposed on GitHub!** This is a serious security issue that needs immediate attention.

## 🚨 Immediate Actions Required

### 1. Rotate Supabase Keys (URGENT)
1. Go to your [Supabase Dashboard](https://supabase.com/dashboard)
2. Navigate to Settings → API
3. **Regenerate your anon key immediately**
4. Update your local `config.js` with the new key
5. **Never commit the new key to GitHub**

### 2. Remove Exposed Credentials from Git History
```bash
# Remove the file from git history
git filter-branch --force --index-filter \
  "git rm --cached --ignore-unmatch web/public/js/config.js" \
  --prune-empty --tag-name-filter cat -- --all

# Force push to remove from GitHub
git push origin --force --all
```

### 3. Check for Data Breach
- Review your Supabase logs for unauthorized access
- Check if any data was accessed or modified
- Consider resetting user passwords if necessary

## 🔐 Proper Configuration Setup

### 1. Use Environment Variables
Create a `.env` file (never commit this):
```env
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
GOOGLE_MAPS_API_KEY=your_google_maps_key
```

### 2. Use Example Config
- Copy `config.example.js` to `config.js`
- Fill in your real credentials locally
- `config.js` is now in `.gitignore`

### 3. For Production
Use environment variables or secure key management:
```javascript
window.SAFEVOICE_CONFIG = {
    supabaseUrl: process.env.SUPABASE_URL,
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY,
    // ... other config
};
```

## 🛡️ Security Best Practices

### Never Commit:
- ✅ API keys
- ✅ Database credentials
- ✅ Private keys
- ✅ Access tokens
- ✅ User data
- ✅ Configuration with real values

### Always Use:
- ✅ `.gitignore` for sensitive files
- ✅ Environment variables
- ✅ Example configuration files
- ✅ Secure key management services

## 📋 Security Checklist

- [ ] Rotate exposed Supabase keys
- [ ] Remove credentials from git history
- [ ] Set up proper `.gitignore`
- [ ] Use environment variables
- [ ] Review access logs
- [ ] Update documentation
- [ ] Train team on security practices

## 🆘 If You Need Help

1. **Immediate**: Rotate your Supabase keys
2. **Short-term**: Remove from git history
3. **Long-term**: Implement proper security practices

**Remember**: Once credentials are exposed on GitHub, consider them compromised and rotate immediately!
