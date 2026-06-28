import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Remember Locations — Presense",
};

export default function LocationsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
