import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { getMe } from "@/lib/app.functions";
import { orgProfileFor } from "@/lib/org-profile";

/** Ger organisationens profil (hyresvärd eller BRF) baserat på inloggad användare. */
export function useOrgProfile() {
  const getMeFn = useServerFn(getMe);
  const { data: me } = useQuery({ queryKey: ["me"], queryFn: () => getMeFn() });
  return { me, profile: orgProfileFor(me?.organization?.org_type), orgType: me?.organization?.org_type };
}
