import './globals.css';
import type { Metadata } from 'next';
import { IdentityHashHandler } from '@/components/auth/identity-hash-handler';

export const metadata: Metadata = {
  title: 'CayRentManager',
  description: 'Cayman-focused rental property operations platform',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <IdentityHashHandler />
        {children}
      </body>
    </html>
  );
}
