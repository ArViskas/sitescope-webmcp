import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "SiteScope - Website migration intelligence",
  description:
    "A WebMCP-powered tool for inspecting public websites, mapping site inventory, checking link health, and preparing migration baselines."
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
