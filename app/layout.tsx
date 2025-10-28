import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Provider } from "./provider";
import { HydrationBoundary } from "@/components/hydration-boundary";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Doable - Modern Team Task Management. Elevated.",
  description: "Built for teams who want to get things done. Clean, fast, and powerful task management. Free forever, open source.",
  keywords: ["task management", "team collaboration", "project management", "kanban", "agile", "productivity", "open source"],
  authors: [{ name: "Kartik Labhshetwar" }],
  creator: "Kartik Labhshetwar",
  publisher: "Kartik Labhshetwar",
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
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://doable-lyart.vercel.app/",
    siteName: "Doable",
    title: "Doable - Modern Team Task Management. Elevated.",
    description: "Built for teams who want to get things done. Clean, fast, and powerful task management with Swiss design principles.",
    images: [
      {
        url: "/open-graph.png",
        width: 1200,
        height: 630,
        alt: "Doable - Modern Team Task Management Platform",
        type: "image/png",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    site: "@code_kartik",
    creator: "@code_kartik",
    title: "Doable - Modern Team Task Management. Elevated.",
    description: "Built for teams who want to get things done. Clean, fast, and powerful task management with Swiss design principles. Free forever, open source.",
    images: ["/open-graph.png"],
  },
  alternates: {
    canonical: "https://doable-lyart.vercel.app/",
  },
  category: "productivity",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
      <script defer src="https://cloud.umami.is/script.js" data-website-id="158d23fd-3fec-46cb-a533-9f1136de3fe7"></script>
      </head>
      <body className={inter.className}>
        <HydrationBoundary>
          <Provider>{children}</Provider>
        </HydrationBoundary>
      </body>
    </html>
  );
}
