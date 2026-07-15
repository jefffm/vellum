import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { basename, join } from "node:path";

export const CLAUSE_LEDGER_SCHEMA_VERSION = 1;
export const CLAUSE_ID_PATTERN = /^II-CLAUSE-(\d{4})$/;
export const CLAUSE_MARKER_PATTERN = /<!--\s*(II-CLAUSE-\d{4})\s*-->/g;
export const CLASSIFICATIONS = Object.freeze([
  "normative",
  "execution",
  "machine_complete",
  "release_complete",
  "non_goal",
  "guardrail",
]);

const SPEC_START_HEADING = "Authority and reading order";
const SPEC_END_HEADING = "Research questions that do not block the substrate";
const SPECIAL_TRACER_ID = "dynamic-remediation";

const TOP_LEVEL_FAMILY_PREFIXES = new Map([
  ["Authority and reading order", ["II-AUTH-"]],
  ["Product outcome", ["II-OUT-"]],
  ["Why this is the next work", ["II-OUT-"]],
  ["System loop", ["II-OUT-"]],
  ["Non-negotiable boundaries", ["II-BND-"]],
  ["Reference-source substrate", ["II-SRC-"]],
  ["Reviewed Knowledge Library", ["II-KNW-"]],
  ["Applied Knowledge Manifest", ["II-KNW-"]],
  ["Knowledge reassessment", ["II-KNW-"]],
  ["Shared musical-intelligence contracts", ["II-MUS-"]],
  ["Five-course baroque-guitar compiler", ["II-BG-"]],
  ["Thirteen-course baroque-lute compiler", ["II-BL-"]],
  ["Six-string classical-guitar compiler", ["II-CG-"]],
  ["Evaluation and grading", ["II-EVAL-"]],
  ["Feedback, state, and accumulated learning", ["II-LEARN-"]],
  ["Owner experience", ["II-UX-"]],
  ["Seed source program", ["II-SEED-"]],
  ["Performance and operability acceptance", ["II-OPS-"]],
  ["Execution sequence", ["II-EXEC-"]],
  ["Completion boundary", ["II-BND-"]],
  ["Machine Complete", ["II-MC-"]],
  ["Release Complete", ["II-RC-"]],
  ["Non-goals", ["II-NG-"]],
]);

const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "before",
  "but",
  "by",
  "can",
  "for",
  "from",
  "has",
  "have",
  "in",
  "into",
  "is",
  "it",
  "its",
  "may",
  "must",
  "no",
  "not",
  "of",
  "on",
  "one",
  "only",
  "or",
  "remain",
  "than",
  "that",
  "the",
  "their",
  "this",
  "through",
  "to",
  "under",
  "when",
  "with",
  "without",
]);

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

export function normalizeClauseText(value) {
  return value
    .normalize("NFC")
    .replace(CLAUSE_MARKER_PATTERN, "")
    .replace(/^\s*(?:[-*+] |\d+[.)] )/, "")
    .replace(/^\s*\|?\s*/, "")
    .replace(/\s*\|\s*$/, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function digestClauseText(value) {
  return sha256(normalizeClauseText(value));
}

function lineRecords(markdown) {
  const records = [];
  let offset = 0;
  const lines = markdown.split("\n");
  for (let index = 0; index < lines.length; index += 1) {
    const text = lines[index];
    records.push({ index, line: index + 1, text, start: offset, end: offset + text.length });
    offset += text.length + 1;
  }
  return records;
}

function isTableSeparator(line) {
  return /^\s*\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line);
}

function isTableLine(line) {
  return /^\s*\|.*\|\s*$/.test(line);
}

function isListStart(line) {
  return /^\s*(?:[-*+] |\d+[.)] )/.test(line);
}

function headingMatch(line) {
  return /^(#{2,6})\s+(.+?)\s*$/.exec(line);
}

function stripInlineMarkdown(value) {
  return value
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[*_~]/g, "")
    .replace(/<[^>]+>/g, " ");
}

function words(value) {
  return stripInlineMarkdown(value)
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 1 && !STOP_WORDS.has(word));
}

function lexicalScore(clauseText, family) {
  const clauseWords = new Set(words(clauseText));
  const familyWords = words(`${family.id} ${family.description}`);
  let score = 0;
  for (const word of familyWords) {
    if (!clauseWords.has(word)) continue;
    score += word.length >= 10 ? 4 : word.length >= 6 ? 2 : 1;
  }
  return score;
}

function classificationForHeading(headingPath) {
  const top = headingPath[0];
  if (top === "Execution sequence") return "execution";
  if (headingPath.includes("Machine Complete")) return "machine_complete";
  if (headingPath.includes("Release Complete")) return "release_complete";
  if (top === "Non-goals") return "non_goal";
  if (top === "Non-negotiable boundaries") return "guardrail";
  return "normative";
}

function familyPrefixesForHeading(headingPath) {
  if (headingPath.includes("Machine Complete")) return ["II-MC-"];
  if (headingPath.includes("Release Complete")) return ["II-RC-"];
  for (const heading of headingPath) {
    const prefixes = TOP_LEVEL_FAMILY_PREFIXES.get(heading);
    if (prefixes) return prefixes;
  }
  throw new Error(`No requirement-family domain for heading: ${headingPath.join(" > ")}`);
}

function sourceScopeFor(classification, familyId) {
  if (classification === "execution") return "execution";
  if (classification === "machine_complete") return "machine_complete";
  if (classification === "release_complete") return "release_complete";
  if (classification === "non_goal" || classification === "guardrail") return "boundary";
  if (familyId.startsWith("II-AUTH-")) return "governance";
  return "product";
}

