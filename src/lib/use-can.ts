import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { getMe } from "@/lib/app.functions";
import type { Permission } from "@/lib/permissions";

/** Returnerar en funktion som svarar på om inloggad användare har en behörighet. */
export function useCan() {
  const getMeFn = useServerFn(getMe);
  const { data } = useQuery({ queryKey: ["me"], queryFn: () => getMeFn() });
  const permissions: readonly string[] = data?.permissions ?? [];
  return (permission: Permission) => permissions.includes(permission);
}
