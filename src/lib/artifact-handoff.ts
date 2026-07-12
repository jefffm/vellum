export type CompletedArtifactIdentity = {
  workspaceId: string;
  arrangementScoreId: string;
  arrangementScoreVersion: number;
};

export function completeArtifactHandoff(options: {
  panel: HTMLElement;
  selected?: CompletedArtifactIdentity;
  render: () => void;
  currentHref?: string;
  history?: Pick<History, "replaceState">;
}): boolean {
  const { panel, selected } = options;
  if (!selected) return fail(panel, "The arrangement completed without a selected artifact.");

  options.render();
  if (!panel.querySelector(".artifact-preview-content")) {
    return fail(panel, "The selected arrangement did not produce a visible artifact.");
  }

  panel.dataset.workspaceId = selected.workspaceId;
  panel.dataset.arrangementId = selected.arrangementScoreId;
  panel.dataset.arrangementVersion = String(selected.arrangementScoreVersion);
  const href = options.currentHref ?? window.location.href;
  const url = new URL(href);
  url.searchParams.set("workspace", selected.workspaceId);
  url.searchParams.set("arrangement", selected.arrangementScoreId);
  (options.history ?? window.history).replaceState(
    { workspaceId: selected.workspaceId, arrangementId: selected.arrangementScoreId },
    "",
    url
  );
  return true;
}

function fail(panel: HTMLElement, message: string): false {
  const failure = document.createElement("p");
  failure.className = "guided-start-error";
  failure.textContent = message;
  panel.replaceChildren(failure);
  return false;
}
