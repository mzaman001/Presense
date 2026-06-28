import { AmbientBackground } from "@/components/layout/AmbientBackground";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Welcome — Presense",
  description: "Set up your Presense external brain.",
};

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AmbientBackground />
      {children}
    </>
  );
}
