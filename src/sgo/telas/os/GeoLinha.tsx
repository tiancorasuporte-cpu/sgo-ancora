import { useEffect, useState } from "react";

import { apiDc } from "@/sgo/lib/dc";

type Tec = { id: string | number; km: number | null; regiao?: string; ha?: string };

export function GeoLinha({ osId }: { osId?: string }) {
  const [txt, setTxt] = useState("");

  useEffect(() => {
    if (!osId) return;
    let vivo = true;
    apiDc("GET", "/api/geo/os?id=" + encodeURIComponent(osId))
      .then((r) => {
        if (!vivo || r.__status !== 200) return;
        const w = window as unknown as {
          SGO?: { equipes?: { tecnicos?: Array<Record<string, unknown>> }; geoOs?: { id: string; resumo: string } };
        };
        const lista = w.SGO?.equipes?.tecnicos || [];
        const por = new Map(((r.tecnicos as Tec[]) || []).map((t) => [String(t.id), t]));
        for (const e of lista) {
          const g = por.get(String(e.id));
          e.km = g && g.km != null ? g.km : null;
          e.regiao = g?.regiao || "";
          e.ha = g?.ha || "";
        }
        const resumo = String(r.resumo || "");
        if (w.SGO) w.SGO.geoOs = { id: osId, resumo };
        setTxt(resumo);
        window.dispatchEvent(new Event("sgo:pintar"));
      })
      .catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, [osId]);

  if (!txt) return null;
  return <div className="z4h">{txt}</div>;
}
