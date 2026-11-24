import { createFileRoute, useRouter } from "@tanstack/react-router";

import { AppShell } from "@/components/AppShell";
import {
  IntegracoesApisSettings,
  loadIntegracoesApisData,
} from "@/components/IntegracoesApisSettings";
import { isSuperadmin, requireAdmin } from "@/lib/require-auth";
import { APP_NAME } from "@/lib/brand";
import { Route as RootRoute } from "@/routes/__root";

export const Route = createFileRoute("/configuracoes_/integracoes")({
  beforeLoad: requireAdmin,
  loader: async () => loadIntegracoesApisData(),
  head: () => ({
    meta: [{ title: `Integrações e APIs — ${APP_NAME}` }],
  }),
  component: IntegracoesPage,
});

function IntegracoesPage() {
  const data = Route.useLoaderData();
  const { user } = RootRoute.useRouteContext();
  const router = useRouter();

  return (
    <AppShell mobileTitle="Integrações e APIs">
      <main className="flex-1 p-margin-mobile md:p-margin-desktop">
        <IntegracoesApisSettings
          data={data}
          showGroq={isSuperadmin(user)}
          onSaved={() => router.invalidate()}
        />
      </main>
    </AppShell>
  );
}
