import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Learn Hermes Agent",
  description: "Understand 19 core mechanisms of a production AI agent",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return children;
}