function parseStructuralBlocks(markdown) {
  const lines = lineRecords(markdown);
  const startIndex = lines.findIndex((entry) => entry.text === `## ${SPEC_START_HEADING}`);
  const endIndex = lines.findIndex((entry) => entry.text === `## ${SPEC_END_HEADING}`);
  if (startIndex < 0 || endIndex < 0 || endIndex <= startIndex) {
    throw new Error(
      `SPEC must contain ordered ${SPEC_START_HEADING} and ${SPEC_END_HEADING} headings`
    );
  }

  const headings = [];
  const blocks = [];
  let ordinal = 0;
  let inFence = false;
  let index = startIndex;

  while (index < endIndex) {
    const record = lines[index];
    const heading = headingMatch(record.text);
    if (heading) {
      const level = heading[1].length;
      headings.splice(Math.max(0, level - 2));
      headings[level - 2] = heading[2];
      index += 1;
      continue;
    }
    if (/^\s*```/.test(record.text)) {
      inFence = !inFence;
      index += 1;
      continue;
    }
    if (
      inFence ||
      record.text.trim() === "" ||
      /^\s*<!--\s*II-CLAUSE-\d{4}\s*-->\s*$/.test(record.text)
    ) {
      index += 1;
      continue;
    }

    if (isTableLine(record.text)) {
      if (isTableSeparator(record.text)) {
        index += 1;
        continue;
      }
      const previous = lines[index - 1]?.text ?? "";
      const next = lines[index + 1]?.text ?? "";
      if (isTableSeparator(next) || isTableSeparator(previous)) {
        index += 1;
        continue;
      }
      ordinal += 1;
      blocks.push({
        kind: "table_row",
        start: record.start,
        end: record.end,
        startLine: record.line,
        endLine: record.line,
        raw: record.text,
        headingPath: headings.filter(Boolean),
        ordinal,
      });
      index += 1;
      continue;
    }

    const start = index;
    if (isListStart(record.text)) {
      index += 1;
      while (
        index < endIndex &&
        lines[index].text.trim() !== "" &&
        !headingMatch(lines[index].text) &&
        !isListStart(lines[index].text) &&
        !isTableLine(lines[index].text) &&
        !/^\s*```/.test(lines[index].text)
      ) {
        index += 1;
      }
    } else {
      index += 1;
      while (
        index < endIndex &&
        lines[index].text.trim() !== "" &&
        !headingMatch(lines[index].text) &&
        !isListStart(lines[index].text) &&
        !isTableLine(lines[index].text) &&
        !/^\s*```/.test(lines[index].text)
      ) {
        index += 1;
      }
    }
    const last = lines[index - 1];
    ordinal += 1;
    blocks.push({
      kind: isListStart(record.text) ? "list_item" : "paragraph",
      start: lines[start].start,
      end: last.end,
      startLine: lines[start].line,
      endLine: last.line,
      raw: markdown.slice(lines[start].start, last.end),
      headingPath: headings.filter(Boolean),
      ordinal,
    });
  }

  return blocks;
}

function fragmentUnmarkedBlock(block) {
  let contentStart = 0;
  if (block.kind === "list_item") {
    contentStart = /^\s*(?:[-*+] |\d+[.)] )/.exec(block.raw)?.[0].length ?? 0;
  } else if (block.kind === "table_row") {
    contentStart = /^\s*\|\s*/.exec(block.raw)?.[0].length ?? 0;
  }
  const separators = [];
  const boundaryPattern = /(?<=[.!?;])\s+(?=(?:[A-Z`]|\[|every\b|no\b))/g;
  for (const match of block.raw.slice(contentStart).matchAll(boundaryPattern)) {
    separators.push({
      start: contentStart + match.index,
      end: contentStart + match.index + match[0].length,
    });
  }
  const starts = [contentStart, ...separators.map((separator) => separator.end)];
  const ends = [...separators.map((separator) => separator.start), block.raw.length];
  const fragments = [];
  for (let index = 0; index < starts.length; index += 1) {
    const raw = block.raw.slice(starts[index], ends[index]);
    if (normalizeClauseText(raw) === "") continue;
    fragments.push({
      raw,
      markerId: null,
      fragmentOrdinal: fragments.length + 1,
      markerOffset: starts[index],
    });
  }
  return fragments;
}

function fragmentsFromMarkedBlock(block) {
  const matches = [...block.raw.matchAll(CLAUSE_MARKER_PATTERN)];
  if (matches.length === 0) return [];
  const prefix = normalizeClauseText(block.raw.slice(0, matches[0].index));
  if (prefix !== "") {
    throw new Error(`Unmarked substantive text at SPEC line ${block.startLine}: ${prefix}`);
  }
  return matches.map((match, index) => {
    const start = match.index + match[0].length;
    const end = matches[index + 1]?.index ?? block.raw.length;
    return {
      raw: block.raw.slice(start, end),
      markerId: match[1],
      fragmentOrdinal: index + 1,
      markerOffset: match.index,
    };
  });
}

export function extractSpecClauses(markdown, { requireMarkers = false } = {}) {
  const blocks = parseStructuralBlocks(markdown);
  const clauses = [];
  const headingOrdinals = new Map();

  for (const block of blocks) {
    const fragments = requireMarkers
      ? fragmentsFromMarkedBlock(block)
      : fragmentUnmarkedBlock(block);
    if (requireMarkers && fragments.length === 0) {
      throw new Error(
        `Substantive SPEC statement at line ${block.startLine} has no II-CLAUSE marker`
      );
    }
    const headingKey = block.headingPath.join(" > ");
    const statementOrdinal = (headingOrdinals.get(headingKey) ?? 0) + 1;
    headingOrdinals.set(headingKey, statementOrdinal);
    for (const fragment of fragments) {
      const normalizedText = normalizeClauseText(fragment.raw);
      if (normalizedText === "") {
        throw new Error(`Clause marker at SPEC line ${block.startLine} has no substantive text`);
      }
      clauses.push({
        markerId: fragment.markerId,
        classification: classificationForHeading(block.headingPath),
        normalizedText,
        contentDigest: sha256(normalizedText),
        source: {
          path: "SPEC.md",
          headingPath: block.headingPath,
          statementOrdinal,
          fragmentOrdinal: fragment.fragmentOrdinal,
          startLine: block.startLine,
          endLine: block.endLine,
        },
        _block: block,
        _markerOffset: fragment.markerOffset,
      });
    }
  }
  return clauses;
}

export function parseTracerExpression(expression) {
  const result = [];
  const seen = new Set();
  const normalized = expression.replace(/[–—]/g, "-");
  for (const rawPart of normalized.split(",")) {
    const part = rawPart.trim();
    if (part === "") continue;
    if (part === SPECIAL_TRACER_ID) {
      if (!seen.has(part)) result.push(part);
      seen.add(part);
      continue;
    }
    const range = /^(?:T)?(\d{1,3})\s*-\s*(?:T)?(\d{1,3})$/.exec(part);
    if (range) {
      const start = Number(range[1]);
      const end = Number(range[2]);
      if (end < start) throw new Error(`Descending tracer range: ${part}`);
      for (let value = start; value <= end; value += 1) {
        const tracer = `T${String(value).padStart(2, "0")}`;
        if (!seen.has(tracer)) result.push(tracer);
        seen.add(tracer);
      }
      continue;
    }
    const single = /^(?:T)?(\d{1,3})$/.exec(part);
    if (!single) throw new Error(`Malformed tracer expression token: ${part}`);
    const tracer = `T${String(Number(single[1])).padStart(2, "0")}`;
    if (!seen.has(tracer)) result.push(tracer);
    seen.add(tracer);
  }
  return result;
}

