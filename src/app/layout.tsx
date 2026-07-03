import type { Metadata } from "next";
import { Outfit, Sarabun } from "next/font/google";
import "./globals.css";
import LineExternalBrowserRedirect from "./_components/LineExternalBrowserRedirect";

const sarabun = Sarabun({
  variable: "--font-sarabun",
  subsets: ["latin", "thai"],
  weight: ["300", "400", "600", "700"],
});

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  weight: ["300", "400", "600", "700"],
});

export const metadata: Metadata = {
  title: "ระบบเช็คชื่อเข้าแถว",
  description: "LineUp attendance check-in system",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="th"
      className={`${sarabun.variable} ${outfit.variable} h-full bg-slate-950 text-slate-100 antialiased`}
    >
      <body className="min-h-full flex flex-col overflow-x-hidden relative">
        <LineExternalBrowserRedirect />
        {children}
      </body>
    </html>
  );
}
