import { AmbientBackground } from "@/components/layout/AmbientBackground";

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AmbientBackground />
      {children}
    </>
  );
}
