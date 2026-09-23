import { House, Inbox, Check, Brain, MessageSquare } from "lucide-react";

export const navItems = [
  { href: "/", label: "Home", icon: House, shortcut: "6", bottom: true },
  { href: "/inbox", label: "Inbox", icon: Inbox, shortcut: "1", bottom: false },
  { href: "/do", label: "Do", icon: Check, shortcut: "2", bottom: true },
  {
    href: "/remember/locations",
    label: "Remember",
    icon: Brain,
    shortcut: "3",
    bottom: true,
  },
  {
    href: "/think",
    label: "Think",
    icon: MessageSquare,
    shortcut: "4",
    bottom: true,
  },
] as const;

export function isNavActive(pathname: string, href: string): boolean {
  const root = href === "/remember/locations" ? "/remember" : href;
  return pathname === root || (root !== "/" && pathname.startsWith(`${root}/`));
}
