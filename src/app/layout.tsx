import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'RentFlow Manager',
  description: 'Production-grade multi-landlord property management platform',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
