import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'AI Query Builder',
  description: 'AI-powered database query and reporting tool',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
