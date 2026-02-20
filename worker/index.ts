import { DurableObject } from 'cloudflare:workers';
import { renderLeaderboardHtml } from './LeaderboardPage';
import type { LeaderboardEntry } from './types';

const LEADERBOARD_INSTANCE = 'global';
const RUN_START_API_PATH = '/api/run/start';
const LEADERBOARD_API_PATH = '/api/leaderboard';
const LEADERBOARD_PAGE_PATH = '/leaderboard';

const RUN_TOKEN_TTL_MS = 20 * 60 * 1000;

const CACHE_BUSTED_ASSET_PATTERN = /\.[a-f0-9]{8,}\./i;
const SQL_UNIQUE_CONSTRAINT_PATTERN = /(UNIQUE constraint failed|constraint failed)/i;
const RUN_TOKEN_PATTERN = /^[A-Za-z0-9._-]{20,220}$/;

type SubmitErrorCode = 'ALREADY_SUBMITTED' | 'INVALID_RUN_TOKEN' | 'RUN_TOKEN_EXPIRED';

interface SubmitResult {
  ok: boolean;
  error?: string;
  code?: SubmitErrorCode;
}

interface RunStartResult {
  ok: boolean;
  runId?: string;
  token?: string;
  issuedAt?: number;
  expiresAt?: number;
  error?: string;
}

interface RunStartPayload {
  runId: string;
  token: string;
  issuedAt: number;
  expiresAt: number;
}

interface LeaderboardApiPayload {
  player?: unknown;
  claimedScore?: unknown;
  score?: unknown;
  runId?: unknown;
  token?: unknown;
}

interface LeaderboardStub {
  top(limit?: number): Promise<LeaderboardEntry[]>;
  startRun(): Promise<RunStartResult>;
  submit(player: unknown, claimedScore: unknown, runId: unknown, token: unknown): Promise<SubmitResult>;
}

interface AssetFetcher {
  fetch(request: Request): Promise<Response>;
}

interface Env {
  LEADERBOARD: {
    getByName(name: string): LeaderboardStub;
  };
  ASSETS: AssetFetcher;
}

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

const methodNotAllowed = (allow: string): Response =>
  new Response('Method Not Allowed', {
    status: 405,
    headers: { Allow: allow },
  });

const withSecurityHeaders = (response: Response, pathname: string): Response => {
  const headers = new Headers(response.headers);
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('X-Frame-Options', 'DENY');
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  headers.set('Cross-Origin-Resource-Policy', 'same-origin');

  if (pathname === '/' || pathname.endsWith('.html') || pathname === LEADERBOARD_PAGE_PATH) {
    headers.set('Cache-Control', 'public, max-age=0, must-revalidate');
  } else if (CACHE_BUSTED_ASSET_PATTERN.test(pathname)) {
    headers.set('Cache-Control', 'public, max-age=31536000, immutable');
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
};

const json = (data: unknown, status = 200): Response =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });

const normalizePlayer = (input: unknown): string | null => {
  if (typeof input !== 'string') return null;
  const cleaned = input.trim().replace(/\s+/g, ' ').slice(0, 24);
  return cleaned || null;
};

const normalizeScore = (input: unknown): number | null => {
  const value = Number(input);
  if (!Number.isFinite(value)) return null;
  return clamp(Math.floor(value), 0, 999999);
};

const normalizeIdentifier = (input: unknown): string | null => {
  if (typeof input !== 'string') return null;
  const value = input.trim();
  if (!/^[a-zA-Z0-9_-]{8,100}$/.test(value)) return null;
  return value;
};

const normalizeRunToken = (input: unknown): string | null => {
  if (typeof input !== 'string') return null;
  const value = input.trim();
  if (!RUN_TOKEN_PATTERN.test(value)) return null;
  return value;
};

const parseJsonBody = async <T>(request: Request): Promise<T | null> => {
  try {
    return (await request.json()) as T;
  } catch {
    return null;
  }
};

const isDuplicateConstraintError = (error: unknown): boolean => {
  if (!error) return false;
  return SQL_UNIQUE_CONSTRAINT_PATTERN.test(String(error));
};

const bytesToBase64Url = (bytes: ArrayBuffer | Uint8Array): string => {
  const uint8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = '';

  for (let i = 0; i < uint8.length; i += 1) {
    binary += String.fromCharCode(uint8[i]);
  }

  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
};

const timingSafeEqual = (a: string, b: string): boolean => {
  if (a.length !== b.length) return false;

  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return diff === 0;
};
const textEncoder = new TextEncoder();

