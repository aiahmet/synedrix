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
    default: "Synedrix — Das persönliche Lern-Betriebssystem",
    template: "%s | Synedrix",
  },
  description:
    "Synedrix vereint Lehrplan, Wissensdatenbank, KI-Tutor, Practice Engine und Spaced Repetition in einem einzigen Lernkreislauf. Entwickelt für deutsche Gymnasiasten und die Open-Source-Community.",
  keywords: [
    "Synedrix",
    "KI-Tutor",
    "Spaced Repetition",
    "Lern-App",
    "Gymnasium",
    "Abitur",
    "Oberstufe",
    "Lernplattform",
    "KI-Bildung",
    "Übungen generieren",
    "Lehrplan-Mapping",
    "Fehlerjournal",
    "Karteikarten-App",
    "Convex",
    "Next.js",
    "Open-Source",
  ],
  authors: [{ name: "Ahmet Cetin" }],
  creator: "Ahmet Cetin",
  publisher: "Synedrix",
  openGraph: {
    type: "website",
    locale: "de_DE",
    siteName: "Synedrix",
    title: "Synedrix — Das persönliche Lern-Betriebssystem",
    description:
      "Fünf Systeme, ein Zustand. Vom 'Ich verstehe das nicht' zum 'Ich kann das alleine lösen.'",
    url: BASE_URL,
    images: [
      {
        url: "/synedrix-github-banner.png",
        width: 1200,
        height: 630,
        alt: "Synedrix — Das persönliche Lern-Betriebssystem",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Synedrix — Das persönliche Lern-Betriebssystem",
    description:
      "Fünf Systeme, ein Zustand. Vom 'Ich verstehe das nicht' zum 'Ich kann das alleine lösen.'",
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
        lang="de"
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
