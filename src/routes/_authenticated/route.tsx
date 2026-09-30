import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data, error } = await supabase.auth.getUser();
    // Efter inloggning skickas man tillbaka hit, t.ex. från en NFC-länk vid en dörr.
    if (error || !data.user) {
      // Utgången session: rensa den så att inloggningssidan inte skickar tillbaka hit.
      if (error) await supabase.auth.signOut({ scope: "local" });
      throw redirect({ to: "/auth", search: { redirect: location.href } });
    }
    return { user: data.user };
  },
  component: () => <Outlet />,
});
