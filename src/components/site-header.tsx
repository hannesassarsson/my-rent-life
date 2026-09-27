import { Link } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";
import { Logo } from "@/components/app-shell";

/** Sidhuvud för de publika sidorna. */
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-5">
        <Logo />
        <div className="flex items-center gap-1 sm:gap-2">
          <Button variant="ghost" asChild className="hidden sm:inline-flex">
            <Link to="/priser">Priser</Link>
          </Button>
          <Button variant="ghost" asChild className="h-8 px-2.5 text-xs sm:h-9 sm:px-4 sm:text-sm">
            <Link to="/auth">Logga in</Link>
          </Button>
          <Button asChild className="h-8 px-2.5 text-xs sm:h-9 sm:px-4 sm:text-sm">
            <Link to="/boka-demo">Boka demo</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
