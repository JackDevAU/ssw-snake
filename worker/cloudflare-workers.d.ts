declare module 'cloudflare:workers' {
  export class DurableObject {
    protected ctx: any;
    protected env: any;
    constructor(ctx: any, env: any);
  }
}
