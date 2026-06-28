import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Remember People — Presense",
};

export default function PeopleLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
