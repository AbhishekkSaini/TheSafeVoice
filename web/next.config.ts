import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
