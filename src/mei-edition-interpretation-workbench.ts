import type {
  CreateEditionAcceptanceDecisionCommand,
  CreateTablatureInterpretationCommand,
  EditionAcceptanceDecision,
  MeiEditionVersion,
  TablatureInterpretation,
} from "./lib/mei-edition-domain.js";

type InterpretationState = Readonly<{
  editionVersion: number;
  interpretations: readonly TablatureInterpretation[];
  decisions: readonly EditionAcceptanceDecision[];
  interpretationStatuses: readonly Readonly<{
    interpretationId: string;
    stale: boolean;
    staleDecisionIds: readonly string[];
  }>[];
  transcription: Readonly<{
    unresolvedCriticalCount: number;
    accepted: boolean;
    staleDecisionIds: readonly string[];
  }>;
}>;

type PlaybackEvent = Readonly<{
  occurrenceId: string;
  meiId: string;
  midi: number;
  startSeconds: number;
  durationSeconds: number;
}>;

type PlaybackPreview = Readonly<{
  interpretationId: string;
  authority: "provisional_audition" | "accepted_interpretation";
  permits: readonly string[];
  durationSeconds: number;
  events: readonly PlaybackEvent[];
}>;

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  const body = (await response.json()) as
    | { ok: true; data: T }
    | { ok: false; error?: { message?: string } };
  if (!response.ok || !body.ok)
    throw new Error(
      !body.ok ? (body.error?.message ?? "Edition request failed") : "Edition request failed"
    );
  return body.data;
}

function defaultCourseTunings(mei: string): CreateTablatureInterpretationCommand["courseTunings"] {
  const document = new DOMParser().parseFromString(mei, "application/xml");
  const pitchClass = new Map([
    ["c", 0],
    ["d", 2],
    ["e", 4],
    ["f", 5],
    ["g", 7],
    ["a", 9],
    ["b", 11],
  ]);
  return Array.from(document.querySelectorAll("tuning > course")).map((course) => {
    const pname = course.getAttribute("pname")?.toLowerCase() ?? "c";
    const accidental = course.getAttribute("accid");
    const offset = accidental === "f" ? -1 : accidental === "s" ? 1 : 0;
    const midi =
      (Number(course.getAttribute("oct")) + 1) * 12 + (pitchClass.get(pname) ?? 0) + offset;
    return { course: Number(course.getAttribute("n")), openMidis: [midi] };
  });
}

function serializeTunings(tunings: CreateTablatureInterpretationCommand["courseTunings"]): string {
  return tunings.map((course) => `${course.course}:${course.openMidis.join(",")}`).join("; ");
}

function parseTunings(value: string): CreateTablatureInterpretationCommand["courseTunings"] {
  return value.split(";").map((item) => {
    const [course, midis] = item.trim().split(":");
    return {
      course: Number(course),
      openMidis: midis.split(",").map((midi) => Number(midi.trim())),
    };
  });
}

function measureCount(mei: string): number {
  return new DOMParser().parseFromString(mei, "application/xml").querySelectorAll("measure").length;
}

