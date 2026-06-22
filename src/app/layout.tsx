import type { Metadata } from "next";
import { NetworkProvider } from "@/hooks/use-network-status";
import { ThemeProvider } from "@/hooks/use-theme";
import "./styles/index.css";

export const metadata: Metadata = {
  title: "Munchbase",
  description: "Self-hosted restaurant tracker",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/icons/icon-192.png", type: "image/png", sizes: "192x192" },
    ],
    apple: [{ url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Munchbase",
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export const viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#0055da" },
    { media: "(prefers-color-scheme: dark)", color: "#090c1b" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function () {
                try {
                  var choice = localStorage.getItem("munchbase-theme") || "system";
                  if (choice !== "light" && choice !== "dark" && choice !== "system" && choice !== "lavender" && choice !== "lavender-dark") choice = "system";
                  var system = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
                  var effective = choice === "system" ? system : (choice === "dark" || choice === "lavender-dark" ? "dark" : "light");
                  document.documentElement.dataset.themeChoice = choice;
                  document.documentElement.dataset.theme = choice === "system" ? effective : choice;
                  document.documentElement.style.colorScheme = effective;
                } catch (_) {}
              })();
            `,
          }}
        />
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
      </head>
      <body>
        <ThemeProvider>
          <NetworkProvider>{children}</NetworkProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
