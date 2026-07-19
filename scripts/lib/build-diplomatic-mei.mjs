const escapeXml = (value) =>
  String(value).replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;");

export function buildDiplomaticMei(extraction) {
  const zones = [];
  const tokens = [];
  const layoutByMeasure = sourceLayoutByMeasure(extraction);
  const systemStarts = new Set(
    extraction.sourceLayout.systems.slice(1).map(({ measureStart }) => measureStart)
  );
  const returnMarksByMeasure = sourceReturnMarksByMeasure(extraction);
  const buildGroups = (events, layout, idPrefix) => {
    const [measureLeft, measureRight] = layout.measureBounds;
    return events.map((event, eventIndex) => {
      const eventNumber = eventIndex + 1;
      if (!event.sourceBounds) {
        throw new Error(`${idPrefix}e${eventNumber} requires inspected source bounds`);
      }
      const [sourceLeft, sourceRight] = event.sourceBounds;
      if (
        !Number.isFinite(sourceLeft) ||
        !Number.isFinite(sourceRight) ||
        sourceLeft < measureLeft ||
        sourceRight > measureRight ||
        sourceLeft >= sourceRight
      ) {
        throw new Error(`${idPrefix}e${eventNumber} has invalid inspected source bounds`);
      }
      const x = sourceLeft;
      const width = sourceRight - sourceLeft;
      const eventId = `${idPrefix}event-${eventNumber}`;
      const courseGap = (layout.staffBottom - layout.staffTop) / 4;
      const eventRegion = {
        page: extraction.sourcePage,
        x,
        y: Math.max(0, layout.staffTop - courseGap * 0.55),
        width,
        height: layout.staffBottom - layout.staffTop + courseGap * 1.1,
      };
      const rhythmVisible = event.rhythmVisible !== false;
      const [rhythmLeft, rhythmRight] = event.rhythmSourceBounds ?? event.sourceBounds;
      if (
        rhythmVisible &&
        (!Number.isFinite(rhythmLeft) ||
          !Number.isFinite(rhythmRight) ||
          rhythmLeft < sourceLeft ||
          rhythmRight > sourceRight ||
          rhythmLeft >= rhythmRight)
      ) {
        throw new Error(`${idPrefix}e${eventNumber} has invalid inspected rhythm bounds`);
      }
      const rhythmRegion = {
        page: extraction.sourcePage,
        x: rhythmLeft,
        y: layout.rhythmTop,
        width: rhythmRight - rhythmLeft,
        height: layout.staffTop - layout.rhythmTop + 0.008,
      };
      if (event.kind === "strum") {
        if (event.direction !== "up" && event.direction !== "down") {
          throw new Error(`Historical strum ${idPrefix}e${eventNumber} requires a direction`);
        }
        if (event.chordSource !== "held" && event.chordSource !== "explicit") {
          throw new Error(
            `Historical strum ${idPrefix}e${eventNumber} requires held or explicit chord evidence`
          );
        }
        if (event.chordSource === "held" && event.notes?.length) {
          throw new Error(`Held historical strum ${idPrefix}e${eventNumber} cannot invent notes`);
        }
        if (event.chordSource === "explicit" && !event.notes?.length) {
          throw new Error(`Explicit historical strum ${idPrefix}e${eventNumber} requires notes`);
        }
        const strumId = `${idPrefix}strum-${eventNumber}`;
        const strumRegion = {
          page: extraction.sourcePage,
          x,
          y: Math.max(0, layout.staffTop - courseGap * 0.35),
          width,
          height: courseGap * 1.7,
        };
        zones.push(zone(strumId, strumRegion));
        tokens.push(token(strumId, "strum", strumRegion, event.confidence));
        if (event.chordSource === "held" && rhythmVisible) {
          throw new Error(
            `Held historical strum ${idPrefix}e${eventNumber} carries its rhythm in the strum sign`
          );
        }
        const rhythmId = `${idPrefix}rhythm-${eventNumber}`;
        if (rhythmVisible) {
          zones.push(zone(rhythmId, rhythmRegion));
          tokens.push(token(rhythmId, "rhythm", rhythmRegion, event.confidence));
        }
        const notes = (event.notes ?? []).map(([course, fret], noteIndex) => {
          const id = `${idPrefix}e${eventNumber}-n${noteIndex + 1}`;
          const region = {
            page: extraction.sourcePage,
            x,
            y: Math.max(0, layout.staffTop + (course - 1) * courseGap - courseGap * 0.55),
            width,
            height: courseGap * 1.1,
          };
          zones.push(zone(id, region));
          tokens.push(token(id, "tablature", region, event.confidence));
          return `<note xml:id="${id}" facs="#zone-${id}" tab.course="${course}" tab.fret="${fret}"/>`;
        });
        return `<tabGrp xml:id="${strumId}" dur="${event.dur}"${event.dots ? ` dots="${event.dots}"` : ""} type="historical-strum-${event.direction} chord-${event.chordSource}" facs="#zone-${strumId}">${rhythmVisible ? `<tabDurSym xml:id="${rhythmId}" facs="#zone-${rhythmId}"/>` : ""}${event.chordSource === "held" ? `<tabDurSym xml:id="${strumId}-render-anchor" type="strum-render-anchor"/>` : ""}${notes.join("")}</tabGrp>`;
      }
      if (!event.notes?.length) {
        throw new Error(`Punctuated tablature event ${idPrefix}e${eventNumber} requires notes`);
      }
      const rhythmId = `${idPrefix}rhythm-${eventNumber}`;
      if (rhythmVisible) {
        zones.push(zone(rhythmId, rhythmRegion));
        tokens.push(token(rhythmId, "rhythm", rhythmRegion, event.confidence));
      }
      if (event.simultaneity === "pince") {
        zones.push(zone(eventId, eventRegion));
        tokens.push(token(eventId, "pince", eventRegion, event.confidence));
      }
      const notes = event.notes.map(([course, fret], noteIndex) => {
        const id = `${idPrefix}e${eventNumber}-n${noteIndex + 1}`;
        const region = {
          page: extraction.sourcePage,
          x,
          y: Math.max(0, layout.staffTop + (course - 1) * courseGap - courseGap * 0.55),
          width,
          height: courseGap * 1.1,
        };
        zones.push(zone(id, region));
        tokens.push(token(id, "tablature", region, event.confidence));
        return `<note xml:id="${id}" facs="#zone-${id}" tab.course="${course}" tab.fret="${fret}"/>`;
      });
      return `<tabGrp xml:id="${eventId}" dur="${event.dur}"${event.dots ? ` dots="${event.dots}"` : ""}${event.simultaneity === "pince" ? ' type="pince"' : ""}${event.simultaneity === "pince" ? ` facs="#zone-${eventId}"` : ""}>${rhythmVisible ? `<tabDurSym xml:id="${rhythmId}" facs="#zone-${rhythmId}"/>` : ""}${notes.join("")}</tabGrp>`;
    });
  };
  const buildMeasure = (events, measureNumber, layout, options = {}) => {
    const [, measureRight] = layout.measureBounds;
    const measureId = options.partialId ?? `measure-${measureNumber}`;
    const barlineRegion = {
      page: extraction.sourcePage,
      x: measureRight - 0.004,
      y: layout.staffTop,
      width: 0.008,
      height: layout.staffBottom - layout.staffTop,
    };
    zones.push(zone(measureId, barlineRegion));
    tokens.push(token(measureId, "barline", barlineRegion, 0.95));
    const idPrefix = options.partialPrefix ?? `m${measureNumber}-`;
    const groups = buildGroups(events, layout, idPrefix);
    const repeatMarks = (returnMarksByMeasure.get(measureNumber) ?? []).map((mark) => {
      zones.push(zone(mark.id, mark.region));
      tokens.push(token(mark.id, "other", mark.region, mark.confidence));
      return `<repeatMark xml:id="${mark.id}" func="segno" type="petite-reprise-${mark.role}" n="${escapeXml(mark.returnId)}" startid="#${mark.eventId}" facs="#zone-${mark.id}">S.</repeatMark>`;
    });
    return `${!options.partial && !options.suppressSystemBreak && systemStarts.has(measureNumber) ? "<sb/>" : ""}<measure xml:id="${measureId}" facs="#zone-${measureId}" n="${options.partial ? options.partialNumber : measureNumber}"${options.partial ? ` metcon="false" type="${options.partialType}"` : ""}${options.right ? ` right="${options.right}"` : ""}${options.left ? ` left="${options.left}"` : ""}><staff n="1"><layer n="1">${groups.join("")}</layer></staff>${repeatMarks.join("")}</measure>`;
  };
  const sectionPickups = new Map(
    (extraction.sectionPickups ?? []).map((pickup, pickupIndex) => {
      if (
        !Number.isInteger(pickup.beforeMeasure) ||
        pickup.beforeMeasure < 2 ||
        pickup.beforeMeasure > extraction.measures.length
      ) {
        throw new Error(`Section pickup ${pickupIndex + 1} has an invalid following measure`);
      }
      return [pickup.beforeMeasure, { ...pickup, pickupIndex }];
    })
  );
  if (sectionPickups.size !== (extraction.sectionPickups ?? []).length) {
    throw new Error("Section pickups must precede distinct numbered measures");
  }
  const sectionClosings = new Map(
    (extraction.sectionClosings ?? []).map((closing, closingIndex) => {
      if (
        !Number.isInteger(closing.afterMeasure) ||
        closing.afterMeasure < 1 ||
        closing.afterMeasure >= extraction.measures.length
      ) {
        throw new Error(`Section closing ${closingIndex + 1} has an invalid preceding measure`);
      }
      return [closing.afterMeasure, { ...closing, closingIndex }];
    })
  );
  if (sectionClosings.size !== (extraction.sectionClosings ?? []).length) {
    throw new Error("Section closings must follow distinct numbered measures");
  }
  const measures = extraction.measures.map((events, measureIndex) => {
    const measureNumber = measureIndex + 1;
    const layout = layoutByMeasure.get(measureNumber);
    if (!layout) throw new Error(`Source layout is missing measure ${measureNumber}`);
    const pickup = sectionPickups.get(measureNumber);
    const pickupMei = pickup
      ? buildMeasure(
          pickup.events,
          measureNumber,
          { ...layout, measureBounds: pickup.sourceBounds },
          {
            partial: true,
            partialId: `section-${pickup.pickupIndex + 2}-pickup-measure`,
            partialPrefix: `section-${pickup.pickupIndex + 2}-pickup-`,
            partialNumber: `${measureNumber - 1}a`,
            partialType: "section-pickup",
          }
        )
      : "";
    const closing = sectionClosings.get(measureNumber);
    const numberedMeasure = buildMeasure(events, measureNumber, layout, {
      ...(pickup ? { suppressSystemBreak: true } : {}),
      ...(extraction.repeatStarts?.includes(measureNumber) ? { left: "rptstart" } : {}),
      ...(extraction.repeatEnds?.includes(measureNumber) && !closing ? { right: "rptend" } : {}),
    });
    const closingMei = closing
      ? buildMeasure(
          closing.events,
          measureNumber,
          { ...layout, measureBounds: closing.sourceBounds },
          {
            partial: true,
            partialId: `section-${closing.closingIndex + 1}-closing-measure`,
            partialPrefix: `section-${closing.closingIndex + 1}-closing-`,
            partialNumber: `${measureNumber}b`,
            partialType: "section-closing",
            right: "rptend",
          }
        )
      : "";
    return `${pickup && systemStarts.has(measureNumber) ? "<sb/>" : ""}${pickupMei}${numberedMeasure}${closingMei}`;
  });
  const pickup = extraction.pickup?.length
    ? buildMeasure(
        extraction.pickup,
        0,
        {
          ...layoutByMeasure.get(1),
          measureBounds: extraction.sourceLayout.pickupBounds,
        },
        {
          partial: true,
          partialId: "pickup-measure",
          partialPrefix: "pickup-",
          partialNumber: "0",
          partialType: "section-pickup",
        }
      )
    : "";
  const tuning = extraction.tuning
    .map((course) => `<course n="${course.course}" pname="${course.pname}" oct="${course.oct}"/>`)
    .join("");
  const mei = `<?xml version="1.0" encoding="UTF-8"?><mei xmlns="http://www.music-encoding.org/ns/mei" meiversion="5.1"><meiHead><fileDesc><titleStmt><title>${escapeXml(extraction.title)}</title></titleStmt><pubStmt><p>Provisional source-linked transcription; not accepted.</p></pubStmt></fileDesc></meiHead><facsimile><surface xml:id="source-page-${extraction.sourcePage}" n="${extraction.sourcePage}">${zones.join("")}</surface></facsimile><music><body><mdiv xml:id="devisee-page9-mdiv"><score xml:id="devisee-page9-score"><scoreDef meter.count="${extraction.meter.count}" meter.unit="${extraction.meter.unit}"><staffGrp><staffDef n="1" lines="5" notationtype="tab.lute.french" type="vellum.notehead-rhythm-signs"><label>Guitare</label><tuning>${tuning}</tuning></staffDef></staffGrp></scoreDef><section xml:id="devisee-page9-section">${pickup}${measures.join("")}</section></score></mdiv></body></music></mei>`;
  return { mei, tokens };
}

