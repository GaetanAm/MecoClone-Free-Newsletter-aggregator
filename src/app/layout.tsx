import type { Metadata, Viewport } from "next";
import "./globals.css";

export const viewport: Viewport = {
  themeColor: "#0f172a",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false, // Évite les zooms accidentels sur iPhone en cliquant sur les inputs
};

export const metadata: Metadata = {
  title: "Mon Méco",
  description: "Mon agrégateur de newsletters personnel",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Mon Méco",
  },
  icons: {
    apple: "/icon-192.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <head>
        {/* Écran de chargement par défaut pour iPhone */}
        <link rel="apple-touch-startup-image" href="/icon-512.png" />
      </head>
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}