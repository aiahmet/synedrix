import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ClerkProvider } from "@clerk/nextjs";
import ConvexClientProvider from "@/components/ConvexClientProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://synedrix.vercel.app";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0f172a",
};

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: {
    default: "Study OS — AI-Powered Learning Operating System",
    template: "%s | Study OS",
  },
  description:
    "Study OS unifies curriculum mapping, AI tutoring, practice generation, and spaced repetition into a single state-driven learning platform for German Gymnasium students.",
  keywords: [
    "AI tutor",
    "spaced repetition",
    "study app",
    "German Gymnasium",
    "Oberstufe",
    "learning platform",
    "AI education",
    "Next.js study app",
    "practice generation",
    "curriculum mapping",
    "mistake journal",
    "flashcard app",
  ],
  authors: [{ name: "Ahmet Cetin" }],
  creator: "Ahmet Cetin",
  publisher: "Synedrix",
  openGraph: {
    type: "website",
    locale: "en_US",
    siteName: "Study OS",
    title: "Study OS — AI-Powered Learning Operating System",
    description:
      "Five systems, one state. From 'I don't get this' to 'I can solve this alone.'",
    url: BASE_URL,
    images: [
      {
        url: "/synedrix-github-banner.png",
        width: 1200,
        height: 630,
        alt: "Study OS — The personal learning operating system",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Study OS — AI-Powered Learning Operating System",
    description:
      "Five systems, one state. From 'I don't get this' to 'I can solve this alone.'",
    images: ["/synedrix-github-banner.png"],
    creator: "@aiahmet",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  icons: {
    icon: "/favicon.ico",
  },
  manifest: "/manifest.webmanifest",
  category: "education",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html
        lang="en"
        className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      >
        <body className="min-h-full flex flex-col">
          <ConvexClientProvider>{children}</ConvexClientProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
