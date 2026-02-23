import type { NextRequest, NextResponse } from "next/server";

export const OWNER_TOKENS_COOKIE = "atsumeru_owner_tokens";

const TOKEN_REGEX = /^[a-f0-9]{32}$/i;
const MAX_TOKENS = 50;
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

export function parseOwnerTokens(rawValue: string | undefined | null): string[] {
  if (!rawValue) return [];

  const deduped = new Set<string>();
  for (const token of rawValue.split(",")) {
    const normalized = token.trim().toLowerCase();
    if (!TOKEN_REGEX.test(normalized)) continue;
    deduped.add(normalized);
    if (deduped.size >= MAX_TOKENS) break;
  }

  return Array.from(deduped);
}

export function readOwnerTokensFromRequest(req: NextRequest): string[] {
  return parseOwnerTokens(req.cookies.get(OWNER_TOKENS_COOKIE)?.value);
}

export function mergeOwnerTokens(existingTokens: string[], tokenToAdd: string): string[] {
  const normalizedToken = tokenToAdd.trim().toLowerCase();
  if (!TOKEN_REGEX.test(normalizedToken)) return existingTokens;

  const merged = [normalizedToken, ...existingTokens.filter((token) => token !== normalizedToken)];
  return merged.slice(0, MAX_TOKENS);
}

export function writeOwnerTokensCookie(res: NextResponse, tokens: string[]) {
  if (!tokens.length) return;

  res.cookies.set(OWNER_TOKENS_COOKIE, tokens.join(","), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ONE_YEAR_SECONDS,
  });
}
