// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest";

import {
  OwnerReferenceWorkbenchUploadError,
  renderOwnerReferenceWorkbench,
} from "./owner-reference-workbench.js";

describe("Owner Reference Library Workbench", () => {
  it("renders migrated and uploaded private references with explicit fail-closed access", () => {
    const container = document.createElement("div");
    renderOwnerReferenceWorkbench(container, fixture());

    expect(container.textContent).toContain("Owner-private · staging only");
    expect(container.textContent).toContain("Migrated private reference");
    expect(container.textContent).toContain("New private upload");
    expect(container.textContent).toContain("Migration quarantined");
    expect(container.textContent).toContain("Bibliographic identity unresolved");
    expect(container.textContent).toContain("Provider egress · deny");
    expect(container.textContent).toContain("Local study · review required");
    expect(container.textContent).toContain(
      "Ingestion and controlled-binding verification have already read these private bytes"
    );
    expect(container.textContent).not.toContain("PRIVATE-PATH-CANARY");
    expect(container.textContent).not.toContain("PRIVATE-BYTES-CANARY");
  });

  it("offers an Owner-confirmed redacted recovery for invalid browser retry state", async () => {
    const container = document.createElement("div");
    const upload = vi.fn(async () => {
      throw new OwnerReferenceWorkbenchUploadError("retry_state_invalid");
    });
    const recover = vi.fn(async () => undefined);
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    renderOwnerReferenceWorkbench(container, fixture(), upload, undefined, recover);
    const input = container.querySelector<HTMLInputElement>('input[type="file"]')!;
    Object.defineProperty(input, "files", {
      configurable: true,
      value: [new File(["%PDF-1.4\n"], "private.pdf", { type: "application/pdf" })],
    });

    container
      .querySelector<HTMLFormElement>(".owner-reference-library-upload")!
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

    await vi.waitFor(() => expect(container.textContent).toContain("retry state is invalid"));
    const recovery = container.querySelector<HTMLElement>(
      ".owner-reference-library-upload-recovery"
    )!;
    expect(recovery.hidden).toBe(false);
    expect(recovery.textContent).not.toContain("private.pdf");
    recovery.querySelector<HTMLButtonElement>("button")!.click();
    await vi.waitFor(() => expect(recover).toHaveBeenCalledOnce());
    await vi.waitFor(() =>
      expect(container.textContent).toContain("Browser-local retry identities were discarded")
    );
    expect(confirm).toHaveBeenCalledWith(expect.stringContaining("another acquisition"));
    confirm.mockRestore();
  });

  it("retains the retry identity for every unconfirmed upload failure", async () => {
    const container = document.createElement("div");
    const upload = vi.fn(async () => {
      throw new OwnerReferenceWorkbenchUploadError("outcome_uncertain");
    });
    renderOwnerReferenceWorkbench(container, fixture(), upload);
    const input = container.querySelector<HTMLInputElement>('input[type="file"]')!;
    Object.defineProperty(input, "files", {
      configurable: true,
      value: [new File(["%PDF-1.4\n"], "private.pdf", { type: "application/pdf" })],
    });

    container
      .querySelector<HTMLFormElement>(".owner-reference-library-upload")!
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

    await vi.waitFor(() => expect(container.textContent).toContain("same file selected and retry"));
    expect(
      container.querySelector<HTMLElement>(".owner-reference-library-upload-recovery")!.hidden
    ).toBe(true);
  });

  it("offers the same warned recovery when the unresolved-intent cap is reached", async () => {
    const container = document.createElement("div");
    const upload = vi.fn(async () => {
      throw new OwnerReferenceWorkbenchUploadError("pending_limit");
    });
    renderOwnerReferenceWorkbench(container, fixture(), upload, undefined, async () => undefined);
    const input = container.querySelector<HTMLInputElement>('input[type="file"]')!;
    Object.defineProperty(input, "files", {
      configurable: true,
      value: [new File(["%PDF-1.4\n"], "private.pdf", { type: "application/pdf" })],
    });

    container
      .querySelector<HTMLFormElement>(".owner-reference-library-upload")!
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

    await vi.waitFor(() =>
      expect(container.textContent).toContain("too many outcomes remain unresolved")
    );
    expect(
      container.querySelector<HTMLElement>(".owner-reference-library-upload-recovery")!.hidden
    ).toBe(false);
  });

  it("uploads without rendering or retaining the browser filename", async () => {
    const container = document.createElement("div");
    const upload = vi.fn(async () => undefined);
    renderOwnerReferenceWorkbench(container, fixture(), upload);
    const input = container.querySelector<HTMLInputElement>('input[type="file"]')!;
    const file = new File(["%PDF-1.4\nPRIVATE-BYTES-CANARY\n"], "PRIVATE-FILENAME-CANARY.pdf", {
      type: "application/pdf",
    });
    Object.defineProperty(input, "files", { configurable: true, value: [file] });

    container
      .querySelector<HTMLFormElement>("form")!
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await vi.waitFor(() => expect(upload).toHaveBeenCalledWith(file));
    await vi.waitFor(() =>
      expect(container.textContent).toContain(
        "Private reference added. Its identity remains unresolved"
      )
    );
    expect(container.textContent).not.toContain("PRIVATE-FILENAME-CANARY");
    expect(container.textContent).not.toContain("PRIVATE-BYTES-CANARY");
  });

  it("prepares an exact local review without reading bytes or implying authority", async () => {
    const container = document.createElement("div");
    const review = vi.fn(async () => ({
      schemaVersion: 1 as const,
      operation: "owner_private_study" as const,
      status: "review_required" as const,
      reasonCode: "owner_private_local_review_required" as const,
    }));
    const snapshot = fixture();
    renderOwnerReferenceWorkbench(container, snapshot, undefined, review);
    const form = container.querySelector<HTMLFormElement>(".owner-reference-library-local-review")!;

    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

    await vi.waitFor(() =>
      expect(review).toHaveBeenCalledWith({
        schemaVersion: 1,
        snapshotRef: snapshot.snapshotRef,
        cardRef: snapshot.references[0]!.cardRef,
        operation: "owner_private_study",
        purpose: "Review this exact private source for local study",
      })
    );
    await vi.waitFor(() =>
      expect(container.textContent).toContain("Review required · no private bytes were read")
    );
    expect(container.textContent).toContain("Next step: record an exact Owner Access Decision");
    expect(container.textContent).toContain(
      "Historical and specialist authority remain unasserted"
    );
  });

  it("requires an unchecked attestation and a second confirmation before local study", async () => {
    const container = document.createElement("div");
    const review = vi.fn(async () => ({
      schemaVersion: 1 as const,
      operation: "owner_private_study" as const,
      status: "review_required" as const,
      reasonCode: "owner_private_local_review_required" as const,
    }));
    const study = vi.fn(async () => ({
      blob: new Blob(["%PDF-1.4\n"], { type: "application/pdf" }),
      mediaType: "application/pdf" as const,
      workbenchRefresh: "current" as const,
    }));
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    confirm.mockClear();
    renderOwnerReferenceWorkbench(container, fixture(), undefined, review, undefined, study);
    const card = container.querySelector<HTMLElement>(".owner-reference-library-card")!;
    const authorization = card.querySelector<HTMLElement>(
      ".owner-reference-library-local-study-authorization"
    )!;
    expect(authorization.hidden).toBe(true);

    card
      .querySelector<HTMLFormElement>(".owner-reference-library-local-review")!
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await vi.waitFor(() => expect(authorization.hidden).toBe(false));
    expect(authorization.textContent).toContain("does not authorize extraction");
    expect(authorization.textContent).toContain("redistribution");
    const attestation = authorization.querySelector<HTMLInputElement>(
      'input[aria-label="Attest to local private study only"]'
    )!;
    const open = authorization.querySelector<HTMLButtonElement>("button")!;
    expect(attestation.checked).toBe(false);
    expect(open.disabled).toBe(true);
    attestation.checked = true;
    attestation.dispatchEvent(new Event("change", { bubbles: true }));
    expect(open.disabled).toBe(false);
    open.click();

    expect(confirm).toHaveBeenCalledOnce();
    expect(study).not.toHaveBeenCalled();
    expect(authorization.textContent).toContain("cancelled");
    expect(attestation.checked).toBe(false);
    confirm.mockRestore();
  });

  it("opens a filename-free blob preview and revokes each URL on replacement and close", async () => {
    const container = document.createElement("div");
    const snapshot = fixture();
    const review = vi.fn(async () => ({
      schemaVersion: 1 as const,
      operation: "owner_private_study" as const,
      status: "review_required" as const,
      reasonCode: "owner_private_local_review_required" as const,
    }));
    const study = vi.fn(async () => ({
      blob: new Blob(["%PDF-1.4\nPRIVATE-BYTES-CANARY"], { type: "application/pdf" }),
      mediaType: "application/pdf" as const,
      workbenchRefresh: "current" as const,
    }));
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    confirm.mockClear();
    const createObjectURL = vi
      .fn()
      .mockReturnValueOnce("blob:local-study-first")
      .mockReturnValueOnce("blob:local-study-second");
    const revokeObjectURL = vi.fn();
    const createDescriptor = Object.getOwnPropertyDescriptor(URL, "createObjectURL");
    const revokeDescriptor = Object.getOwnPropertyDescriptor(URL, "revokeObjectURL");
    Object.defineProperty(URL, "createObjectURL", { configurable: true, value: createObjectURL });
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: revokeObjectURL });
    try {
      renderOwnerReferenceWorkbench(container, snapshot, undefined, review, undefined, study);
      const cards = [...container.querySelectorAll<HTMLElement>(".owner-reference-library-card")];
      for (const [index, card] of cards.entries()) {
        card
          .querySelector<HTMLFormElement>(".owner-reference-library-local-review")!
          .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
        const authorization = card.querySelector<HTMLElement>(
          ".owner-reference-library-local-study-authorization"
        )!;
        await vi.waitFor(() => expect(authorization.hidden).toBe(false));
        const attestation = authorization.querySelector<HTMLInputElement>(
          'input[aria-label="Attest to local private study only"]'
        )!;
        attestation.checked = true;
        attestation.dispatchEvent(new Event("change", { bubbles: true }));
        authorization.querySelector<HTMLButtonElement>("button")!.click();
        await vi.waitFor(() => expect(createObjectURL).toHaveBeenCalledTimes(index + 1));
      }

      expect(revokeObjectURL).toHaveBeenCalledWith("blob:local-study-first");
      const dialog = document.querySelector<HTMLDialogElement>(
        ".owner-reference-local-study-preview"
      )!;
      expect(dialog.textContent).not.toContain("PRIVATE-BYTES-CANARY");
      expect(dialog.querySelector("a, [download]")).toBeNull();
      expect(dialog.querySelector<HTMLIFrameElement>("iframe")!.src).toContain(
        "blob:local-study-second"
      );
      dialog.querySelector<HTMLButtonElement>("button")!.click();
      expect(revokeObjectURL).toHaveBeenCalledWith("blob:local-study-second");
      expect(document.querySelector(".owner-reference-local-study-preview")).toBeNull();
      expect(study).toHaveBeenNthCalledWith(1, {
        snapshotRef: snapshot.snapshotRef,
        cardRef: snapshot.references[0]!.cardRef,
        purpose: "Review this exact private source for local study",
      });
    } finally {
      confirm.mockRestore();
      if (createDescriptor) Object.defineProperty(URL, "createObjectURL", createDescriptor);
      else Reflect.deleteProperty(URL, "createObjectURL");
      if (revokeDescriptor) Object.defineProperty(URL, "revokeObjectURL", revokeDescriptor);
      else Reflect.deleteProperty(URL, "revokeObjectURL");
      document.querySelector(".owner-reference-local-study-preview")?.remove();
    }
  });

  it("hands local extraction to the Page Atlas workflow without offering study bytes", async () => {
    const container = document.createElement("div");
    const review = vi.fn(async () => ({
      schemaVersion: 1 as const,
      operation: "local_extraction" as const,
      status: "review_required" as const,
      reasonCode: "owner_private_local_review_required" as const,
    }));
    const study = vi.fn();
    const extract = vi.fn();
    const snapshot = fixture();
    renderOwnerReferenceWorkbench(
      container,
      snapshot,
      undefined,
      review,
      undefined,
      study,
      extract
    );
    const form = container.querySelector<HTMLFormElement>(".owner-reference-library-local-review")!;
    form.querySelector<HTMLSelectElement>('select[aria-label="Local operation"]')!.value =
      "local_extraction";
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

    await vi.waitFor(() =>
      expect(form.textContent).toContain("local Page Atlas Workbench is open")
    );
    expect(extract).toHaveBeenCalledWith({
      snapshotRef: snapshot.snapshotRef,
      cardRef: snapshot.references[0]!.cardRef,
      purpose: "Review this exact private source for local study",
    });
    expect(
      form.querySelector<HTMLElement>(".owner-reference-library-local-study-authorization")!.hidden
    ).toBe(true);
    expect(study).not.toHaveBeenCalled();
  });

  it("submits local extraction exactly and renders a stale-snapshot denial", async () => {
    const container = document.createElement("div");
    const review = vi.fn(async () => ({
      schemaVersion: 1 as const,
      operation: "local_extraction" as const,
      status: "deny" as const,
      reasonCode: "workbench_snapshot_stale" as const,
    }));
    const snapshot = fixture();
    renderOwnerReferenceWorkbench(container, snapshot, undefined, review);
    const form = container.querySelector<HTMLFormElement>(".owner-reference-library-local-review")!;
    const operation = form.querySelector<HTMLSelectElement>(
      'select[aria-label="Local operation"]'
    )!;
    const purpose = form.querySelector<HTMLInputElement>(
      'input[aria-label="Purpose for this review"]'
    )!;
    operation.value = "local_extraction";
    purpose.value = "Extract local evidence from this exact acquisition";

    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

    await vi.waitFor(() =>
      expect(review).toHaveBeenCalledWith({
        schemaVersion: 1,
        snapshotRef: snapshot.snapshotRef,
        cardRef: snapshot.references[0]!.cardRef,
        operation: "local_extraction",
        purpose: "Extract local evidence from this exact acquisition",
      })
    );
    await vi.waitFor(() =>
      expect(container.textContent).toContain("changed while it was being reviewed")
    );
  });

  it("rejects duplicate operations, unknown fields, and migration-state substitution", () => {
    const container = document.createElement("div");
    const duplicate = fixture();
    duplicate.references[0]!.access[8] = duplicate.references[0]!.access[0]!;
    expect(() => renderOwnerReferenceWorkbench(container, duplicate)).toThrow(/access defaults/);

    const unknown = fixture() as ReturnType<typeof fixture> & { privatePath?: string };
    unknown.privatePath = "/Users/owner/PRIVATE-PATH-CANARY";
    expect(() => renderOwnerReferenceWorkbench(container, unknown)).toThrow();

    const substituted = fixture();
    substituted.references[0]!.origin = "upload";
    expect(() => renderOwnerReferenceWorkbench(container, substituted)).toThrow(/migration state/);
  });
});

