import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '手势互动礼物',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>
        {children}
      </body>
    </html>
  );
}
