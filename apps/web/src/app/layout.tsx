import React from 'react';

export const metadata = {
  title: 'Hotel Operating System (HOS) Dashboard',
  description: 'Production-ready hotel reservation PMS platform',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: 'sans-serif', backgroundColor: '#f9f9fb' }}>
        {children}
      </body>
    </html>
  );
}
