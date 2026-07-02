import { AmbientBackground } from "@/components/layout/AmbientBackground";
import { MotionProvider } from "@/components/layout/MotionProvider";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Welcome — Presense",
  description: "Set up your Presense external brain.",
};

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <MotionProvider>
      <AmbientBackground />
      {children}
    </MotionProvider>
  );
}
