import { describe, expect, it, vi } from "vitest";

import type { ArrangementScore, Deliverable } from "../../lib/music-domain.js";
import type { WorkspaceStore } from "./workspace-store.js";
import { persistDeliverable } from "./deliverable-service.js";

describe("deliverable projection identity", () => {
  it("records the sanitizer policy and changes preview identity when the policy changes", () => {
    const saved: Deliverable[] = [];
    const store = {
      get: () => ({ deliverableIds: [] }),
      saveDeliverable: vi.fn((_workspaceId: string, deliverable: Deliverable, _content: Buffer) => {
        saved.push(deliverable);
        return deliverable;
      }),
    } as unknown as WorkspaceStore;
    const arrangement = {
      id: "arrangement.1234567890abcdef",
      version: 1,
      targetConfiguration: { notationLayouts: ["tab-and-staff"] },
    } as ArrangementScore;
    const create = (artifactPolicyVersion: string) =>
      persistDeliverable(store, "workspace.1234567890abcdef", arrangement, {
        kind: "browser_preview",
        mimeType: "image/svg+xml",
        extension: "svg",
        content: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'),
        artifactPolicyVersion,
      });

    const first = create("policy-v1");
    const second = create("policy-v2");

    expect(first.id).not.toBe(second.id);
    expect(saved.map((item) => item.artifactPolicyVersion)).toEqual(["policy-v1", "policy-v2"]);
    expect(
      saved.every(
        (item) => item.sha256 === "900fbe934249ad120004bd24adf66aad8817d89586273c0cc50e187bddebb601"
      )
    ).toBe(true);
  });
});
