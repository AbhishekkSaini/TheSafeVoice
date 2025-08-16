import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      { source: '/', destination: '/index.html', permanent: false },
      { source: '/forum', destination: '/forum.html', permanent: false },
      { source: '/login', destination: '/login.html', permanent: false },
      { source: '/signup', destination: '/signup.html', permanent: false },
      { source: '/thread', destination: '/thread.html', permanent: false },
      { source: '/profile', destination: '/profile.html', permanent: false },
      { source: '/privacy', destination: '/privacy.html', permanent: false },
      { source: '/terms', destination: '/terms.html', permanent: false },
      { source: '/reset', destination: '/reset.html', permanent: false },
      { source: '/resources', destination: '/resources.html', permanent: false },
      { source: '/admin', destination: '/admin.html', permanent: false },
      { source: '/messages', destination: '/messages.html', permanent: false },
      { source: '/update-password', destination: '/update-password.html', permanent: false },
    ];
  },
  async rewrites() {
    return [
      // Serve legacy static HTML routes
      { source: "/", destination: "/index.html" },
      { source: "/forum", destination: "/forum.html" },
      { source: "/login", destination: "/login.html" },
      { source: "/signup", destination: "/signup.html" },
      { source: "/thread", destination: "/thread.html" },
      { source: "/profile", destination: "/profile.html" },
      { source: "/privacy", destination: "/privacy.html" },
      { source: "/terms", destination: "/terms.html" },
      { source: "/reset", destination: "/reset.html" },
      { source: "/resources", destination: "/resources.html" },
      { source: "/admin", destination: "/admin.html" },
      { source: "/messages", destination: "/messages.html" },
      { source: "/update-password", destination: "/update-password.html" },
    ];
  },
};

export default nextConfig;
