import type { HistoricalTabRecognitionRun } from "./lib/historical-tab-recognition-domain.js";

type EventDraft = {
  id: string;
  sourceEventIds: string[];
  region: { x: number; y: number; width: number; height: number };
  courses: Array<string | null>;
  rhythmGlyph: "unread" | "absent" | "stem" | "flag-1" | "flag-2" | "flag-3";
  dots: number;
  ornaments: string;
  marks: string;
  verticalMark:
    | "unread"
    | "none"
    | "barline"
    | "double-barline"
    | "repeat-start"
    | "repeat-end"
    | "arrow-up"
    | "arrow-down"
    | "gesture"
    | "other";
  state: "unreviewed" | "confirmed" | "ambiguous";
  review: {
    touched: boolean;
    corrected: boolean;
    regrouped: boolean;
    propagated: boolean;
    rejected: boolean;
  };
  propagatedCourses: number[];
};

type WorkingDraft = {
  schemaVersion: 2;
  runId: string;
  cursor: number;
  events: EventDraft[];
  keyboardActions: number;
  updatedAt: string;
};

const api = async <T>(url: string): Promise<T> => {
  const response = await fetch(url);
  const body = (await response.json()) as { ok?: boolean; data?: T; error?: { message?: string } };
  if (!response.ok || !body.ok || !body.data)
    throw new Error(body.error?.message ?? `Request failed: ${response.status}`);
  return body.data;
};

const postApi = async <T>(url: string, body: unknown): Promise<T> => {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = (await response.json()) as {
    ok?: boolean;
    data?: T;
    error?: { message?: string };
  };
  if (!response.ok || !payload.ok || !payload.data)
    throw new Error(payload.error?.message ?? `Request failed: ${response.status}`);
  return payload.data;
};

const storageKey = (runId: string) => `vellum.historical-tab-draft.${runId}`;

function initialDraft(run: HistoricalTabRecognitionRun): WorkingDraft {
  const clusterLabels = new Map(
    run.clusters
      .filter((cluster) => cluster.kind === "fret-letter")
      .map((cluster) => [cluster.id, cluster.label] as const)
  );
  const glyphs = new Map(run.glyphs.map((glyph) => [glyph.id, glyph] as const));
  return {
    schemaVersion: 2,
    runId: run.id,
    cursor: 0,
    keyboardActions: 0,
    updatedAt: new Date().toISOString(),
    events: run.systems.flatMap((system) =>
      system.events.map((event) => {
        const courses: Array<string | null> = Array.from(
          { length: run.profile.courseCount },
          () => null
        );
        const confidence = Array.from({ length: run.profile.courseCount }, () => -1);
        for (const glyphId of event.glyphIds) {
          const glyph = glyphs.get(glyphId);
          const label = glyph ? clusterLabels.get(glyph.clusterId) : null;
          if (
            !glyph?.courseCandidate ||
            !label ||
            glyph.area <= confidence[glyph.courseCandidate - 1]!
          )
            continue;
          courses[glyph.courseCandidate - 1] = label;
          confidence[glyph.courseCandidate - 1] = glyph.area;
        }
        return {
          id: event.id,
          sourceEventIds: [event.id],
          region: event.region,
          courses,
          rhythmGlyph: "unread" as const,
          dots: 0,
          ornaments: "",
          marks: "",
          verticalMark: event.verticalCandidateIds.length ? ("unread" as const) : ("none" as const),
          state: "unreviewed" as const,
          review: {
            touched: false,
            corrected: false,
            regrouped: false,
            propagated: false,
            rejected: false,
          },
          propagatedCourses: [],
        };
      })
    ),
  };
}

function restoredDraft(run: HistoricalTabRecognitionRun): WorkingDraft {
  const value = localStorage.getItem(storageKey(run.id));
  if (!value) return initialDraft(run);
  try {
    const parsed = JSON.parse(value) as Omit<WorkingDraft, "schemaVersion" | "keyboardActions"> & {
      schemaVersion: 1 | 2;
      keyboardActions?: number;
    };
    if (
      (parsed.schemaVersion === 1 || parsed.schemaVersion === 2) &&
      parsed.runId === run.id &&
      parsed.events.length
    ) {
      const events = parsed.events.map((event) => {
        const { page: _legacyPage, ...region } = event.region as EventDraft["region"] & {
          page?: number;
        };
        const sourceHasVerticalEvidence = event.sourceEventIds.some(
          (id) =>
            run.systems.flatMap((system) => system.events).find((source) => source.id === id)
              ?.verticalCandidateIds.length
        );
        return {
          ...event,
          region,
          verticalMark: event.verticalMark ?? (sourceHasVerticalEvidence ? "unread" : "none"),
          review: event.review ?? {
            touched: event.state !== "unreviewed",
            corrected: false,
            regrouped: event.sourceEventIds.length !== 1,
            propagated: false,
            rejected: false,
          },
          propagatedCourses: event.propagatedCourses ?? [],
        };
      });
      return {
        ...parsed,
        schemaVersion: 2,
        events,
        keyboardActions: parsed.keyboardActions ?? 0,
        cursor: Math.min(parsed.cursor, parsed.events.length - 1),
      };
    }
  } catch {
    // A corrupt local draft is replaceable; the source-derived run remains immutable.
  }
  return initialDraft(run);
}

