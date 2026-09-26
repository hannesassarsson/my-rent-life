import { useQueryErrorResetBoundary } from "@tanstack/react-query";
import { Link, useRouter } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";

/** Meddelanden från servern som är skrivna för användaren och kan visas som de är. */
const USER_MESSAGES = ["Behörighet saknas", "Ingen organisation", "hittades inte"];

/**
 * Visas när en sida inte kunde laddas. Renderas i stället för sidan men inom
 * layouten, så att menyn finns kvar.
 */
export function RouteError({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  const queryReset = useQueryErrorResetBoundary();
  console.error(error);
  const known = USER_MESSAGES.some((m) => error.message?.includes(m));

  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <h1 className="text-xl font-semibold tracking-tight text-foreground">
        Sidan kunde inte laddas
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {known
          ? error.message
          : "Något gick fel hos oss. Försök igen om en stund, eller gå tillbaka till startsidan."}
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <Button
          onClick={() => {
            queryReset.reset();
            reset();
            void router.invalidate();
          }}
        >
          Försök igen
        </Button>
        <Button variant="outline" asChild>
          <Link to="/">Till startsidan</Link>
        </Button>
      </div>
    </div>
  );
}