function fixture() {
  return {
    schemaVersion: 1 as const,
    snapshotRef: { id: "owner-reference-snapshot.first", digest: "1".repeat(64) },
    references: [card("migrated", "a"), card("upload", "b")],
  };
}

function card(origin: "migrated" | "upload", suffix: string) {
  return {
    id: `owner-reference-card.${suffix}`,
    cardRef: { id: `owner-reference-card-ref.${suffix}`, digest: suffix.repeat(64) },
    acquisitionRef: { id: `owner-reference-acquisition.${suffix}`, digest: suffix.repeat(64) },
    assetRef: { id: `owner-reference-asset.${suffix}`, digest: suffix.repeat(64) },
    origin,
    migration:
      origin === "migrated"
        ? {
            state: "quarantined" as const,
            legacySourceState: "verified" as const,
            quarantineReason: "incomplete_identity" as const,
            explanation: "The byte mapping is stable while source identity remains under review.",
          }
        : null,
    mediaType: "application/pdf",
    byteLength: 4096,
    identity: {
      state: "unresolved" as const,
      explanation: "No Work or edition identity has been asserted.",
    },
    rights: {
      state: "unasserted" as const,
      assertionCount: 0,
      explanation: "No rights have been inferred from possession of the bytes.",
    },
    roleBindings: {
      state: "unbound" as const,
      ownerReferenceCount: 0,
      arrangementSourceCount: 0,
      evaluationSourceCount: 0,
      explanation: "No role is active.",
    },
    access: [
      access("local_study", "review_required"),
      access("local_extraction", "review_required"),
      access("provider_egress", "deny"),
      access("fixture_inclusion", "deny"),
      access("repository_inclusion", "deny"),
      access("export", "deny"),
      access("redistribution", "deny"),
      access("report", "deny"),
      access("log", "deny"),
    ],
    policyRef: { id: "policy.owner-reference-private-defaults.v1", digest: "f".repeat(64) },
  };
}

function access(
  operation:
    | "local_study"
    | "local_extraction"
    | "provider_egress"
    | "fixture_inclusion"
    | "repository_inclusion"
    | "export"
    | "redistribution"
    | "report"
    | "log",
  status: "deny" | "review_required"
) {
  return { operation, status, explanation: `${operation} is ${status}` };
}
