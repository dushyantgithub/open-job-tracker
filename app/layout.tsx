import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "Private Job Tracker", description: "Your private workspace for reviewing roles and tracking verified job applications.", icons: { icon: "/favicon.svg" } };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body>{children}</body></html>; }
