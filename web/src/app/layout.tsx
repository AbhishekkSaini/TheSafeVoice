import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "SafeVoice",
  description: "Community forum and safety resources",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
