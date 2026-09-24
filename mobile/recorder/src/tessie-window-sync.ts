import { parseTessieSnapshot, type TessieSnapshot } from './tessie-contract';

/** Tessie has no history cursor. Split only its explicit saturated-window error. */
export async function fetchTessieSnapshotAdaptive(
  from: Date,
  to: Date,
  requestWindow: (from: string, to: string) => Promise<unknown>,
): Promise<TessieSnapshot> {
  let calls = 0;
  const visit = async (start: Date, end: Date, depth: number): Promise<TessieSnapshot> => {
    if (++calls > 32) throw new Error('Tessie history requires too many windows. Try again later.');
    try {
      return parseTessieSnapshot(await requestWindow(start.toISOString(), end.toISOString()));
    } catch (error) {
      const message = error && typeof error === 'object' && 'message' in error ? String(error.message) : '';
      if (!message.includes('Tessie history window is too large')
        || depth >= 12 || end.getTime() - start.getTime() < 5 * 60_000) throw error;
      const middle = new Date(Math.floor((start.getTime() + end.getTime()) / 2_000) * 1_000);
      const left = await visit(start, middle, depth + 1);
      const right = await visit(middle, end, depth + 1);
      return parseTessieSnapshot({ generatedAt: right.generatedAt, vehicles: right.vehicles,
        drives: [...new Map([...left.drives, ...right.drives].map(item => [item.id, item])).values()],
        charges: [...new Map([...left.charges, ...right.charges].map(item => [item.id, item])).values()] });
    }
  };
  return visit(from, to, 0);
}
