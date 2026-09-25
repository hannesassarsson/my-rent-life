import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";

import { unlockDoor } from "@/lib/keys.functions";
import { KeyCard, type KeyCardState } from "@/components/key-card";
import { Logo } from "@/components/app-shell";
import { Button } from "@/components/ui/button";

/**
 * Hit leder NFC-etiketten vid dörren (adressen /n/<dörrens id>). När
 * telefonen hålls mot etiketten öppnas sidan och dörren låses upp direkt,
 * om man har behörighet. Är man inte inloggad skickas man först till
 * inloggningen och sedan tillbaka hit.
 */
export const Route = createFileRoute("/_authenticated/n/$doorId")({
  head: () => ({ meta: [{ title: "Lås upp – Boendeplattformen" }] }),
  component: NfcUnlockPage,
});

function NfcUnlockPage() {
  const { doorId } = Route.useParams();
  const unlockFn = useServerFn(unlockDoor);
  const [state, setState] = useState<KeyCardState>("working");
  const [door, setDoor] = useState("Dörren");
  const [message, setMessage] = useState<string>();
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    unlockFn({ data: { doorId, method: "nfc" } })
      .then((r) => {
        setDoor(r.door);
        setState(r.result);
        setMessage(r.result === "granted" ? "Välkommen in – dörren är upplåst" : r.reason);
        if (r.result === "granted" && "vibrate" in navigator) navigator.vibrate?.(120);
      })
      .catch((e: Error) => {
        setState("denied");
        setMessage(e.message);
      });
  }, [doorId, unlockFn]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 bg-background px-5 py-10">
      <Logo />
      <div className="w-full max-w-sm">
        <KeyCard name={door} subtitle="NFC" state={state} {...(message ? { message } : {})} />
      </div>
      <div className="flex gap-2">
        <Button variant="outline" asChild>
          <Link to="/app/nycklar">Mina nycklar</Link>
        </Button>
      </div>
    </div>
  );
}
