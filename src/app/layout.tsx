import type { Metadata } from 'next';

import '../styles/globals.css';

export const metadata: Metadata = {
  title: 'Private portfolio workspace',
  description: 'A local-only portfolio analysis workspace.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <header className="app-header">
          <p className="eyebrow">Local-only workspace</p>
          <p className="app-name">Portfolio analysis</p>
        </header>
        {children}
      </body>
    </html>
  );
}