export async function installMeiEditionInterpretationWorkbench(
  shell: HTMLElement,
  workspaceId: string,
  edition: MeiEditionVersion,
  svg: SVGSVGElement
): Promise<void> {
  const base = `/api/workspaces/${workspaceId}/mei-editions/${edition.editionId}`;
  let state = await api<InterpretationState>(`${base}/interpretation-state`);
  const section = shell.ownerDocument.createElement("section");
  section.className = "mei-interpretation-workbench";
  section.innerHTML = `<header><div><p class="artifact-preview-eyebrow">Tablature Interpretation</p><h2>Audition and acceptance</h2></div><p data-authority>Playback remains provisional until the exact transcription and interpretation are accepted.</p></header><div class="mei-interpretation-grid"><form data-interpretation-form><label>Tempo (quarter BPM)<input data-tempo type="number" min="30" max="240" value="72" required></label><label>Open-string MIDI by course<input data-tunings required></label><label>Repeat passes<input data-passes type="number" min="1" max="4" value="2" required></label><label>Rationale<input data-interpretation-rationale value="Provisional literal realization for review." required></label><label class="mei-inline-check"><input data-revise type="checkbox"> Revise selected interpretation</label><button type="submit">Create provisional interpretation</button></form><section class="mei-acceptance-session"><h3>Whole-page review decisions</h3><p data-transcription-status></p><label>Decision evidence<textarea data-decision-evidence>Compared beside the whole-page facsimile.</textarea></label><div><button type="button" data-accept-transcription>Accept transcription</button><button type="button" data-reject-transcription>Reject transcription</button></div><p data-interpretation-status>Select an interpretation to review it separately.</p><div><button type="button" data-accept-interpretation disabled>Accept interpretation</button><button type="button" data-reject-interpretation disabled>Reject interpretation</button></div></section></div><div class="mei-interpretation-list"><label>Active interpretation<select data-interpretation-select></select></label><span data-lineage></span></div><div class="mei-playback-controls"><button type="button" data-play disabled>Play</button><button type="button" data-pause disabled>Pause</button><button type="button" data-stop disabled>Stop</button><label>Playback position<input type="range" data-position min="0" max="0" step="0.01" value="0" disabled></label><span data-time>0:00 / 0:00</span><button type="button" data-score-zoom-out aria-label="Zoom score out">−</button><button type="button" data-score-zoom-reset>Fit width</button><button type="button" data-score-zoom-in aria-label="Zoom score in">+</button></div><p data-playback-status></p><p data-interpretation-error role="alert"></p>`;
  shell.append(section);

  const select = section.querySelector<HTMLSelectElement>("[data-interpretation-select]")!;
  const transcriptionStatus = section.querySelector<HTMLElement>("[data-transcription-status]")!;
  const interpretationStatus = section.querySelector<HTMLElement>("[data-interpretation-status]")!;
  const authority = section.querySelector<HTMLElement>("[data-authority]")!;
  const error = section.querySelector<HTMLElement>("[data-interpretation-error]")!;
  const evidence = section.querySelector<HTMLTextAreaElement>("[data-decision-evidence]")!;
  const position = section.querySelector<HTMLInputElement>("[data-position]")!;
  const playbackStatus = section.querySelector<HTMLElement>("[data-playback-status]")!;
  const time = section.querySelector<HTMLElement>("[data-time]")!;
  const play = section.querySelector<HTMLButtonElement>("[data-play]")!;
  const pause = section.querySelector<HTMLButtonElement>("[data-pause]")!;
  const stop = section.querySelector<HTMLButtonElement>("[data-stop]")!;
  const acceptInterpretation = section.querySelector<HTMLButtonElement>(
    "[data-accept-interpretation]"
  )!;
  const rejectInterpretation = section.querySelector<HTMLButtonElement>(
    "[data-reject-interpretation]"
  )!;
  section.querySelector<HTMLInputElement>("[data-tunings]")!.value = serializeTunings(
    defaultCourseTunings(edition.mei)
  );

  let preview: PlaybackPreview | undefined;
  let elapsed = 0;
  let startedAt = 0;
  let timer: number | undefined;
  let audioContext: AudioContext | undefined;
  const sounded = new Set<string>();
  const formatTime = (seconds: number) =>
    `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
  const showError = (reason: unknown) => {
    error.textContent = reason instanceof Error ? reason.message : "Edition interpretation failed";
  };
  const clearHighlight = () =>
    svg
      .querySelectorAll(".mei-playback-active")
      .forEach((node) => node.classList.remove("mei-playback-active"));
  const sound = (midi: number) => {
    if (!audioContext) return;
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.frequency.value = 440 * 2 ** ((midi - 69) / 12);
    gain.gain.setValueAtTime(0.0001, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.035, audioContext.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + 0.25);
    oscillator.connect(gain).connect(audioContext.destination);
    oscillator.start();
    oscillator.stop(audioContext.currentTime + 0.26);
  };
  const updatePosition = (next: number) => {
    if (!preview) return;
    elapsed = Math.max(0, Math.min(next, preview.durationSeconds));
    position.value = String(elapsed);
    time.textContent = `${formatTime(elapsed)} / ${formatTime(preview.durationSeconds)}`;
    clearHighlight();
    const activeIds = new Set(
      preview.events
        .filter(
          (event) =>
            event.startSeconds <= elapsed && event.startSeconds + event.durationSeconds > elapsed
        )
        .map((event) => event.meiId)
    );
    for (const id of activeIds)
      svg.querySelector(`g[data-id="${CSS.escape(id)}"]`)?.classList.add("mei-playback-active");
    for (const event of preview.events.filter(
      (candidate) =>
        Math.abs(candidate.startSeconds - elapsed) < 0.06 && !sounded.has(candidate.occurrenceId)
    )) {
      sounded.add(event.occurrenceId);
      sound(event.midi);
    }
    if (elapsed >= preview.durationSeconds && timer !== undefined) pausePlayback();
  };
  const pausePlayback = () => {
    if (timer !== undefined) window.clearInterval(timer);
    timer = undefined;
    pause.disabled = true;
    play.disabled = !preview;
  };
  const stopPlayback = () => {
    pausePlayback();
    sounded.clear();
    updatePosition(0);
    clearHighlight();
    stop.disabled = true;
  };
  const loadPreview = async () => {
    pausePlayback();
    sounded.clear();
    clearHighlight();
    if (!select.value) {
      preview = undefined;
      play.disabled = true;
      position.disabled = true;
      return;
    }
    preview = await api<PlaybackPreview>(`${base}/interpretations/${select.value}/playback`);
    position.max = String(preview.durationSeconds);
    position.disabled = false;
    play.disabled = false;
    stop.disabled = false;
    updatePosition(0);
    playbackStatus.textContent = `${preview.authority === "accepted_interpretation" ? "Accepted interpretation" : "Provisional audition only"} · permits ${preview.permits.join(", ")}`;
    authority.textContent =
      preview.authority === "accepted_interpretation"
        ? "Exact accepted interpretation; purpose grants remain explicit below."
        : "Provisional playback cannot authorize analysis, a Reading Edition, or idiom evidence.";
  };
  const refresh = async (selectedId?: string) => {
    state = await api<InterpretationState>(`${base}/interpretation-state`);
    select.replaceChildren();
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "Create an interpretation to audition";
    select.append(placeholder);
    for (const interpretation of state.interpretations) {
      const option = document.createElement("option");
      option.value = interpretation.id;
      const stale = state.interpretationStatuses.find(
        (status) => status.interpretationId === interpretation.id
      )?.stale;
      option.textContent = `${stale ? "STALE · " : ""}v${interpretation.version} · ${interpretation.tempo} BPM · ${interpretation.rationale}`;
      select.append(option);
    }
    select.value = selectedId ?? select.value;
    transcriptionStatus.textContent = state.transcription.accepted
      ? `Transcription v${state.editionVersion} accepted.`
      : `${state.transcription.unresolvedCriticalCount} unresolved Critical Uncertainty item(s); transcription v${state.editionVersion} is not accepted.`;
    section.querySelector<HTMLButtonElement>("[data-accept-transcription]")!.disabled =
      state.transcription.unresolvedCriticalCount > 0;
    const selected = state.interpretations.find((item) => item.id === select.value);
    const selectedStale = state.interpretationStatuses.find(
      (status) => status.interpretationId === selected?.id
    )?.stale;
    acceptInterpretation.disabled =
      !selected || !state.transcription.accepted || Boolean(selectedStale);
    rejectInterpretation.disabled = !selected;
    section.querySelector<HTMLElement>("[data-lineage]")!.textContent = selected
      ? `Exact edition v${selected.editionVersion} · interpretation v${selected.version}${selected.parentInterpretationId ? ` · revises ${selected.parentInterpretationId}` : " · independent alternative"}`
      : "Viable alternatives remain available until explicitly rejected.";
    interpretationStatus.textContent = selected
      ? `${selectedStale ? "STALE · revise against the current exact parent. " : ""}Review ${selected.id} separately from the diplomatic transcription.`
      : "Select an interpretation to review it separately.";
    await loadPreview();
  };

  section.querySelector<HTMLFormElement>("[data-interpretation-form]")!.onsubmit = (event) => {
    event.preventDefault();
    error.textContent = "";
    const selected = state.interpretations.find((item) => item.id === select.value);
    const revising = section.querySelector<HTMLInputElement>("[data-revise]")!.checked;
    const command: CreateTablatureInterpretationCommand = {
      expectedEditionVersion: edition.version,
      ...(revising && selected ? { parentInterpretationId: selected.id } : {}),
      tempo: Number(section.querySelector<HTMLInputElement>("[data-tempo]")!.value),
      courseTunings: parseTunings(section.querySelector<HTMLInputElement>("[data-tunings]")!.value),
      repeat: {
        startMeasure: 1,
        endMeasure: measureCount(edition.mei),
        totalPasses: Number(section.querySelector<HTMLInputElement>("[data-passes]")!.value),
      },
      rationale: section.querySelector<HTMLInputElement>("[data-interpretation-rationale]")!.value,
    };
    void api<{ interpretation: TablatureInterpretation }>(`${base}/interpretations`, {
      method: "POST",
      body: JSON.stringify(command),
    })
      .then((result) => refresh(result.interpretation.id))
      .catch(showError);
  };

  const decide = (
    scope: CreateEditionAcceptanceDecisionCommand["scope"],
    decision: CreateEditionAcceptanceDecisionCommand["decision"]
  ) => {
    error.textContent = "";
    const prior = [...state.decisions]
      .filter(
        (item) =>
          item.scope === scope &&
          (scope === "transcription" || item.interpretationId === select.value)
      )
      .sort((left, right) => right.version - left.version)[0];
    const command: CreateEditionAcceptanceDecisionCommand = {
      expectedEditionVersion: edition.version,
      scope,
      ...(scope === "interpretation" ? { interpretationId: select.value } : {}),
      ...(prior ? { expectedPriorDecisionId: prior.id } : {}),
      decision,
      purposes:
        decision === "rejected"
          ? []
          : scope === "transcription"
            ? ["reading_edition"]
            : ["literal_playback", "analysis"],
      evidence: evidence.value,
    };
    void api(`${base}/acceptance-decisions`, { method: "POST", body: JSON.stringify(command) })
      .then(() => refresh(select.value))
      .catch(showError);
  };
  section.querySelector<HTMLButtonElement>("[data-accept-transcription]")!.onclick = () =>
    decide("transcription", "accepted");
  section.querySelector<HTMLButtonElement>("[data-reject-transcription]")!.onclick = () =>
    decide("transcription", "rejected");
  acceptInterpretation.onclick = () => decide("interpretation", "accepted");
  rejectInterpretation.onclick = () => decide("interpretation", "rejected");
  select.onchange = () => void refresh(select.value).catch(showError);
  play.onclick = () => {
    if (!preview || timer !== undefined) return;
    const AudioContextCtor = window.AudioContext;
    if (AudioContextCtor && !audioContext) audioContext = new AudioContextCtor();
    startedAt = performance.now() - elapsed * 1000;
    timer = window.setInterval(() => updatePosition((performance.now() - startedAt) / 1000), 30);
    play.disabled = true;
    pause.disabled = false;
    stop.disabled = false;
  };
  pause.onclick = pausePlayback;
  stop.onclick = stopPlayback;
  position.oninput = () => {
    sounded.clear();
    updatePosition(Number(position.value));
    if (timer !== undefined) startedAt = performance.now() - elapsed * 1000;
  };
  let scoreZoom = 1;
  const updateScoreZoom = () => {
    svg.style.width = `${scoreZoom * 100}%`;
    svg.style.maxWidth = "none";
    section.querySelector<HTMLButtonElement>("[data-score-zoom-reset]")!.textContent =
      scoreZoom === 1 ? "Fit width" : `${Math.round(scoreZoom * 100)}%`;
  };
  section.querySelector<HTMLButtonElement>("[data-score-zoom-out]")!.onclick = () => {
    scoreZoom = Math.max(0.75, scoreZoom - 0.25);
    updateScoreZoom();
  };
  section.querySelector<HTMLButtonElement>("[data-score-zoom-reset]")!.onclick = () => {
    scoreZoom = 1;
    updateScoreZoom();
  };
  section.querySelector<HTMLButtonElement>("[data-score-zoom-in]")!.onclick = () => {
    scoreZoom = Math.min(3, scoreZoom + 0.25);
    updateScoreZoom();
  };

  await refresh();
}
