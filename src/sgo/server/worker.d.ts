// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const worker: { fetch(request: Request, env: any): Promise<Response> };
export default worker;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function usuarioDaSessao(request: Request, env: any): Promise<any>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function ehAdmin(u: any): boolean;
