import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Learn Hermes Agent",
  description: "Understand 24 core mechanisms of Hermes Agent v0.19.0",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return children;
}
