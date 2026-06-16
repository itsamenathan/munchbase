import type { Metadata } from "next";
import "./styles.css";

export const metadata: Metadata = {
  title: "Munchbase",
  description: "Self-hosted restaurant tracker",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