export async function restoreHistoricalTabWorkspace(panel: HTMLElement): Promise<boolean> {
  const query = new URL(window.location.href).searchParams;
  const workspaceId = query.get("workspace");
  const runId = query.get("tabRecognition");
  if (
    !workspaceId?.match(/^workspace\.[a-f0-9-]{16,}$/) ||
    !runId?.match(/^tab-recognition\.[a-f0-9-]{16,}$/)
  )
    return false;
  const run = await api<HistoricalTabRecognitionRun>(
    `/api/workspaces/${workspaceId}/historical-tab-recognition-runs/${runId}`
  );
  installHistoricalTabWorkspace(panel, workspaceId, run);
  return true;
}

export function installHistoricalTabWorkspace(
  panel: HTMLElement,
  workspaceId: string,
  run: HistoricalTabRecognitionRun
): void {
  let draft = restoredDraft(run);
  let selectedCourse = 0;
  const undo: WorkingDraft[] = [];
  const redo: WorkingDraft[] = [];
  const shell = document.createElement("section");
  shell.className = "historical-tab-workspace";
  shell.tabIndex = 0;
  shell.innerHTML = `<header><div><p>Diplomatic transcription</p><h1>Keyboard review</h1></div><div><div data-progress></div><div data-burden></div><button data-publish disabled>Publish reviewed MEI</button></div></header><div class="historical-tab-context"><canvas data-crop></canvas><p data-location></p></div><div class="historical-tab-editor"><div class="historical-tab-course-grid" data-courses></div><fieldset data-rhythm><legend>Visible rhythm sign</legend></fieldset><fieldset data-vertical><legend>Vertical mark after/within event</legend></fieldset><label>Ornaments<input data-ornaments autocomplete="off" placeholder="literal visible mark"/></label><label>Other visible marks<input data-marks autocomplete="off" placeholder="literal visible mark"/></label><button data-propagate hidden></button></div><div class="historical-tab-actions"><button data-previous>Previous</button><button data-unresolved>Next unresolved <kbd>U</kbd></button><button data-ambiguous>Mark ambiguous</button><button data-confirm>Confirm &amp; next <kbd>Enter</kbd></button><button data-next>Next</button></div><details><summary>Structure and history</summary><div class="historical-tab-secondary-actions"><button data-copy-rhythm>Repeat previous rhythm <kbd>R</kbd></button><button data-copy-all>Repeat previous entry <kbd>=</kbd></button><button data-split>Split event <kbd>S</kbd></button><button data-merge>Merge with next <kbd>M</kbd></button><button data-undo>Undo <kbd>⌘Z</kbd></button><button data-redo>Redo <kbd>⇧⌘Z</kbd></button></div><pre data-diagnostics></pre></details><p data-error role="alert"></p><p class="historical-tab-shortcuts">Keys: 1–5 course · a–i/k–n fret · Alt+0–4 rhythm · Alt+B/N/G vertical mark · Alt+↑/↓ visible arrow · Alt+R cycles vertical marks · Alt+O/K edits literal marks · R repeats rhythm · = repeats entry · P propagates selected reviewed shape · U next unresolved · S/M split/merge · ⌘Z/⇧⌘Z undo/redo · . dots · Delete clears · Enter confirms · [ / ] navigate · ? ambiguous</p>`;
  panel.replaceChildren(shell);

  const canvas = shell.querySelector<HTMLCanvasElement>("[data-crop]")!;
  const context = canvas.getContext("2d")!;
  const image = new Image();
  image.src = `/api/workspaces/${workspaceId}/historical-tab-recognition-runs/${run.id}/facsimile`;
  image.addEventListener("load", render);
  const rhythmChoices: EventDraft["rhythmGlyph"][] = [
    "unread",
    "absent",
    "stem",
    "flag-1",
    "flag-2",
    "flag-3",
  ];
  shell
    .querySelector("[data-rhythm]")!
    .insertAdjacentHTML(
      "beforeend",
      rhythmChoices
        .map(
          (choice) =>
            `<label><input type="radio" name="rhythm" value="${choice}"/>${choice.replace("-", " ")}</label>`
        )
        .join("") +
        `<label>Dots<select data-dots><option>0</option><option>1</option><option>2</option></select></label>`
    );
  const verticalChoices: EventDraft["verticalMark"][] = [
    "unread",
    "none",
    "barline",
    "double-barline",
    "repeat-start",
    "repeat-end",
    "arrow-up",
    "arrow-down",
    "gesture",
    "other",
  ];
  shell
    .querySelector("[data-vertical]")!
    .insertAdjacentHTML(
      "beforeend",
      verticalChoices
        .map(
          (choice) =>
            `<label><input type="radio" name="vertical" value="${choice}"/>${choice.replaceAll("-", " ")}</label>`
        )
        .join("")
    );

  const snapshot = (): WorkingDraft => structuredClone(draft);
  const mutate = (change: () => void) => {
    undo.push(snapshot());
    if (undo.length > 100) undo.shift();
    redo.length = 0;
    change();
    persist();
    render();
  };
  const persist = () => {
    draft.updatedAt = new Date().toISOString();
    localStorage.setItem(storageKey(run.id), JSON.stringify(draft));
  };
  const move = (offset: number) => {
    draft.cursor = Math.max(0, Math.min(draft.events.length - 1, draft.cursor + offset));
    selectedCourse = 0;
    persist();
    render();
  };
  const current = () => draft.events[draft.cursor]!;
  const sourceEvents = new Map(
    run.systems.flatMap((system) => system.events.map((event) => [event.id, event] as const))
  );
  const glyphs = new Map(run.glyphs.map((glyph) => [glyph.id, glyph] as const));
  const clusterById = new Map(run.clusters.map((cluster) => [cluster.id, cluster] as const));
  const systemBySourceEvent = new Map(
    run.systems.flatMap((system) => system.events.map((event) => [event.id, system.id] as const))
  );
  const reusableClusterIds = new Set(
    run.clusters.filter((cluster) => cluster.kind === "fret-letter").map((cluster) => cluster.id)
  );
  const matchingClusterEventIndexes = (courseIndex: number): number[] => {
    const activeGlyphs = current()
      .sourceEventIds.flatMap((id) => sourceEvents.get(id)?.glyphIds ?? [])
      .map((id) => glyphs.get(id))
      .filter((glyph) => glyph?.courseCandidate === courseIndex + 1)
      .sort((left, right) => (right?.area ?? 0) - (left?.area ?? 0));
    const reusableActiveGlyphs = activeGlyphs.filter((glyph) =>
      reusableClusterIds.has(glyph!.clusterId)
    );
    // A course can contain both a fret letter and another course-aligned mark.
    // Without a glyph-level Owner selection, guessing which identity was typed
    // would make a broad propagation actively dangerous. Keep the shortcut only
    // for the unambiguous one-component case.
    const clusterId =
      reusableActiveGlyphs.length === 1 ? reusableActiveGlyphs[0]!.clusterId : undefined;
    if (!clusterId) return [];
    return draft.events.flatMap((event, index) => {
      if (index === draft.cursor || event.courses[courseIndex]) return [];
      const matches = event.sourceEventIds.some((sourceId) =>
        (sourceEvents.get(sourceId)?.glyphIds ?? []).some((glyphId) => {
          const glyph = glyphs.get(glyphId);
          return glyph?.clusterId === clusterId && glyph.courseCandidate === courseIndex + 1;
        })
      );
      return matches ? [index] : [];
    });
  };
  const confirm = () => {
    mutate(() => {
      current().state = "confirmed";
      current().review.touched = true;
      if (draft.cursor < draft.events.length - 1) draft.cursor += 1;
    });
  };
  const markAmbiguous = () => {
    mutate(() => {
      current().state = "ambiguous";
      current().review.touched = true;
      if (draft.cursor < draft.events.length - 1) draft.cursor += 1;
    });
  };

  function render(): void {
    const event = current();
    const counts = draft.events.reduce(
      (result, item) => ({ ...result, [item.state]: result[item.state] + 1 }),
      { unreviewed: 0, confirmed: 0, ambiguous: 0 }
    );
    shell.querySelector("[data-progress]")!.textContent =
      `${counts.confirmed} confirmed · ${counts.ambiguous} ambiguous · ${counts.unreviewed} remaining`;
    const reviewCounts = draft.events.reduce(
      (result, item) => ({
        corrected: result.corrected + Number(item.review.corrected),
        regrouped: result.regrouped + Number(item.review.regrouped),
        propagated: result.propagated + Number(item.review.propagated),
        rejected: result.rejected + Number(item.review.rejected),
      }),
      { corrected: 0, regrouped: 0, propagated: 0, rejected: 0 }
    );
    shell.querySelector("[data-burden]")!.textContent =
      `${reviewCounts.corrected} corrected · ${reviewCounts.regrouped} regrouped · ${reviewCounts.propagated} propagated · ${reviewCounts.rejected} rejected`;
    const publish = shell.querySelector<HTMLButtonElement>("[data-publish]")!;
    publish.disabled =
      counts.unreviewed > 0 ||
      draft.events.some((item) => item.rhythmGlyph === "unread" || item.verticalMark === "unread");
    const sourceVerticalCount = event.sourceEventIds.reduce(
      (count, id) => count + (sourceEvents.get(id)?.verticalCandidateIds.length ?? 0),
      0
    );
    const proposedFretCount = new Set(
      event.sourceEventIds
        .flatMap((id) => sourceEvents.get(id)?.glyphIds ?? [])
        .map((id) => glyphs.get(id)?.clusterId)
        .filter((clusterId) => clusterId && clusterById.get(clusterId)?.label)
    ).size;
    shell.querySelector("[data-location]")!.textContent =
      `Event ${draft.cursor + 1} of ${draft.events.length} · ${event.id} · ${event.state} · ${proposedFretCount} profile proposal${proposedFretCount === 1 ? "" : "s"} (confirmation required) · ${sourceVerticalCount} vertical candidate${sourceVerticalCount === 1 ? "" : "s"}`;
    shell.querySelector("[data-diagnostics]")!.textContent = run.diagnostics.join("\n");
    const courses = shell.querySelector("[data-courses]")!;
    courses.innerHTML = event.courses
      .map(
        (value, index) =>
          `<label class="${index === selectedCourse ? "selected" : ""}"><span>Course ${index + 1}</span><input data-course="${index}" maxlength="1" pattern="[a-ik-n]" value="${value ?? ""}" aria-label="Course ${index + 1} fret letter"/></label>`
      )
      .join("");
    shell.querySelectorAll<HTMLInputElement>("[data-course]").forEach((input) => {
      input.addEventListener("focus", () => {
        selectedCourse = Number(input.dataset.course);
        courses
          .querySelectorAll("label")
          .forEach((label, index) => label.classList.toggle("selected", index === selectedCourse));
      });
      input.addEventListener("input", () => {
        mutate(() => {
          event.courses[Number(input.dataset.course)] = input.value.trim() || null;
          event.state = "unreviewed";
          event.review.corrected = true;
          const course = Number(input.dataset.course);
          if (event.propagatedCourses.includes(course)) {
            event.review.rejected = true;
            event.propagatedCourses = event.propagatedCourses.filter((value) => value !== course);
          }
        });
      });
    });
    shell.querySelectorAll<HTMLInputElement>('input[name="rhythm"]').forEach((input) => {
      input.checked = input.value === event.rhythmGlyph;
    });
    shell.querySelectorAll<HTMLInputElement>('input[name="vertical"]').forEach((input) => {
      input.checked = input.value === event.verticalMark;
    });
    shell.querySelector<HTMLSelectElement>("[data-dots]")!.value = String(event.dots);
    shell.querySelector<HTMLInputElement>("[data-ornaments]")!.value = event.ornaments;
    shell.querySelector<HTMLInputElement>("[data-marks]")!.value = event.marks;
    shell.querySelector<HTMLButtonElement>("[data-previous]")!.disabled = draft.cursor === 0;
    shell.querySelector<HTMLButtonElement>("[data-next]")!.disabled =
      draft.cursor === draft.events.length - 1;
    const nextEvent = draft.events[draft.cursor + 1];
    shell.querySelector<HTMLButtonElement>("[data-merge]")!.disabled =
      !nextEvent ||
      systemBySourceEvent.get(event.sourceEventIds[0]!) !==
        systemBySourceEvent.get(nextEvent.sourceEventIds[0]!);
    shell.querySelector<HTMLButtonElement>("[data-copy-rhythm]")!.disabled = draft.cursor === 0;
    shell.querySelector<HTMLButtonElement>("[data-copy-all]")!.disabled = draft.cursor === 0;
    shell.querySelector<HTMLButtonElement>("[data-undo]")!.disabled = undo.length === 0;
    shell.querySelector<HTMLButtonElement>("[data-redo]")!.disabled = redo.length === 0;
    const propagation = shell.querySelector<HTMLButtonElement>("[data-propagate]")!;
    const propagationTargets = matchingClusterEventIndexes(selectedCourse);
    const selectedLetter = event.courses[selectedCourse];
    propagation.hidden = !selectedLetter || propagationTargets.length === 0;
    propagation.textContent = selectedLetter
      ? `Propose ${selectedLetter} on course ${selectedCourse + 1} for ${propagationTargets.length} matching glyph${propagationTargets.length === 1 ? "" : "s"}`
      : "";
    propagation.dataset.targets = propagationTargets.join(",");
    if (image.complete && image.naturalWidth) {
      const center = event.region.x + event.region.width / 2;
      const contextWidth = Math.max(0.2, event.region.width * 3.2);
      const x = Math.max(0, Math.min(1 - contextWidth, center - contextWidth / 2));
      const right = Math.min(1, x + contextWidth);
      const y = Math.max(0, event.region.y);
      const height = Math.min(1 - y, event.region.height);
      canvas.width = 1200;
      canvas.height = Math.max(
        320,
        Math.min(
          540,
          Math.round(
            canvas.width * ((height * image.naturalHeight) / ((right - x) * image.naturalWidth))
          )
        )
      );
      context.fillStyle = "white";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(
        image,
        x * image.naturalWidth,
        y * image.naturalHeight,
        (right - x) * image.naturalWidth,
        height * image.naturalHeight,
        0,
        0,
        canvas.width,
        canvas.height
      );
      const sourceAnchors = event.sourceEventIds
        .map((id) => sourceEvents.get(id)?.anchorX)
        .filter((anchor): anchor is number => anchor !== undefined);
      const anchor = sourceAnchors.length
        ? sourceAnchors.reduce((sum, value) => sum + value, 0) / sourceAnchors.length
        : center;
      const markerX = ((anchor - x) / (right - x)) * canvas.width;
      const eventLeft = ((event.region.x - x) / (right - x)) * canvas.width;
      const eventRight = ((event.region.x + event.region.width - x) / (right - x)) * canvas.width;
      context.strokeStyle = "rgba(164, 78, 45, .72)";
      context.lineWidth = 2;
      context.beginPath();
      context.moveTo(eventLeft, 10);
      context.lineTo(eventRight, 10);
      context.moveTo(eventLeft, 4);
      context.lineTo(eventLeft, 20);
      context.moveTo(eventRight, 4);
      context.lineTo(eventRight, 20);
      context.stroke();
      context.fillStyle = "rgba(164, 78, 45, .82)";
      context.beginPath();
      context.moveTo(markerX - 6, 1);
      context.lineTo(markerX + 6, 1);
      context.lineTo(markerX, 9);
      context.closePath();
      context.fill();
    }
    window.setTimeout(() => shell.focus(), 0);
  }

  shell.querySelector("[data-confirm]")!.addEventListener("click", confirm);
  shell.querySelector("[data-ambiguous]")!.addEventListener("click", markAmbiguous);
  shell.querySelector("[data-previous]")!.addEventListener("click", () => move(-1));
  shell.querySelector("[data-next]")!.addEventListener("click", () => move(1));
  const moveToNextUnresolved = () => {
    const offsets = Array.from({ length: draft.events.length }, (_value, offset) => offset + 1);
    const target = offsets
      .map((offset) => (draft.cursor + offset) % draft.events.length)
      .find((index) => {
        const event = draft.events[index]!;
        return (
          event.state === "unreviewed" ||
          event.rhythmGlyph === "unread" ||
          event.verticalMark === "unread"
        );
      });
    if (target === undefined) return;
    draft.cursor = target;
    selectedCourse = 0;
    persist();
    render();
  };
  shell.querySelector("[data-unresolved]")!.addEventListener("click", moveToNextUnresolved);
  shell.querySelector("[data-rhythm]")!.addEventListener("change", (browserEvent) => {
    const input = browserEvent.target as HTMLInputElement | HTMLSelectElement;
    mutate(() => {
      if (input.matches('input[name="rhythm"]'))
        current().rhythmGlyph = input.value as EventDraft["rhythmGlyph"];
      if (input.matches("[data-dots]")) current().dots = Number(input.value);
      current().state = "unreviewed";
      current().review.corrected = true;
    });
  });
  shell.querySelector("[data-vertical]")!.addEventListener("change", (browserEvent) => {
    const input = browserEvent.target as HTMLInputElement;
    mutate(() => {
      current().verticalMark = input.value as EventDraft["verticalMark"];
      current().state = "unreviewed";
      current().review.corrected = true;
    });
  });
  for (const [selector, field] of [
    ["[data-ornaments]", "ornaments"],
    ["[data-marks]", "marks"],
  ] as const) {
    shell.querySelector<HTMLInputElement>(selector)!.addEventListener("change", (browserEvent) => {
      mutate(() => {
        current()[field] = (browserEvent.target as HTMLInputElement).value;
        current().state = "unreviewed";
        current().review.corrected = true;
      });
    });
    shell.querySelector<HTMLInputElement>(selector)!.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === "Escape") {
        event.preventDefault();
        (event.currentTarget as HTMLInputElement).blur();
        shell.focus();
      }
    });
  }
  const copyPreviousRhythm = () => {
    if (draft.cursor === 0) return;
    mutate(() => {
      const prior = draft.events[draft.cursor - 1]!;
      current().rhythmGlyph = prior.rhythmGlyph;
      current().dots = prior.dots;
      current().state = "unreviewed";
      current().review.corrected = true;
    });
  };
  const copyPreviousEntry = () => {
    if (draft.cursor === 0) return;
    mutate(() => {
      const prior = draft.events[draft.cursor - 1]!;
      current().courses = [...prior.courses];
      current().rhythmGlyph = prior.rhythmGlyph;
      current().dots = prior.dots;
      current().ornaments = prior.ornaments;
      current().marks = prior.marks;
      current().verticalMark = prior.verticalMark;
      current().state = "unreviewed";
      current().review.corrected = true;
    });
  };
  shell.querySelector("[data-copy-rhythm]")!.addEventListener("click", copyPreviousRhythm);
  shell.querySelector("[data-copy-all]")!.addEventListener("click", copyPreviousEntry);
  shell.querySelector("[data-split]")!.addEventListener("click", () => {
    mutate(() => {
      const event = current();
      const half = event.region.width / 2;
      const left = {
        ...structuredClone(event),
        id: `${event.id}.a`,
        region: { ...event.region, width: half },
        review: { ...event.review, regrouped: true },
      };
      const right = {
        ...structuredClone(event),
        id: `${event.id}.b`,
        region: { ...event.region, x: event.region.x + half, width: half },
        review: { ...event.review, regrouped: true },
      };
      draft.events.splice(draft.cursor, 1, left, right);
    });
  });
  shell.querySelector("[data-merge]")!.addEventListener("click", () => {
    mutate(() => {
      const first = current();
      const second = draft.events[draft.cursor + 1]!;
      draft.events.splice(draft.cursor, 2, {
        ...first,
        id: `${first.id}+${second.id}`,
        sourceEventIds: [...first.sourceEventIds, ...second.sourceEventIds],
        region: {
          ...first.region,
          width: second.region.x + second.region.width - first.region.x,
        },
        state: "unreviewed",
        review: {
          touched: first.review.touched || second.review.touched,
          corrected: first.review.corrected || second.review.corrected,
          regrouped: true,
          propagated: first.review.propagated || second.review.propagated,
          rejected: first.review.rejected || second.review.rejected,
        },
        propagatedCourses: [...new Set([...first.propagatedCourses, ...second.propagatedCourses])],
      });
    });
  });
  shell.querySelector("[data-undo]")!.addEventListener("click", () => {
    const prior = undo.pop();
    if (!prior) return;
    redo.push(snapshot());
    draft = prior;
    persist();
    render();
  });
  shell.querySelector("[data-redo]")!.addEventListener("click", () => {
    const next = redo.pop();
    if (!next) return;
    undo.push(snapshot());
    draft = next;
    persist();
    render();
  });
  shell.querySelector("[data-propagate]")!.addEventListener("click", () => {
    const letter = current().courses[selectedCourse];
    const targets = matchingClusterEventIndexes(selectedCourse);
    if (!letter || !targets.length) return;
    mutate(() => {
      for (const index of targets) {
        draft.events[index]!.courses[selectedCourse] = letter;
        draft.events[index]!.state = "unreviewed";
        draft.events[index]!.review.propagated = true;
        draft.events[index]!.propagatedCourses = [
          ...new Set([...draft.events[index]!.propagatedCourses, selectedCourse]),
        ];
      }
    });
  });
  shell.querySelector("[data-publish]")!.addEventListener("click", async () => {
    const button = shell.querySelector<HTMLButtonElement>("[data-publish]")!;
    const error = shell.querySelector<HTMLElement>("[data-error]")!;
    button.disabled = true;
    error.textContent = "";
    try {
      const reviewMetrics = draft.events.reduce(
        (result, event) => ({
          untouched: result.untouched + Number(!event.review.touched),
          reviewed: result.reviewed + Number(event.state !== "unreviewed"),
          corrected: result.corrected + Number(event.review.corrected),
          regrouped: result.regrouped + Number(event.review.regrouped),
          propagated: result.propagated + Number(event.review.propagated),
          rejected: result.rejected + Number(event.review.rejected),
          unresolved:
            result.unresolved +
            Number(
              event.state === "ambiguous" ||
                event.rhythmGlyph === "unread" ||
                event.verticalMark === "unread"
            ),
          keyboardActions: draft.keyboardActions,
        }),
        {
          untouched: 0,
          reviewed: 0,
          corrected: 0,
          regrouped: 0,
          propagated: 0,
          rejected: 0,
          unresolved: 0,
          keyboardActions: draft.keyboardActions,
        }
      );
      const published = await postApi<{
        edition: { editionId: string };
        recognitionProfile: { id: string };
      }>(`/api/workspaces/${workspaceId}/historical-tab-recognition-runs/${run.id}/publish`, {
        title: `Source page ${run.sourcePage} diplomatic transcription`,
        batchName: `Page ${run.sourcePage} initial expert review`,
        events: draft.events.map(
          ({ review: _review, propagatedCourses: _propagatedCourses, ...event }) => event
        ),
        reviewMetrics,
      });
      const url = new URL(window.location.href);
      url.searchParams.delete("tabRecognition");
      url.searchParams.set("meiEdition", published.edition.editionId);
      window.location.assign(url);
    } catch (problem) {
      error.textContent = problem instanceof Error ? problem.message : String(problem);
      render();
    }
  });
  shell.addEventListener("keydown", (keyboardEvent) => {
    if ((keyboardEvent.target as HTMLElement).matches("input, select")) return;
    const rhythmShortcut: Record<string, EventDraft["rhythmGlyph"]> = {
      "0": "absent",
      "1": "stem",
      "2": "flag-1",
      "3": "flag-2",
      "4": "flag-3",
    };
    if (keyboardEvent.altKey && rhythmShortcut[keyboardEvent.key]) {
      keyboardEvent.preventDefault();
      mutate(() => {
        draft.keyboardActions += 1;
        current().rhythmGlyph = rhythmShortcut[keyboardEvent.key]!;
        current().state = "unreviewed";
        current().review.corrected = true;
      });
    } else if (keyboardEvent.altKey && keyboardEvent.key.toLowerCase() === "b") {
      keyboardEvent.preventDefault();
      mutate(() => {
        draft.keyboardActions += 1;
        current().verticalMark = "barline";
        current().state = "unreviewed";
        current().review.corrected = true;
      });
    } else if (keyboardEvent.altKey && keyboardEvent.key.toLowerCase() === "n") {
      keyboardEvent.preventDefault();
      mutate(() => {
        draft.keyboardActions += 1;
        current().verticalMark = "none";
        current().state = "unreviewed";
        current().review.corrected = true;
      });
    } else if (keyboardEvent.altKey && keyboardEvent.key.toLowerCase() === "g") {
      keyboardEvent.preventDefault();
      mutate(() => {
        draft.keyboardActions += 1;
        current().verticalMark = "gesture";
        current().state = "unreviewed";
        current().review.corrected = true;
      });
    } else if (keyboardEvent.altKey && keyboardEvent.key === "ArrowUp") {
      keyboardEvent.preventDefault();
      mutate(() => {
        draft.keyboardActions += 1;
        current().verticalMark = "arrow-up";
        current().state = "unreviewed";
        current().review.corrected = true;
      });
    } else if (keyboardEvent.altKey && keyboardEvent.key === "ArrowDown") {
      keyboardEvent.preventDefault();
      mutate(() => {
        draft.keyboardActions += 1;
        current().verticalMark = "arrow-down";
        current().state = "unreviewed";
        current().review.corrected = true;
      });
    } else if (keyboardEvent.altKey && keyboardEvent.key.toLowerCase() === "r") {
      keyboardEvent.preventDefault();
      mutate(() => {
        draft.keyboardActions += 1;
        const choices: EventDraft["verticalMark"][] = [
          "none",
          "barline",
          "double-barline",
          "repeat-start",
          "repeat-end",
          "arrow-up",
          "arrow-down",
          "gesture",
          "other",
        ];
        const index = choices.indexOf(current().verticalMark);
        current().verticalMark = choices[(index + 1) % choices.length]!;
        current().state = "unreviewed";
        current().review.corrected = true;
      });
    } else if (keyboardEvent.altKey && keyboardEvent.key.toLowerCase() === "o") {
      keyboardEvent.preventDefault();
      shell.querySelector<HTMLInputElement>("[data-ornaments]")!.focus();
    } else if (keyboardEvent.altKey && keyboardEvent.key.toLowerCase() === "k") {
      keyboardEvent.preventDefault();
      shell.querySelector<HTMLInputElement>("[data-marks]")!.focus();
    } else if (
      (keyboardEvent.metaKey || keyboardEvent.ctrlKey) &&
      keyboardEvent.key.toLowerCase() === "z"
    ) {
      keyboardEvent.preventDefault();
      draft.keyboardActions += 1;
      shell
        .querySelector<HTMLButtonElement>(keyboardEvent.shiftKey ? "[data-redo]" : "[data-undo]")!
        .click();
    } else if (
      (keyboardEvent.metaKey || keyboardEvent.ctrlKey) &&
      keyboardEvent.key.toLowerCase() === "y"
    ) {
      keyboardEvent.preventDefault();
      draft.keyboardActions += 1;
      shell.querySelector<HTMLButtonElement>("[data-redo]")!.click();
    } else if (keyboardEvent.key === "S" || keyboardEvent.key === "Insert") {
      keyboardEvent.preventDefault();
      draft.keyboardActions += 1;
      shell.querySelector<HTMLButtonElement>("[data-split]")!.click();
    } else if (
      keyboardEvent.key === "M" ||
      (keyboardEvent.shiftKey && keyboardEvent.key === "Delete")
    ) {
      keyboardEvent.preventDefault();
      draft.keyboardActions += 1;
      shell.querySelector<HTMLButtonElement>("[data-merge]")!.click();
    } else if (keyboardEvent.key === "R") {
      keyboardEvent.preventDefault();
      draft.keyboardActions += 1;
      copyPreviousRhythm();
    } else if (keyboardEvent.key === "P") {
      keyboardEvent.preventDefault();
      draft.keyboardActions += 1;
      shell.querySelector<HTMLButtonElement>("[data-propagate]")!.click();
    } else if (keyboardEvent.key === "U") {
      keyboardEvent.preventDefault();
      draft.keyboardActions += 1;
      moveToNextUnresolved();
    } else if (keyboardEvent.key === "=") {
      keyboardEvent.preventDefault();
      draft.keyboardActions += 1;
      copyPreviousEntry();
    } else if (keyboardEvent.key === ".") {
      keyboardEvent.preventDefault();
      mutate(() => {
        draft.keyboardActions += 1;
        current().dots = (current().dots + 1) % 3;
        current().state = "unreviewed";
        current().review.corrected = true;
      });
    } else if (keyboardEvent.key === "Enter" || keyboardEvent.key === " ") {
      keyboardEvent.preventDefault();
      draft.keyboardActions += 1;
      confirm();
    } else if (keyboardEvent.key === "[") {
      draft.keyboardActions += 1;
      move(-1);
    } else if (keyboardEvent.key === "]") {
      draft.keyboardActions += 1;
      move(1);
    } else if (keyboardEvent.key === "?") {
      draft.keyboardActions += 1;
      markAmbiguous();
    } else if (/^[1-5]$/.test(keyboardEvent.key)) {
      draft.keyboardActions += 1;
      selectedCourse = Number(keyboardEvent.key) - 1;
      persist();
      render();
    } else if (/^[a-ik-n]$/i.test(keyboardEvent.key)) {
      mutate(() => {
        draft.keyboardActions += 1;
        if (current().propagatedCourses.includes(selectedCourse)) {
          current().review.rejected = true;
          current().propagatedCourses = current().propagatedCourses.filter(
            (value) => value !== selectedCourse
          );
        }
        current().courses[selectedCourse] = keyboardEvent.key.toLowerCase();
        current().state = "unreviewed";
        current().review.corrected = true;
        selectedCourse = Math.min(run.profile.courseCount - 1, selectedCourse + 1);
      });
    } else if (keyboardEvent.key === "Backspace" || keyboardEvent.key === "Delete") {
      keyboardEvent.preventDefault();
      mutate(() => {
        draft.keyboardActions += 1;
        if (current().propagatedCourses.includes(selectedCourse)) {
          current().review.rejected = true;
          current().propagatedCourses = current().propagatedCourses.filter(
            (value) => value !== selectedCourse
          );
        }
        current().courses[selectedCourse] = null;
        current().state = "unreviewed";
        current().review.corrected = true;
      });
    }
  });
  render();
}
