import type { Metadata } from "next";
import { Inter, Outfit, Bai_Jamjuree } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
});

const baiJamjuree = Bai_Jamjuree({
  variable: "--font-bai-jamjuree",
  weight: ["700"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "OLOS | Play, Complete, Win",
  description: "Skill-based gaming where you complete 1v1, stake tokens, and win instantly.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${inter.variable} ${outfit.variable} ${baiJamjuree.variable} antialiased`}
      >
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
