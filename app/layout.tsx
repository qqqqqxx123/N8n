import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ring CRM Portal",
  description: "CRM portal for ring/jewelry company",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}