function sourceReturnMarksByMeasure(extraction) {
  const result = new Map();
  const seen = new Set();
  for (const [returnIndex, sourceReturn] of (extraction.sourceReturns ?? []).entries()) {
    if (!sourceReturn.id || seen.has(sourceReturn.id)) {
      throw new Error(`Source return ${returnIndex + 1} has an invalid or duplicate ID`);
    }
    seen.add(sourceReturn.id);
    for (const role of ["start", "end"]) {
      const mark = sourceReturn[role];
      const events = extraction.measures[mark?.measure - 1];
      const event = events?.[mark?.event - 1];
      if (!event || !mark.region) {
        throw new Error(`Source return ${sourceReturn.id} has an invalid ${role} anchor`);
      }
      const eventId =
        event.kind === "strum"
          ? `m${mark.measure}-strum-${mark.event}`
          : `m${mark.measure}-event-${mark.event}`;
      const item = {
        id: `${sourceReturn.id}-${role}`,
        returnId: sourceReturn.id,
        role,
        eventId,
        region: { page: extraction.sourcePage, ...mark.region },
        confidence: mark.confidence,
      };
      result.set(mark.measure, [...(result.get(mark.measure) ?? []), item]);
    }
  }
  return result;
}

function sourceLayoutByMeasure(extraction) {
  if (!extraction.sourceLayout?.systems?.length) {
    throw new Error("Diplomatic extraction requires explicit source-layout evidence");
  }
  const result = new Map();
  for (const system of extraction.sourceLayout.systems) {
    for (const [offset, measureBounds] of system.measureBounds.entries()) {
      const measureNumber = system.measureStart + offset;
      if (result.has(measureNumber))
        throw new Error(`Source layout duplicates measure ${measureNumber}`);
      result.set(measureNumber, {
        rhythmTop: system.rhythmTop,
        staffTop: system.staffTop,
        staffBottom: system.staffBottom,
        measureBounds,
      });
    }
  }
  if (result.size !== extraction.measures.length) {
    throw new Error(
      `Source layout covers ${result.size} measures but extraction contains ${extraction.measures.length}`
    );
  }
  return result;
}

function zone(id, region) {
  return `<zone xml:id="zone-${id}" ulx="${Math.round(region.x * 10000)}" uly="${Math.round(region.y * 10000)}" lrx="${Math.round((region.x + region.width) * 10000)}" lry="${Math.round((region.y + region.height) * 10000)}"/>`;
}

function token(id, kind, region, confidence) {
  return {
    id,
    kind,
    region,
    confidence,
    alternatives: confidence < 0.8 ? ["Review the source-linked diplomatic reading"] : [],
    critical: confidence < 0.6,
  };
}
