import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Lagerverwaltung",
  description: "Lagerverwaltung und Rechnungen",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-gray-50 text-gray-900">
        {children}
      </body>
    </html>
  );
}