const sha256Base64Url = async (value: string): Promise<string> => {
  const digest = await crypto.subtle.digest('SHA-256', textEncoder.encode(value));
  return bytesToBase64Url(digest);
};

export class Leaderboard extends DurableObject {
  constructor(ctx: any, env: unknown) {
    super(ctx, env);
    ctx.blockConcurrencyWhile(async () => {
      this.initializeSchema();
    });
  }

  private initializeSchema(): void {
    this.ctx.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS leaderboard (
        player TEXT PRIMARY KEY,
        score INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `);

    this.ctx.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS run_tokens (
        run_id TEXT PRIMARY KEY,
        issued_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL,
        token_hash TEXT NOT NULL,
        consumed_at INTEGER
      )
    `);
  }

  async top(limit = 20): Promise<LeaderboardEntry[]> {
    const safeLimit = clamp(Number(limit) || 20, 1, 100);

    return this.ctx.storage.sql
      .exec(
        `SELECT player, score, updated_at AS updatedAt
         FROM leaderboard
         ORDER BY score DESC, updated_at ASC
         LIMIT ?`,
        safeLimit,
      )
      .toArray() as LeaderboardEntry[];
  }

  async startRun(): Promise<RunStartResult> {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const runId = `run-${crypto.randomUUID()}`;
      const issuedAt = Date.now();
      const expiresAt = issuedAt + RUN_TOKEN_TTL_MS;

      const token = `${issuedAt}.${expiresAt}.${crypto.randomUUID().replaceAll('-', '')}`;
      const tokenHash = await sha256Base64Url(token);

      try {
        this.ctx.storage.sql.exec(
          `INSERT INTO run_tokens (run_id, issued_at, expires_at, token_hash, consumed_at)
           VALUES (?, ?, ?, ?, NULL)`,
          runId,
          issuedAt,
          expiresAt,
          tokenHash,
        );

        return {
          ok: true,
          runId,
          token,
          issuedAt,
          expiresAt,
        };
      } catch (error) {
        if (isDuplicateConstraintError(error)) {
          continue;
        }
        throw error;
      }
    }

    return { ok: false, error: 'Unable to initialize run' };
  }

  private async validateAndConsumeRunToken(runId: string, token: string): Promise<SubmitResult | null> {
    const tokenHash = await sha256Base64Url(token);

    const row = this.ctx.storage.sql
      .exec(
        `SELECT issued_at, expires_at, token_hash, consumed_at
         FROM run_tokens
         WHERE run_id = ?
         LIMIT 1`,
        runId,
      )
      .toArray()[0] as
      | {
          issued_at: number;
          expires_at: number;
          token_hash: string;
          consumed_at: number | null;
        }
      | undefined;

    if (!row) {
      return { ok: false, error: 'Invalid run token', code: 'INVALID_RUN_TOKEN' };
    }

    if (row.consumed_at !== null && row.consumed_at !== undefined) {
      return { ok: false, error: 'Score already submitted for this run', code: 'ALREADY_SUBMITTED' };
    }

    const now = Date.now();
    if (now > Number(row.expires_at)) {
      return { ok: false, error: 'Run token expired', code: 'RUN_TOKEN_EXPIRED' };
    }

    if (!timingSafeEqual(tokenHash, String(row.token_hash))) {
      return { ok: false, error: 'Invalid run token', code: 'INVALID_RUN_TOKEN' };
    }

    this.ctx.storage.sql.exec(
      `UPDATE run_tokens
       SET consumed_at = ?
       WHERE run_id = ?
         AND consumed_at IS NULL`,
      now,
      runId,
    );

    return null;
  }

  private upsertPlayerScore(player: string, score: number, updatedAt: number): void {
    const current = this.ctx.storage.sql
      .exec(`SELECT score FROM leaderboard WHERE player = ? LIMIT 1`, player)
      .toArray()[0] as { score: number } | undefined;

    if (!current) {
      this.ctx.storage.sql.exec(
        `INSERT INTO leaderboard (player, score, updated_at) VALUES (?, ?, ?)`,
        player,
        score,
        updatedAt,
      );
      return;
    }

    if (score > Number(current.score)) {
      this.ctx.storage.sql.exec(
        `UPDATE leaderboard SET score = ?, updated_at = ? WHERE player = ?`,
        score,
        updatedAt,
        player,
      );
    }
  }

  async submit(player: unknown, claimedScore: unknown, runId: unknown, token: unknown): Promise<SubmitResult> {
    const safePlayer = normalizePlayer(player);
    const safeScore = normalizeScore(claimedScore);
    const safeRunId = normalizeIdentifier(runId);
    const safeToken = normalizeRunToken(token);

    if (!safePlayer || safeScore === null || !safeRunId || !safeToken) {
      return { ok: false, error: 'Invalid player, score, or run token' };
    }

    const consumedResult = await this.validateAndConsumeRunToken(safeRunId, safeToken);
    if (consumedResult) {
      return consumedResult;
    }

    this.upsertPlayerScore(safePlayer, safeScore, Date.now());

    return { ok: true };
  }
}

