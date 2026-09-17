import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Route Intelligence Platform | AI-Powered Transportation & Fleet Optimization",
  description:
    "Production-grade transportation decision system combining real-time traffic, physics-based fuel modeling, dynamic rerouting, ML ETA prediction, and multi-stop logistics optimization.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark h-full antialiased">
      <body className="min-h-full flex flex-col bg-[#080c14] text-slate-100 selection:bg-cyan-500/30 selection:text-cyan-200">
        {children}
      </body>
    </html>
  );
}
