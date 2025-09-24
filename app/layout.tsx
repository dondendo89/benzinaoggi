export const metadata = {
  title: 'BenzinaOggi',
  description: 'Prezzi carburanti e distributori',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it">
      <body>{children}</body>
    </html>
  );
}