const handleRunStartApi = async (
  request: Request,
  leaderboard: LeaderboardStub,
): Promise<Response> => {
  const method = request.method.toUpperCase();
  if (method !== 'POST') {
    return methodNotAllowed('POST');
  }

  const result = await leaderboard.startRun();
  if (!result.ok || !result.runId || !result.token || !result.issuedAt || !result.expiresAt) {
    return json({ error: result.error ?? 'Unable to initialize run' }, 500);
  }

  const payload: RunStartPayload = {
    runId: result.runId,
    token: result.token,
    issuedAt: result.issuedAt,
    expiresAt: result.expiresAt,
  };

  return json(payload);
};

const handleLeaderboardApi = async (
  request: Request,
  leaderboard: LeaderboardStub,
  url: URL,
): Promise<Response> => {
  const method = request.method.toUpperCase();

  if (method === 'GET') {
    const limit = clamp(Number(url.searchParams.get('limit')) || 20, 1, 100);
    const entries = await leaderboard.top(limit);
    return json({ entries });
  }

  if (method === 'POST') {
    const payload = await parseJsonBody<LeaderboardApiPayload>(request);
    if (!payload) {
      return json({ error: 'Invalid JSON payload' }, 400);
    }

    const safeRunId = normalizeIdentifier(payload.runId);
    const safeToken = normalizeRunToken(payload.token);
    if (!safeRunId || !safeToken) {
      return json(
        { error: 'Missing run token. Refresh the app (or rebuild dist before wrangler dev).' },
        428,
      );
    }

    const claimedScore = payload.claimedScore ?? payload.score;
    const result = await leaderboard.submit(payload.player, claimedScore, safeRunId, safeToken);

    if (!result.ok) {
      if (result.code === 'ALREADY_SUBMITTED') {
        return json({ error: result.error }, 409);
      }

      if (result.code === 'RUN_TOKEN_EXPIRED') {
        return json({ error: result.error }, 410);
      }

      return json({ error: result.error }, 400);
    }

    const entries = await leaderboard.top(20);
    return json({ entries });
  }

  return methodNotAllowed('GET, POST');
};

const handleLeaderboardPage = async (request: Request, leaderboard: LeaderboardStub): Promise<Response> => {
  const method = request.method.toUpperCase();
  if (method !== 'GET' && method !== 'HEAD') {
    return methodNotAllowed('GET, HEAD');
  }

  const entries = await leaderboard.top(100);
  const html = renderLeaderboardHtml(entries);

  return withSecurityHeaders(
    new Response(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    }),
    LEADERBOARD_PAGE_PATH,
  );
};

const handleAssetRequest = async (request: Request, env: Env, url: URL): Promise<Response> => {
  let response = await env.ASSETS.fetch(request);

  const isLikelyClientRoute =
    response.status === 404 &&
    !url.pathname.includes('.') &&
    !url.pathname.startsWith('/api/');

  if (isLikelyClientRoute) {
    const spaUrl = new URL(request.url);
    spaUrl.pathname = '/index.html';
    response = await env.ASSETS.fetch(new Request(spaUrl.toString(), request));
  }

  if (!response.ok) return response;
  return withSecurityHeaders(response, url.pathname);
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const method = request.method.toUpperCase();
    const url = new URL(request.url);
    const leaderboard = env.LEADERBOARD.getByName(LEADERBOARD_INSTANCE);

    if (url.pathname === RUN_START_API_PATH) {
      return handleRunStartApi(request, leaderboard);
    }

    if (url.pathname === LEADERBOARD_API_PATH) {
      return handleLeaderboardApi(request, leaderboard, url);
    }

    if (url.pathname === LEADERBOARD_PAGE_PATH) {
      return handleLeaderboardPage(request, leaderboard);
    }

    if (method !== 'GET' && method !== 'HEAD') {
      return methodNotAllowed('GET, HEAD');
    }

    return handleAssetRequest(request, env, url);
  },
};
