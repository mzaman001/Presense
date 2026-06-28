import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Do — Presense",
};

export default function DoLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
