import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
// KaTeX CSS MUST be loaded before globals.css so the design
// system tokens can override KaTeX's defaults (color,
// background, etc.) when needed. The relative @font-face
// paths inside katex.min.css are rewritten by the Next.js
// bundler to `_next/static/media/...`, so the WOFF2 fonts
// ship self-hosted with zero CDN dependency.
import "katex/dist/katex.min.css";
import "./globals.css";
import { ClerkProvider } from "@clerk/nextjs";
import ConvexClientProvider from "@/components/ConvexClientProvider";
import { ThemeProvider } from "@/components/ThemeProvider";

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
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fafafa" },
    { media: "(prefers-color-scheme: dark)", color: "#09090b" },
  ],
};

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: {
    default: "Synedrix — The Personal Learning Operating System",
    template: "%s | Synedrix",
  },
  description:
    "Synedrix unifies the curriculum map, knowledge workspace, AI tutor, practice engine, and spaced repetition into one state-driven loop. Built for German Gymnasium students and the open-source community.",
  keywords: [
    "Synedrix",
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
    "Convex",
    "DeepSeek",
    "open source study app",
  ],
  authors: [{ name: "Ahmet Cetin" }],
  creator: "Ahmet Cetin",
  publisher: "Synedrix",
  openGraph: {
    type: "website",
    locale: "en_US",
    siteName: "Synedrix",
    title: "Synedrix — The Personal Learning Operating System",
    description:
      "Five systems, one state. From 'I don't get this' to 'I can solve this alone.'",
    url: BASE_URL,
    images: [
      {
        url: "/synedrix-github-banner.png",
        width: 1200,
        height: 630,
        alt: "Synedrix — the personal learning operating system",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Synedrix — The Personal Learning Operating System",
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
        suppressHydrationWarning
      >
        <head>
          <script
            dangerouslySetInnerHTML={{
              __html: `
                try {
                  var t = localStorage.getItem("theme");
                  var d = document.documentElement;
                  if (t === "dark" || (t !== "light" && window.matchMedia("(prefers-color-scheme: dark)").matches)) {
                    d.setAttribute("data-theme", "dark");
                    d.style.colorScheme = "dark";
                  } else {
                    d.setAttribute("data-theme", "light");
                    d.style.colorScheme = "light";
                  }
                } catch(e) {}
              `,
            }}
          />
        </head>
        <body className="min-h-full flex flex-col">
          <ThemeProvider>
            <ConvexClientProvider>{children}</ConvexClientProvider>
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