function parseTableCells(line) {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

export function parseRequirementFamilies(markdown) {
  const families = [];
  const seen = new Set();
  for (const line of markdown.split("\n")) {
    if (!/^\|\s*II-[A-Z]+-[0-9A-Z]+\s*\|/.test(line)) continue;
    const cells = parseTableCells(line);
    const id = cells[0];
    if (seen.has(id)) throw new Error(`Duplicate requirement family ${id}`);
    if (cells.length < 3) throw new Error(`Malformed requirement-family row ${id}`);
    const tracerIds = parseTracerExpression(cells[2]);
    if (tracerIds.length === 0) throw new Error(`Requirement family ${id} has no tracer mapping`);
    seen.add(id);
    families.push({ id, description: cells[1], tracerIds, clauseIds: [] });
  }
  if (families.length === 0) throw new Error("No requirement families found");
  return families;
}

export function parseIssueFamilyMappings(issueDirectory) {
  const mappings = new Map();
  for (const filename of readdirSync(issueDirectory)
    .filter((name) => name.endsWith(".md"))
    .sort()) {
    const match = /^(\d{1,3})-/.exec(filename);
    if (!match) throw new Error(`Issue filename has no numeric tracer ID: ${filename}`);
    const tracerId = `T${String(Number(match[1])).padStart(2, "0")}`;
    const markdown = readFileSync(join(issueDirectory, filename), "utf8");
    const familyLine = /^Requirement families touched:\s*(.+)$/m.exec(markdown);
    if (!familyLine) throw new Error(`${filename} has no Requirement families touched header`);
    const familyIds = expandFamilyExpression(familyLine[1]);
    const blockerIds = parseIssueBlockers(markdown, filename, tracerId);
    if (mappings.has(tracerId)) throw new Error(`Duplicate issue tracer ${tracerId}`);
    mappings.set(tracerId, { path: filename, familyIds, blockerIds });
  }
  for (const [tracerId, issue] of mappings) {
    for (const blockerId of issue.blockerIds) {
      if (!mappings.has(blockerId)) {
        throw new Error(`${issue.path} names missing blocker ${blockerId} for ${tracerId}`);
      }
    }
  }
  assertAcyclicIssueBlockers(mappings);
  return mappings;
}

export function parseIssueBlockers(markdown, filename = "issue", tracerId = null) {
  const heading = /^## Blocked by\s*$/m.exec(markdown);
  if (!heading) throw new Error(`${filename} has no Blocked by section`);
  const remainder = markdown.slice(heading.index + heading[0].length);
  const nextHeadingOffset = remainder.search(/^##\s+/m);
  const section = nextHeadingOffset < 0 ? remainder : remainder.slice(0, nextHeadingOffset);
  const lines = section
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length === 1 && lines[0] === "None - can start immediately.") return [];
  if (lines.length === 0 || lines.includes("None - can start immediately.")) {
    throw new Error(`${filename} has an ambiguous Blocked by section`);
  }
  const blockers = lines.map((line) => {
    const match = /^[-*]\s+(\d{1,3})$/.exec(line);
    if (!match) throw new Error(`${filename} has malformed blocker entry: ${line}`);
    return `T${String(Number(match[1])).padStart(2, "0")}`;
  });
  if (new Set(blockers).size !== blockers.length) {
    throw new Error(`${filename} repeats a direct blocker`);
  }
  if (tracerId && blockers.includes(tracerId)) {
    throw new Error(`${filename} cannot block itself`);
  }
  return sortTracerIds(blockers);
}

export function assertAcyclicIssueBlockers(issueMappings) {
  const states = new Map();
  const stack = [];
  const visit = (tracerId) => {
    if (states.get(tracerId) === "complete") return;
    if (states.get(tracerId) === "visiting") {
      const cycleStart = stack.indexOf(tracerId);
      throw new Error(
        `Issue blocker graph contains a cycle: ${[...stack.slice(cycleStart), tracerId].join(" -> ")}`
      );
    }
    states.set(tracerId, "visiting");
    stack.push(tracerId);
    for (const blockerId of issueMappings.get(tracerId)?.blockerIds ?? []) {
      if (!issueMappings.has(blockerId)) {
        throw new Error(`${tracerId} names unknown blocker ${blockerId}`);
      }
      visit(blockerId);
    }
    stack.pop();
    states.set(tracerId, "complete");
  };
  for (const tracerId of sortTracerIds(issueMappings.keys())) visit(tracerId);
  return issueMappings;
}

function expandFamilyExpression(expression) {
  const values = [];
  const seen = new Set();
  for (const rawPart of expression.replace(/[–—]/g, "-").split(",")) {
    const part = rawPart.trim();
    if (part === "") continue;
    const range = /^(II-[A-Z]+-)(\d+)([A-Z]?)\s*-\s*(?:(II-[A-Z]+-))?(\d+)([A-Z]?)$/.exec(part);
    if (range) {
      const prefix = range[1];
      if (range[4] && range[4] !== prefix)
        throw new Error(`Cross-family range is forbidden: ${part}`);
      const start = Number(range[2]);
      const end = Number(range[5]);
      if (range[3] || range[6] || end < start) throw new Error(`Unsupported family range: ${part}`);
      for (let value = start; value <= end; value += 1) {
        const id = `${prefix}${String(value).padStart(range[2].length, "0")}`;
        if (!seen.has(id)) values.push(id);
        seen.add(id);
      }
      continue;
    }
    if (!/^II-[A-Z]+-[0-9]+[A-Z]?$/.test(part)) throw new Error(`Malformed family token: ${part}`);
    if (!seen.has(part)) values.push(part);
    seen.add(part);
  }
  return values;
}

export function assertBidirectionalFamilyTracerMapping(families, issueMappings) {
  const byId = new Map(families.map((family) => [family.id, family]));
  const tracerIdsByFamily = new Map(families.map((family) => [family.id, []]));
  const errors = [];
  for (const [tracerId, issue] of issueMappings) {
    for (const familyId of issue.familyIds) {
      const family = byId.get(familyId);
      if (!family) {
        errors.push(`${issue.path} names unknown family ${familyId}`);
      } else {
        tracerIdsByFamily.get(familyId).push(tracerId);
      }
    }
  }
  for (const family of families) {
    const issueTracers = tracerIdsByFamily.get(family.id);
    if (issueTracers.length === 0) {
      errors.push(`${family.id} has no issue mapping back to it`);
      continue;
    }
    if (family.tracerIds.includes(SPECIAL_TRACER_ID)) issueTracers.push(SPECIAL_TRACER_ID);
    tracerIdsByFamily.set(family.id, sortTracerIds(new Set(issueTracers)));
  }
  for (const [familyId, tracerIds] of tracerIdsByFamily) {
    for (const tracerId of tracerIds) {
      if (tracerId === SPECIAL_TRACER_ID) continue;
      const issue = issueMappings.get(tracerId);
      if (!issue?.familyIds.includes(familyId)) {
        errors.push(`${familyId} maps to ${tracerId}, but the issue does not map back`);
      }
    }
  }
  if (errors.length > 0)
    throw new Error(`Family/tracer mapping is not bidirectional:\n${errors.join("\n")}`);
  return tracerIdsByFamily;
}

export function formatTracerExpression(tracerIds) {
  const staticIds = sortTracerIds(tracerIds).filter((tracer) => tracer !== SPECIAL_TRACER_ID);
  const values = staticIds.map((tracer) => Number(tracer.slice(1)));
  const parts = [];
  for (let index = 0; index < values.length; ) {
    let end = index;
    while (end + 1 < values.length && values[end + 1] === values[end] + 1) end += 1;
    const startText = String(values[index]).padStart(2, "0");
    if (end === index) parts.push(startText);
    else parts.push(`${startText}–${String(values[end]).padStart(2, "0")}`);
    index = end + 1;
  }
  if (tracerIds.includes(SPECIAL_TRACER_ID)) parts.push(SPECIAL_TRACER_ID);
  return parts.join(", ");
}

export function reconcileRequirementTracerMappings(requirementsMarkdown, issueDirectory) {
  const families = parseRequirementFamilies(requirementsMarkdown);
  const issueMappings = parseIssueFamilyMappings(issueDirectory);
  const canonical = assertBidirectionalFamilyTracerMapping(families, issueMappings);
  const known = new Set(families.map((family) => family.id));
  const rewritten = requirementsMarkdown
    .split("\n")
    .map((line) => {
      if (!/^\|\s*II-[A-Z]+-[0-9A-Z]+\s*\|/.test(line)) return line;
      const cells = parseTableCells(line);
      const id = cells[0];
      if (!known.has(id) || cells.length < 3)
        throw new Error(`Cannot reconcile malformed family row ${id}`);
      const updated = [id, cells[1], formatTracerExpression(canonical.get(id)), ...cells.slice(3)];
      return `| ${updated.join(" | ")} |`;
    })
    .join("\n");
  const reparsed = parseRequirementFamilies(rewritten);
  const reparsedById = new Map(reparsed.map((family) => [family.id, family.tracerIds]));
  for (const [familyId, expected] of canonical) {
    const actual = reparsedById.get(familyId);
    if (actual.join("\0") !== expected.join("\0")) {
      throw new Error(`Reconciled REQUIREMENTS mapping mismatch for ${familyId}`);
    }
  }
  return rewritten;
}

export function planMissingFamilyIssueMappings(requirementsMarkdown, issueDirectory) {
  const families = parseRequirementFamilies(requirementsMarkdown);
  const issues = parseIssueFamilyMappings(issueDirectory);
  const known = new Set(families.map((family) => family.id));
  const observed = new Map(families.map((family) => [family.id, new Set()]));
  for (const [tracerId, issue] of issues) {
    for (const familyId of issue.familyIds) {
      if (!known.has(familyId)) throw new Error(`${issue.path} names unknown family ${familyId}`);
      observed.get(familyId).add(tracerId);
    }
  }

  const additionsByTracer = new Map();
  for (const family of families) {
    if (observed.get(family.id).size > 0) continue;
    const tracers = family.tracerIds.filter((tracerId) => tracerId !== SPECIAL_TRACER_ID);
    if (tracers.length === 0)
      throw new Error(`${family.id} has no concrete issue to receive its missing reverse mapping`);
    for (const tracerId of tracers) {
      if (!issues.has(tracerId)) throw new Error(`${family.id} names missing issue ${tracerId}`);
      if (!additionsByTracer.has(tracerId)) additionsByTracer.set(tracerId, []);
      additionsByTracer.get(tracerId).push(family.id);
    }
  }

  return sortTracerIds(additionsByTracer.keys()).map((tracerId) => {
    const issue = issues.get(tracerId);
    const path = join(issueDirectory, issue.path);
    const before = readFileSync(path, "utf8");
    const additions = additionsByTracer.get(tracerId).sort();
    const after = before.replace(
      /^(Requirement families touched:\s*)(.+)$/m,
      (_match, prefix, existing) => `${prefix}${existing}, ${additions.join(", ")}`
    );
    if (after === before) throw new Error(`Failed to update family header in ${issue.path}`);
    return { tracerId, path, relativePath: issue.path, additions, before, after };
  });
}

function assignFamilyIds(clauses, families) {
  const familyById = new Map(families.map((family) => [family.id, family]));
  const assigned = new Array(clauses.length).fill(null);

  // Closure tables and non-goals are deliberately ordinal and already have
  // clause-level family rows. This avoids semantic fuzzy matching at the boundary.
  const directPrefixes = new Map([
    ["machine_complete", "II-MC-"],
    ["non_goal", "II-NG-"],
  ]);
  for (const [classification, prefix] of directPrefixes) {
    const indexes = clauses
      .map((clause, index) => [clause, index])
      .filter(([clause]) => clause.classification === classification);
    const candidates = families.filter((family) => family.id.startsWith(prefix));
    if (indexes.length === candidates.length) {
      for (let index = 0; index < indexes.length; index += 1)
        assigned[indexes[index][1]] = candidates[index].id;
    }
  }

  const candidatesByClause = clauses.map((clause) => {
    const prefixes = familyPrefixesForHeading(clause.source.headingPath);
    const candidates = families.filter((family) =>
      prefixes.some((prefix) => family.id.startsWith(prefix))
    );
    if (candidates.length === 0) {
      throw new Error(`No family candidates for ${clause.source.headingPath.join(" > ")}`);
    }
    return candidates
      .map((family) => ({ family, score: lexicalScore(clause.normalizedText, family) }))
      .sort(
        (left, right) => right.score - left.score || left.family.id.localeCompare(right.family.id)
      );
  });

  // Give every family a source clause before filling remaining clauses. The
  // greedy order is deterministic and favors the strongest unclaimed match.
  const bestScoreByFamily = new Map(
    families.map((family) => [
      family.id,
      Math.max(...clauses.map((clause) => lexicalScore(clause.normalizedText, family))),
    ])
  );
  const familiesBySpecificity = [...families].sort(
    (left, right) =>
      bestScoreByFamily.get(right.id) - bestScoreByFamily.get(left.id) ||
      left.id.localeCompare(right.id)
  );
  for (const family of familiesBySpecificity) {
    if (assigned.includes(family.id)) continue;
    let best = null;
    for (let index = 0; index < clauses.length; index += 1) {
      if (assigned[index] !== null) continue;
      if (!candidatesByClause[index].some((candidate) => candidate.family.id === family.id))
        continue;
      const score = lexicalScore(clauses[index].normalizedText, family);
      if (!best || score > best.score || (score === best.score && index < best.index))
        best = { index, score };
    }
    if (!best) throw new Error(`No unassigned SPEC clause available for family ${family.id}`);
    assigned[best.index] = family.id;
  }
  for (let index = 0; index < clauses.length; index += 1) {
    if (assigned[index] === null) assigned[index] = candidatesByClause[index][0].family.id;
    if (!familyById.has(assigned[index]))
      throw new Error(`Unknown assigned family ${assigned[index]}`);
  }
  return assigned;
}

function sortTracerIds(values) {
  return [...values].sort((left, right) => {
    if (left === SPECIAL_TRACER_ID) return 1;
    if (right === SPECIAL_TRACER_ID) return -1;
    return Number(left.slice(1)) - Number(right.slice(1));
  });
}

function rolesForClause(family, classification, previousClause = null) {
  const staticTracers = family.tracerIds.filter((tracer) => tracer !== SPECIAL_TRACER_ID);
  let closureVerifier = ["T85", "T87"].includes(previousClause?.closureVerifier)
    ? previousClause.closureVerifier
    : classification === "release_complete"
      ? "T87"
      : "T85";
  if (staticTracers.length === 1 && staticTracers[0] === closureVerifier) {
    closureVerifier = closureVerifier === "T85" ? "T87" : "T85";
  }
  const ownerCandidates = staticTracers.filter((tracer) => tracer !== closureVerifier);
  if (ownerCandidates.length === 0) {
    throw new Error(
      `${family.id} has no implementation-owner candidate distinct from ${closureVerifier}`
    );
  }
  const implementationOwner = ownerCandidates.includes(previousClause?.implementationOwner)
    ? previousClause.implementationOwner
    : sortTracerIds(ownerCandidates)[0];
  const evidenceContributors = sortTracerIds(
    staticTracers.filter(
      (tracer) =>
        tracer !== implementationOwner &&
        tracer !== closureVerifier &&
        tracer !== "T85" &&
        tracer !== "T87"
    )
  );
  if (evidenceContributors.length === 0) {
    throw new Error(
      `${family.id} has no evidence contributor distinct from ${implementationOwner}/${closureVerifier}`
    );
  }
  return { implementationOwner, evidenceContributors, closureVerifier };
}

function allocateClauseIds(extracted, previousLedger) {
  const priorByLocator = new Map();
  const priorIds = new Set();
  let highest = 0;
  if (previousLedger) {
    validateClosedClauseLedger(previousLedger, { allowPrereleaseEmptyContributors: true });
    for (const clause of previousLedger.clauses) {
      const locator = locatorKey(clause.source);
      priorByLocator.set(locator, clause.id);
      priorIds.add(clause.id);
      highest = Math.max(highest, Number(CLAUSE_ID_PATTERN.exec(clause.id)[1]));
    }
  }
  const previousHighest = highest;
  const ids = [];
  const seen = new Set();
  for (const clause of extracted) {
    const explicit = clause.markerId;
    const prior = priorByLocator.get(locatorKey(clause.source));
    let id = explicit ?? prior;
    if (explicit) id = explicit;
    if (!id) {
      highest += 1;
      id = `II-CLAUSE-${String(highest).padStart(4, "0")}`;
    }
    if (!CLAUSE_ID_PATTERN.test(id)) throw new Error(`Invalid clause ID ${id}`);
    if (seen.has(id)) throw new Error(`Duplicate clause ID ${id}`);
    seen.add(id);
    ids.push(id);
  }
  if (previousLedger) {
    const missing = previousLedger.clauses.map((clause) => clause.id).filter((id) => !seen.has(id));
    if (missing.length > 0)
      throw new Error(`Append-only clause IDs removed: ${missing.join(", ")}`);
    const appendedNumbers = ids
      .filter((id) => !priorIds.has(id))
      .map((id) => Number(CLAUSE_ID_PATTERN.exec(id)[1]))
      .sort((left, right) => left - right);
    appendedNumbers.forEach((value, index) => {
      if (value !== previousHighest + index + 1) {
        throw new Error(
          `New clause IDs must append contiguously after II-CLAUSE-${String(previousHighest).padStart(4, "0")}`
        );
      }
    });
  }
  return ids;
}

function locatorKey(source) {
  return `${source.headingPath.join(" > ")}#${source.statementOrdinal}.${source.fragmentOrdinal}`;
}

function sortClauseIds(values) {
  return [...values].sort(
    (left, right) =>
      Number(CLAUSE_ID_PATTERN.exec(left)?.[1]) - Number(CLAUSE_ID_PATTERN.exec(right)?.[1])
  );
}

export function deriveClauseDependencies(clauses, issueMappings) {
  assertAcyclicIssueBlockers(issueMappings);
  const clauseIdsByOwner = new Map();
  for (const clause of clauses) {
    if (!CLAUSE_ID_PATTERN.test(clause.id)) {
      throw new Error(`Cannot derive dependencies for malformed clause ${clause.id}`);
    }
    if (!issueMappings.has(clause.implementationOwner)) {
      throw new Error(
        `${clause.id} implementation owner ${clause.implementationOwner} has no issue definition`
      );
    }
    if (!clauseIdsByOwner.has(clause.implementationOwner)) {
      clauseIdsByOwner.set(clause.implementationOwner, []);
    }
    clauseIdsByOwner.get(clause.implementationOwner).push(clause.id);
  }
  for (const [owner, clauseIds] of clauseIdsByOwner) {
    clauseIdsByOwner.set(owner, sortClauseIds(clauseIds));
  }

  const derived = new Map();
  for (const clause of clauses) {
    const dependencies = new Set();
    const blockerIds = issueMappings.get(clause.implementationOwner).blockerIds;
    for (const blockerId of blockerIds) {
      for (const dependency of clauseIdsByOwner.get(blockerId) ?? []) {
        if (dependency !== clause.id) dependencies.add(dependency);
      }
    }
    derived.set(clause.id, sortClauseIds(dependencies));
  }
  return derived;
}

export function assertAcyclicClauseDependencies(clauses) {
  const byId = new Map(clauses.map((clause) => [clause.id, clause]));
  const states = new Map();
  const stack = [];
  const visit = (clauseId) => {
    if (states.get(clauseId) === "complete") return;
    if (states.get(clauseId) === "visiting") {
      const cycleStart = stack.indexOf(clauseId);
      throw new Error(
        `Clause dependency graph contains a cycle: ${[...stack.slice(cycleStart), clauseId].join(" -> ")}`
      );
    }
    const clause = byId.get(clauseId);
    if (!clause) throw new Error(`Clause dependency graph names unknown clause ${clauseId}`);
    states.set(clauseId, "visiting");
    stack.push(clauseId);
    for (const dependency of clause.dependencies) visit(dependency);
    stack.pop();
    states.set(clauseId, "complete");
  };
  for (const clauseId of sortClauseIds(byId.keys())) visit(clauseId);
  return clauses;
}

export function assertDerivedClauseDependencies(ledger, issueMappings) {
  const expectedByClause = deriveClauseDependencies(ledger.clauses, issueMappings);
  for (const clause of ledger.clauses) {
    const expected = expectedByClause.get(clause.id);
    if (JSON.stringify(clause.dependencies) !== JSON.stringify(expected)) {
      throw new Error(
        `${clause.id}.dependencies must equal the clauses owned by direct blockers of ${clause.implementationOwner}`
      );
    }
  }
  assertAcyclicClauseDependencies(ledger.clauses);
  return ledger;
}

export function buildClauseLedger({
  specMarkdown,
  requirementsMarkdown,
  issueDirectory,
  previousLedger = null,
  requireMarkers = false,
}) {
  const extracted = extractSpecClauses(specMarkdown, { requireMarkers });
  const families = parseRequirementFamilies(requirementsMarkdown);
  const issueMappings = parseIssueFamilyMappings(issueDirectory);
  const tracerIdsByFamily = assertBidirectionalFamilyTracerMapping(families, issueMappings);
  for (const family of families) family.tracerIds = tracerIdsByFamily.get(family.id);
  const familyIds = assignFamilyIds(extracted, families);
  const ids = allocateClauseIds(extracted, previousLedger);
  const familyById = new Map(families.map((family) => [family.id, family]));
  const previousClauseById = new Map(
    (previousLedger?.clauses ?? []).map((clause) => [clause.id, clause])
  );

  const provisionalClauses = extracted
    .map((clause, index) => {
      const familyId = familyIds[index];
      const roles = rolesForClause(
        familyById.get(familyId),
        clause.classification,
        previousClauseById.get(ids[index])
      );
      return {
        id: ids[index],
        classification: clause.classification,
        normalizedText: clause.normalizedText,
        contentDigest: clause.contentDigest,
        source: { ...clause.source, marker: ids[index] },
        familyId,
        implementationOwner: roles.implementationOwner,
        evidenceContributors: roles.evidenceContributors,
        closureVerifier: roles.closureVerifier,
        dependencies: [],
        dependencyDigest: sha256(JSON.stringify([])),
        scope: {
          kind: sourceScopeFor(clause.classification, familyId),
          appliesTo: "instrument-intelligence-wave",
        },
        stalenessPolicy: {
          sourceDigestChange: "stale",
          familyMappingChange: "stale",
          dependencyChange: "stale",
        },
      };
    })
    .sort((left, right) => Number(left.id.slice(-4)) - Number(right.id.slice(-4)));
  const dependenciesByClause = deriveClauseDependencies(provisionalClauses, issueMappings);
  const clauses = provisionalClauses.map((clause) => {
    const dependencies = dependenciesByClause.get(clause.id);
    return {
      ...clause,
      dependencies,
      dependencyDigest: sha256(JSON.stringify(dependencies)),
    };
  });

  const clauseIdsByFamily = new Map(families.map((family) => [family.id, []]));
  for (const clause of clauses) clauseIdsByFamily.get(clause.familyId).push(clause.id);
  const ledgerFamilies = families.map((family) => ({
    id: family.id,
    description: family.description,
    tracerIds: sortTracerIds(family.tracerIds),
    clauseIds: clauseIdsByFamily.get(family.id),
  }));
  const ledger = {
    schemaVersion: CLAUSE_LEDGER_SCHEMA_VERSION,
    source: {
      path: "SPEC.md",
      boundedStartHeading: SPEC_START_HEADING,
      boundedEndHeadingExclusive: SPEC_END_HEADING,
      contentDigest: sha256(specMarkdown),
    },
    requirementIndex: {
      path: ".scratch/instrument-intelligence/REQUIREMENTS.md",
      contentDigest: sha256(requirementsMarkdown),
    },
    families: ledgerFamilies,
    clauses,
  };
  validateClosedClauseLedger(ledger, { issueMappings });
  assertFamilyClauseBijection(ledger);
  if (requireMarkers) assertMarkerBijection(specMarkdown, ledger);
  return ledger;
}

function assertExactKeys(value, keys, label) {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error(`${label} must be an object`);
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (actual.join("\0") !== expected.join("\0")) {
    throw new Error(
      `${label} keys must be exactly [${expected.join(", ")}], got [${actual.join(", ")}]`
    );
  }
}

function assertString(value, label, pattern = null) {
  if (typeof value !== "string" || value.length === 0)
    throw new Error(`${label} must be a nonempty string`);
  if (pattern && !pattern.test(value)) throw new Error(`${label} is malformed: ${value}`);
}

function assertStringArray(value, label, { nonempty = false } = {}) {
  if (!Array.isArray(value) || (nonempty && value.length === 0))
    throw new Error(`${label} must be an array`);
  value.forEach((entry, index) => assertString(entry, `${label}[${index}]`));
  if (new Set(value).size !== value.length) throw new Error(`${label} contains duplicates`);
}

export function validateClosedClauseLedger(
  ledger,
  { allowPrereleaseEmptyContributors = false, issueMappings = null } = {}
) {
  assertExactKeys(
    ledger,
    ["schemaVersion", "source", "requirementIndex", "families", "clauses"],
    "ledger"
  );
  if (ledger.schemaVersion !== CLAUSE_LEDGER_SCHEMA_VERSION)
    throw new Error("Unsupported clause-ledger schemaVersion");
  assertExactKeys(
    ledger.source,
    ["path", "boundedStartHeading", "boundedEndHeadingExclusive", "contentDigest"],
    "ledger.source"
  );
  assertString(ledger.source.path, "ledger.source.path");
  assertString(ledger.source.boundedStartHeading, "ledger.source.boundedStartHeading");
  assertString(
    ledger.source.boundedEndHeadingExclusive,
    "ledger.source.boundedEndHeadingExclusive"
  );
  assertString(ledger.source.contentDigest, "ledger.source.contentDigest", /^[a-f0-9]{64}$/);
  assertExactKeys(ledger.requirementIndex, ["path", "contentDigest"], "ledger.requirementIndex");
  assertString(ledger.requirementIndex.path, "ledger.requirementIndex.path");
  assertString(
    ledger.requirementIndex.contentDigest,
    "ledger.requirementIndex.contentDigest",
    /^[a-f0-9]{64}$/
  );
  if (!Array.isArray(ledger.families) || ledger.families.length === 0)
    throw new Error("ledger.families must be nonempty");
  if (!Array.isArray(ledger.clauses) || ledger.clauses.length === 0)
    throw new Error("ledger.clauses must be nonempty");

  const familyIds = new Set();
  ledger.families.forEach((family, index) => {
    const label = `ledger.families[${index}]`;
    assertExactKeys(family, ["id", "description", "tracerIds", "clauseIds"], label);
    assertString(family.id, `${label}.id`, /^II-[A-Z]+-[0-9]+[A-Z]?$/);
    assertString(family.description, `${label}.description`);
    assertStringArray(family.tracerIds, `${label}.tracerIds`, { nonempty: true });
    family.tracerIds.forEach((tracerId) => {
      if (tracerId !== SPECIAL_TRACER_ID && !/^T\d{2,3}$/.test(tracerId)) {
        throw new Error(`${label}.tracerIds contains malformed tracer ${tracerId}`);
      }
    });
    assertStringArray(family.clauseIds, `${label}.clauseIds`, { nonempty: true });
    if (familyIds.has(family.id)) throw new Error(`Duplicate family ${family.id}`);
    familyIds.add(family.id);
  });

  const clauseIds = new Set();
  ledger.clauses.forEach((clause, index) => {
    const label = `ledger.clauses[${index}]`;
    assertExactKeys(
      clause,
      [
        "id",
        "classification",
        "normalizedText",
        "contentDigest",
        "source",
        "familyId",
        "implementationOwner",
        "evidenceContributors",
        "closureVerifier",
        "dependencies",
        "dependencyDigest",
        "scope",
        "stalenessPolicy",
      ],
      label
    );
    assertString(clause.id, `${label}.id`, CLAUSE_ID_PATTERN);
    if (clauseIds.has(clause.id)) throw new Error(`Duplicate clause ${clause.id}`);
    clauseIds.add(clause.id);
    if (!CLASSIFICATIONS.includes(clause.classification))
      throw new Error(`${label}.classification is invalid`);
    assertString(clause.normalizedText, `${label}.normalizedText`);
    assertString(clause.contentDigest, `${label}.contentDigest`, /^[a-f0-9]{64}$/);
    if (digestClauseText(clause.normalizedText) !== clause.contentDigest)
      throw new Error(`${label}.contentDigest mismatch`);
    assertExactKeys(
      clause.source,
      [
        "path",
        "marker",
        "headingPath",
        "statementOrdinal",
        "fragmentOrdinal",
        "startLine",
        "endLine",
      ],
      `${label}.source`
    );
    assertString(clause.source.path, `${label}.source.path`);
    assertString(clause.source.marker, `${label}.source.marker`, CLAUSE_ID_PATTERN);
    if (clause.source.marker !== clause.id)
      throw new Error(`${label}.source.marker must equal clause ID`);
    assertStringArray(clause.source.headingPath, `${label}.source.headingPath`, { nonempty: true });
    for (const scalar of ["statementOrdinal", "fragmentOrdinal", "startLine", "endLine"]) {
      if (!Number.isInteger(clause.source[scalar]) || clause.source[scalar] < 1) {
        throw new Error(`${label}.source.${scalar} must be a positive integer`);
      }
    }
    assertString(clause.familyId, `${label}.familyId`, /^II-[A-Z]+-[0-9]+[A-Z]?$/);
    if (!familyIds.has(clause.familyId)) throw new Error(`${label}.familyId is unknown`);
    assertString(clause.implementationOwner, `${label}.implementationOwner`, /^T\d{2,3}$/);
    assertStringArray(clause.evidenceContributors, `${label}.evidenceContributors`);
    if (!allowPrereleaseEmptyContributors && clause.evidenceContributors.length === 0) {
      throw new Error(`${label}.evidenceContributors must contain an independent witness`);
    }
    assertString(clause.closureVerifier, `${label}.closureVerifier`, /^T\d{2,3}$/);
    if (!["T85", "T87"].includes(clause.closureVerifier)) {
      throw new Error(`${label}.closureVerifier must be T85 or T87`);
    }
    if (clause.evidenceContributors.includes(clause.implementationOwner)) {
      throw new Error(`${label} implementation owner cannot be an evidence contributor`);
    }
    if (clause.evidenceContributors.includes(clause.closureVerifier)) {
      throw new Error(`${label} closure verifier cannot be an evidence contributor`);
    }
    if (clause.implementationOwner === clause.closureVerifier) {
      throw new Error(`${label} implementation owner cannot be the closure verifier`);
    }
    const family = ledger.families.find((candidate) => candidate.id === clause.familyId);
    if (!family.tracerIds.includes(clause.implementationOwner)) {
      throw new Error(`${label}.implementationOwner is not mapped by ${clause.familyId}`);
    }
    for (const contributor of clause.evidenceContributors) {
      if (!family.tracerIds.includes(contributor)) {
        throw new Error(
          `${label}.evidenceContributors includes a tracer not mapped by ${clause.familyId}`
        );
      }
    }
    assertStringArray(clause.dependencies, `${label}.dependencies`);
    if (
      JSON.stringify(clause.dependencies) !== JSON.stringify(sortClauseIds(clause.dependencies))
    ) {
      throw new Error(`${label}.dependencies must be sorted by stable clause ID`);
    }
    assertString(clause.dependencyDigest, `${label}.dependencyDigest`, /^[a-f0-9]{64}$/);
    if (clause.dependencyDigest !== sha256(JSON.stringify(clause.dependencies))) {
      throw new Error(`${label}.dependencyDigest does not bind its exact dependency list`);
    }
    clause.dependencies.forEach((dependency) => {
      if (!CLAUSE_ID_PATTERN.test(dependency))
        throw new Error(`${label}.dependencies contains malformed clause ID`);
    });
    assertExactKeys(clause.scope, ["kind", "appliesTo"], `${label}.scope`);
    if (
      ![
        "governance",
        "product",
        "execution",
        "machine_complete",
        "release_complete",
        "boundary",
      ].includes(clause.scope.kind)
    ) {
      throw new Error(`${label}.scope.kind is invalid`);
    }
    if (clause.scope.appliesTo !== "instrument-intelligence-wave")
      throw new Error(`${label}.scope.appliesTo is invalid`);
    assertExactKeys(
      clause.stalenessPolicy,
      ["sourceDigestChange", "familyMappingChange", "dependencyChange"],
      `${label}.stalenessPolicy`
    );
    for (const value of Object.values(clause.stalenessPolicy)) {
      if (value !== "stale") throw new Error(`${label}.stalenessPolicy values must be stale`);
    }
  });
  for (const clause of ledger.clauses) {
    for (const dependency of clause.dependencies) {
      if (!clauseIds.has(dependency))
        throw new Error(`${clause.id} depends on unknown clause ${dependency}`);
      if (dependency === clause.id) throw new Error(`${clause.id} cannot depend on itself`);
    }
  }
  assertAcyclicClauseDependencies(ledger.clauses);
  if (issueMappings) assertDerivedClauseDependencies(ledger, issueMappings);
  return ledger;
}

export function assertFamilyClauseBijection(ledger) {
  const expected = new Map(ledger.families.map((family) => [family.id, new Set(family.clauseIds)]));
  const observed = new Map(ledger.families.map((family) => [family.id, new Set()]));
  for (const clause of ledger.clauses) observed.get(clause.familyId).add(clause.id);
  for (const family of ledger.families) {
    const expectedIds = [...expected.get(family.id)].sort();
    const observedIds = [...observed.get(family.id)].sort();
    if (expectedIds.join("\0") !== observedIds.join("\0")) {
      throw new Error(`Family/clause mapping mismatch for ${family.id}`);
    }
  }
}

export function assertMarkerBijection(specMarkdown, ledger) {
  const extracted = extractSpecClauses(specMarkdown, { requireMarkers: true });
  const byId = new Map(ledger.clauses.map((clause) => [clause.id, clause]));
  if (extracted.length !== ledger.clauses.length) {
    throw new Error(
      `SPEC marker count ${extracted.length} does not equal ledger clause count ${ledger.clauses.length}`
    );
  }
  const seen = new Set();
  for (const sourceClause of extracted) {
    if (!sourceClause.markerId || seen.has(sourceClause.markerId))
      throw new Error(`Duplicate or missing marker ${sourceClause.markerId}`);
    seen.add(sourceClause.markerId);
    const ledgerClause = byId.get(sourceClause.markerId);
    if (!ledgerClause)
      throw new Error(`SPEC marker ${sourceClause.markerId} is absent from ledger`);
    if (
      sourceClause.normalizedText !== ledgerClause.normalizedText ||
      sourceClause.contentDigest !== ledgerClause.contentDigest
    ) {
      throw new Error(`SPEC marker ${sourceClause.markerId} text/digest disagrees with ledger`);
    }
    if (locatorKey(sourceClause.source) !== locatorKey(ledgerClause.source)) {
      throw new Error(`SPEC marker ${sourceClause.markerId} locator disagrees with ledger`);
    }
  }
  for (const clause of ledger.clauses) {
    if (!seen.has(clause.id)) throw new Error(`Ledger clause ${clause.id} has no SPEC marker`);
  }
}

export function renderMarkedSpecCandidate(specMarkdown, ledger) {
  const extracted = extractSpecClauses(specMarkdown, { requireMarkers: false });
  if (extracted.length !== ledger.clauses.length)
    throw new Error("Cannot mark SPEC: extraction count disagrees with ledger");
  const grouped = new Map();
  extracted.forEach((clause, index) => {
    const block = clause._block;
    if (!grouped.has(block.start)) grouped.set(block.start, { block, insertions: [] });
    grouped.get(block.start).insertions.push({
      offset: clause._markerOffset,
      marker: `<!-- ${ledger.clauses[index].id} --> `,
    });
  });
  const replacements = [...grouped.values()].map(({ block, insertions }) => {
    let replacement = block.raw;
    for (const insertion of insertions.sort((left, right) => right.offset - left.offset)) {
      replacement = `${replacement.slice(0, insertion.offset)}${insertion.marker}${replacement.slice(insertion.offset)}`;
    }
    return { start: block.start, end: block.end, replacement };
  });
  let result = specMarkdown;
  for (const replacement of replacements.sort((left, right) => right.start - left.start)) {
    result = `${result.slice(0, replacement.start)}${replacement.replacement}${result.slice(replacement.end)}`;
  }
  assertMarkerBijection(result, ledger);
  return result;
}

function canonicalJson(value, depth = 0, prefixWidth = 0) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);

  const indentation = "  ".repeat(depth);
  const childIndentation = "  ".repeat(depth + 1);
  if (Array.isArray(value)) {
    if (value.length === 0) return "[]";
    if (value.every((item) => item === null || typeof item !== "object")) {
      const inline = `[${value.map((item) => JSON.stringify(item)).join(", ")}]`;
      // Reserve one column for the parent object's trailing comma. This matches
      // Prettier's JSON grouping at the repository's 100-column print width.
      if (prefixWidth + inline.length <= 99) return inline;
    }
    return `[
${value
  .map((item, index) => {
    const suffix = index === value.length - 1 ? "" : ",";
    return `${childIndentation}${canonicalJson(item, depth + 1, childIndentation.length)}${suffix}`;
  })
  .join("\n")}
${indentation}]`;
  }

  const entries = Object.entries(value);
  if (entries.length === 0) return "{}";
  return `{
${entries
  .map(([key, item], index) => {
    const encodedKey = JSON.stringify(key);
    const propertyPrefix = `${childIndentation}${encodedKey}: `;
    const suffix = index === entries.length - 1 ? "" : ",";
    return `${propertyPrefix}${canonicalJson(item, depth + 1, propertyPrefix.length)}${suffix}`;
  })
  .join("\n")}
${indentation}}`;
}

export function canonicalClauseLedgerJson(ledger) {
  validateClosedClauseLedger(ledger);
  assertFamilyClauseBijection(ledger);
  return `${canonicalJson(ledger)}\n`;
}

export function assertCanonicalClauseLedgerJson(raw) {
  const parsed = JSON.parse(raw);
  const canonical = canonicalClauseLedgerJson(parsed);
  if (raw !== canonical) throw new Error("Clause ledger JSON is not canonical");
  return parsed;
}

export function loadClauseLedgerInputs(rootDirectory) {
  return {
    specMarkdown: readFileSync(join(rootDirectory, "SPEC.md"), "utf8"),
    requirementsMarkdown: readFileSync(
      join(rootDirectory, ".scratch/instrument-intelligence/REQUIREMENTS.md"),
      "utf8"
    ),
    issueDirectory: join(rootDirectory, ".scratch/instrument-intelligence/issues"),
  };
}

export function issueTracerIdFromPath(path) {
  const match = /^(\d{1,3})-/.exec(basename(path));
  if (!match) throw new Error(`Not an Instrument Intelligence issue path: ${path}`);
  return `T${String(Number(match[1])).padStart(2, "0")}`;
}
