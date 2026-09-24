import { AmbientBackground } from "@/components/layout/AmbientBackground";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Welcome — Presense",
  description: "Set up Presense.",
};

// No MotionProvider: the wizard animates with CSS only, so onboarding ships
// without framer-motion.
export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <AmbientBackground />
      {children}
    </>
  );
}
