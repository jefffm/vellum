import { createHash } from "node:crypto";
import type { ArrangementScore, Deliverable } from "../../lib/music-domain.js";
import type { WorkspaceStore } from "./workspace-store.js";

export function persistDeliverable(
  store: WorkspaceStore,
  workspaceId: string,
  arrangement: ArrangementScore,
  input: {
    kind: Deliverable["kind"];
    mimeType: string;
    content: Buffer;
    extension: string;
    notationLayout?: string;
    artifactPolicyVersion?: string;
  }
): Deliverable {
  const sha256 = createHash("sha256").update(input.content).digest("hex");
  const identity = createHash("sha256")
    .update(
      `vellum-projection-v1:${arrangement.id}:${arrangement.version}:${input.notationLayout ?? arrangement.targetConfiguration.notationLayouts[0]}:${input.kind}${input.artifactPolicyVersion ? `:${input.artifactPolicyVersion}` : ""}`
    )
    .digest("hex")
    .slice(0, 24);
  const id = `deliverable.${identity}`;
  if (store.get(workspaceId).deliverableIds.includes(id))
    return store.getDeliverable(workspaceId, id);
  const storedPath = `records/deliverable-artifacts/${id}/artifact.${input.extension}`;
  return store.saveDeliverable(
    workspaceId,
    {
      id,
      arrangementScoreId: arrangement.id,
      arrangementScoreVersion: arrangement.version!,
      notationLayout: input.notationLayout ?? arrangement.targetConfiguration.notationLayouts[0]!,
      kind: input.kind,
      mimeType: input.mimeType,
      ...(input.artifactPolicyVersion
        ? { artifactPolicyVersion: input.artifactPolicyVersion }
        : {}),
      sha256,
      byteLength: input.content.byteLength,
      storedPath,
      createdAt: new Date().toISOString(),
    },
    input.content
  );
}
