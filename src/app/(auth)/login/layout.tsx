import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Login — Presense",
  description: "Sign in to your Presense account.",
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
