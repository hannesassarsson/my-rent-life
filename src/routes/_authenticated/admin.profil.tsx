import { createFileRoute } from "@tanstack/react-router";

import { ProfilePage } from "@/components/profile-page";

export const Route = createFileRoute("/_authenticated/admin/profil")({
  component: ProfilePage,
});
