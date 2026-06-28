import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Think — Presense",
};

export default function ThinkLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
