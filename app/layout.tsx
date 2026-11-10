import type { Metadata, Viewport } from 'next';
import Script from 'next/script';
import './globals.css';

export const metadata: Metadata = {
  title: 'CLASS FOOTBALL',
  description: 'ระบบประเมินนักฟุตบอล จัดอันดับ และแบ่งทีมอย่างสมดุล'
};

export const viewport: Viewport = { themeColor: '#07120f' };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="th">
      <body className="min-h-screen">
        {children}
        <Script src="/app.js" strategy="afterInteractive" />
      </body>
    </html>
  );
}
