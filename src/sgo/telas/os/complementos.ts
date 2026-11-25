/**
 * Complementos da tela de OS. Entram no bundle do navegador como texto e rodam
 * na hora em que o quadro abre. Um import solto era descartado no build de
 * produção, e a via do cliente, o fechamento e o envio para a Omie sumiam.
 */
import etapas from "./etapas.js?raw";
import fechamento from "./fechamento.js?raw";
import omieEnvio from "./omie-envio.js?raw";
import viaBotoes from "./via-botoes.js?raw";
import viaMontar from "./via-montar.js?raw";

let ligado = false;

export function ligarComplementosOs() {
  if (ligado || typeof window === "undefined") return;
  ligado = true;
  for (const codigo of [fechamento, etapas, viaMontar, viaBotoes, omieEnvio]) {
    // Mesmo padrão da TelaIsolada: o texto da tela original roda no navegador.
    // eslint-disable-next-line @typescript-eslint/no-implied-eval
    new Function(codigo)();
  }
}
