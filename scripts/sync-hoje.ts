import { reloadEnvFromFile } from "../src/db/client";
import { syncTodayFaturamento } from "../src/server/omie/sync";

reloadEnvFromFile();

console.log("Sync URGENTE — notas/boletos faturados HOJE");
console.log("Empresas:", process.env.OMIE_APPS);
console.log("TZ:", process.env.TZ || Intl.DateTimeFormat().resolvedOptions().timeZone);
console.log("Agora:", new Date().toString());

const result = await syncTodayFaturamento((p) => {
  console.log(`${String(p.percent).padStart(3, " ")}%  ${p.label}`);
});

if (!result.ok) {
  console.error("Falha:", result.error);
  process.exit(1);
}

let total = 0;
for (const item of result.results) {
  if (!item.ok) {
    console.log(`- ${item.appName ?? item.appId}: ERRO ${item.error}`);
    continue;
  }
  total += item.itemsFound ?? 0;
  const breakdown = item.breakdown
    ? Object.entries(item.breakdown)
        .map(([key, value]) => `${key}=${value}`)
        .join(", ")
    : "";
  const warn = item.errors?.length ? ` | avisos: ${item.errors.join("; ")}` : "";
  console.log(`- ${item.appName ?? item.appId}: ${item.itemsFound} registros [${breakdown}]${warn}`);
}

console.log(`Concluído. Total gravado/atualizado: ${total}`);
