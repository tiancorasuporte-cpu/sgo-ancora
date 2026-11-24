import type { SgoEu } from "@/sgo/lib/api";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function montar(eu: SgoEu | null): { Component: any; cfg: { colecao: string; chave: string; local?: string[] } };
