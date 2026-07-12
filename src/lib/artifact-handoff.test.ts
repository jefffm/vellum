// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { completeArtifactHandoff } from "./artifact-handoff.js";

describe("completed artifact handoff", () => {
  beforeEach(() => {
    document.body.replaceChildren();
  });

  it("requires a visible selected artifact and persists its exact reload identity", () => {
    const panel = document.createElement("section");
    const replaceState = vi.fn();
    document.body.append(panel);

    const completed = completeArtifactHandoff({
      panel,
      selected: {
        workspaceId: "workspace.1111111111111111",
        arrangementScoreId: "arrangement.2222222222222222",
        arrangementScoreVersion: 3,
      },
      render: () => {
        const artifact = document.createElement("div");
        artifact.className = "artifact-preview-content";
        artifact.textContent = "engraved score";
        panel.replaceChildren(artifact);
      },
      currentHref: "http://127.0.0.1:5173/",
      history: { replaceState },
    });

    expect(completed).toBe(true);
    expect(panel.textContent).toContain("engraved score");
    expect(panel.dataset).toMatchObject({
      workspaceId: "workspace.1111111111111111",
      arrangementId: "arrangement.2222222222222222",
      arrangementVersion: "3",
    });
    expect(String(replaceState.mock.calls[0]?.[2])).toContain(
      "workspace=workspace.1111111111111111"
    );
    expect(String(replaceState.mock.calls[0]?.[2])).toContain(
      "arrangement=arrangement.2222222222222222"
    );
  });

  it("fails visibly instead of returning to an empty panel", () => {
    const panel = document.createElement("section");
    expect(
      completeArtifactHandoff({
        panel,
        selected: {
          workspaceId: "workspace.1111111111111111",
          arrangementScoreId: "arrangement.2222222222222222",
          arrangementScoreVersion: 1,
        },
        render: () => undefined,
        currentHref: "http://127.0.0.1:5173/",
        history: { replaceState: vi.fn() },
      })
    ).toBe(false);
    expect(panel.textContent).toContain("did not produce a visible artifact");
  });
});
