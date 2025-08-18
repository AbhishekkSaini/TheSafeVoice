import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SafeVoice",
  description: "Community forum and safety resources",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gradient-to-br from-slate-50 to-orange-50">
        <div className="h-14 bg-white/90 border-b backdrop-blur-md flex items-center px-4">
          <a href="/" className="font-semibold">TheSafeVoice</a>
          <div className="ml-auto flex items-center gap-4 text-sm">
            <a href="/dm" className="hover:underline">Messages</a>
          </div>
        </div>
        {children}
      </body>
    </html>
  );
}
