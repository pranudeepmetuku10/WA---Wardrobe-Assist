"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/", label: "Today", icon: "sun" },
  { href: "/wardrobe", label: "Wardrobe", icon: "grid" },
  { href: "/history", label: "History", icon: "clock" },
  { href: "/profile", label: "Style", icon: "person" },
] as const;

/**
 * Bottom tab bar on a phone, top bar on a desktop. Same routes either way —
 * this is one web app, not a mobile build and a desktop build.
 */
export function AppNav() {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <>
      {/* Desktop */}
      <header className="sticky top-0 z-20 hidden border-b border-border bg-background/90 backdrop-blur sm:block">
        <nav className="mx-auto flex w-full max-w-5xl items-center gap-1 px-8 py-3">
          <Link href="/" className="mr-4 text-sm font-semibold tracking-tight">
            Wardrobe
          </Link>
          {TABS.map((tab) => (
            <Link
              key={tab.href}
              href={tab.href}
              className={`rounded-full px-3 py-1.5 text-sm transition ${
                isActive(tab.href)
                  ? "bg-accent text-accent-foreground"
                  : "text-muted hover:text-foreground"
              }`}
            >
              {tab.label}
            </Link>
          ))}
          <Link
            href="/add"
            className="ml-auto rounded-full border border-border px-3 py-1.5 text-sm"
          >
            Add clothes
          </Link>
        </nav>
      </header>

      {/* Mobile */}
      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur sm:hidden">
        <ul className="flex">
          {TABS.map((tab) => (
            <li key={tab.href} className="flex-1">
              <Link
                href={tab.href}
                className={`flex h-14 flex-col items-center justify-center gap-0.5 text-[11px] ${
                  isActive(tab.href) ? "text-accent" : "text-muted"
                }`}
              >
                <Icon name={tab.icon} active={isActive(tab.href)} />
                {tab.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </>
  );
}

function Icon({ name, active }: { name: string; active: boolean }) {
  const stroke = active ? 2 : 1.5;
  const common = {
    width: 20,
    height: 20,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: stroke,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  if (name === "sun") {
    return (
      <svg {...common} aria-hidden>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M19 5l-1.5 1.5M6.5 17.5L5 19" />
      </svg>
    );
  }
  if (name === "grid") {
    return (
      <svg {...common} aria-hidden>
        <rect x="3" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" />
        <rect x="14" y="14" width="7" height="7" rx="1.5" />
      </svg>
    );
  }
  if (name === "clock") {
    return (
      <svg {...common} aria-hidden>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </svg>
    );
  }
  return (
    <svg {...common} aria-hidden>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20c1.2-3.5 4-5 7-5s5.8 1.5 7 5" />
    </svg>
  );
}
