import { beforeAll, describe, expect, it } from 'vitest';
import { PERSONAS } from '../src/store/seed';
import type { Profile } from '../src/types';

const mem = new Map<string, string>();
beforeAll(() => { (globalThis as any).localStorage ??= { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v), removeItem: (k: string) => void mem.delete(k) }; });

const custom: Profile = { ...PERSONAS.iniciante.profile, nickname: 'Zé', goal: 'Vestibular', schoolId: undefined, institution: '', persona: 'custom' };

describe('perfil novo já vem com histórico', () => {
  it.each([...Object.values(PERSONAS).map((p) => p.profile), custom])('$nickname', async (profile) => {
    const { loadStudentWithHistory } = await import('../src/store/demoStudent');
    const { useStore } = await import('../src/store/useStore');
    loadStudentWithHistory(profile);
    const s = useStore.getState();
    expect(s.profile).toEqual(profile);
    expect(s.diagnosticDone).toBe(true);
    expect(s.attempts.length).toBeGreaterThan(20);
    expect(s.attempts.every((a) => a.ts <= Date.now())).toBe(true);
    expect(s.xpEvents.length).toBeGreaterThan(0);
    expect(s.essays).toHaveLength(3);
    expect(Object.keys(s.cardStates).length).toBe(18);
    expect(s.simHistory).toHaveLength(3);
    const n = s.attempts.length;
    loadStudentWithHistory(profile); // recarregar substitui, não acumula
    expect(Math.abs(useStore.getState().attempts.length - n)).toBeLessThan(3);
  });
});
