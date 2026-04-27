import { describe, it } from "vitest";

export type TestCase = { name: string; [key: string]: unknown };

export function tableTest<TCase extends TestCase>(
  description: string,
  cases: TCase[],
  run: (tc: TCase) => Promise<void> | void
): void {
  describe(description, () => {
    for (const tc of cases) {
      it(tc.name, () => run(tc));
    }
  });
}
