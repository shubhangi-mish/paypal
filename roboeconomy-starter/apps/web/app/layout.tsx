import "./globals.css";
import { Inter } from "next/font/google";
import type { Metadata, Viewport } from "next";
import AppShell from "./components/AppShell";

const inter = Inter({ subsets: ["latin"], display: "swap" });

export const metadata: Metadata = { title: "RoboEconomy", description: "The economic network for autonomous machines" };
export const viewport: Viewport = { themeColor: "#070b1f" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.className}>
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
