import type { AppRole } from './app-navigation.ts';

export type ParsedPrincipal = {
  id: number;
  role: AppRole | null;
  name: string;
  email: string;
};

export function isAppRole(role: unknown): role is AppRole {
  return role === 'COACH' || role === 'ATHLETE';
}

export function parseApplicationUserId(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isSafeInteger(value) && value > 0 ? value : null;
  }

  if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

export function parseSessionPrincipal(user: unknown): ParsedPrincipal | null {
  if (!user || typeof user !== 'object') return null;

  const candidate = user as {
    id?: unknown;
    role?: unknown;
    name?: unknown;
    email?: unknown;
  };
  const id = parseApplicationUserId(candidate.id);
  if (id === null) return null;
  if (candidate.role !== null && candidate.role !== undefined && !isAppRole(candidate.role)) {
    return null;
  }

  return {
    id,
    name: typeof candidate.name === 'string' ? candidate.name : '',
    email: typeof candidate.email === 'string' ? candidate.email : '',
    role: isAppRole(candidate.role) ? candidate.role : null,
  };
}
