import type { Metadata } from 'next';
import { GeistMono } from 'geist/font/mono';
import './globals.css';

export const metadata: Metadata = {
  title: 'Cloud Signage Player',
  description: 'Playback runtime for Cloud Signage screens',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={GeistMono.variable}>
      <body
        className={`${GeistMono.className} min-h-screen bg-[#030712] text-white antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
