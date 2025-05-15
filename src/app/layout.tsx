import type { Metadata } from 'next';
import { Geist_Mono } from 'next/font/google'; // Changed from Geist to Geist_Mono for primary font
import './globals.css';
import { Toaster } from "@/components/ui/toaster"; // Added Toaster for notifications

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'RetroInfo',
  description: 'AI-Powered Information Discovery',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${geistMono.variable} font-mono antialiased`}> {/* Prioritize mono font */}
        {children}
        <Toaster /> {/* Added Toaster component */}
      </body>
    </html>
  );
}
