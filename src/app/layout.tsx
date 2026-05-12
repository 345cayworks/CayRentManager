import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'CayRentManager',
  description: 'Cayman-focused rental property operations platform',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
