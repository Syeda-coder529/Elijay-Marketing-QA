import type { Metadata } from "next";
import "./globals.css";
import AnimatedBackground from "@/components/AnimatedBackground";

export const metadata: Metadata = {
  title: "Elijay Marketing Solutions | Pay-Per-Call QA CRM",
  description: "AI-powered pay-per-call quality assurance CRM by Elijay Marketing Solutions"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen font-sans antialiased">
        <AnimatedBackground />
        {children}
      </body>
    </html>
  );
}
