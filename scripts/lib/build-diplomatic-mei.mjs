const escapeXml = (value) =>
  String(value).replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;");

export function buildDiplomaticMei(extraction) {
  const zones = [];
  const tokens = [];
  const layoutByMeasure = sourceLayoutByMeasure(extraction);
  const systemStarts = new Set(
    extraction.sourceLayout.systems.slice(1).map(({ measureStart }) => measureStart)
  );
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
        const rhythmVisible = event.rhythmVisible !== false;
        if (event.chordSource === "held" && rhythmVisible) {
          throw new Error(
            `Held historical strum ${idPrefix}e${eventNumber} carries its rhythm in the strum sign`
          );
        }
        const rhythmId = `${idPrefix}rhythm-${eventNumber}`;
        const rhythmRegion = {
          page: extraction.sourcePage,
          x,
          y: layout.rhythmTop,
          width,
          height: layout.staffTop - layout.rhythmTop + 0.008,
        };
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
      const rhythmRegion = {
        page: extraction.sourcePage,
        x,
        y: layout.rhythmTop,
        width,
        height: layout.staffTop - layout.rhythmTop + 0.008,
      };
      const rhythmVisible = event.rhythmVisible !== false;
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
    const measureId = options.pickupId ?? `measure-${measureNumber}`;
    const barlineRegion = {
      page: extraction.sourcePage,
      x: measureRight - 0.004,
      y: layout.staffTop,
      width: 0.008,
      height: layout.staffBottom - layout.staffTop,
    };
    zones.push(zone(measureId, barlineRegion));
    tokens.push(token(measureId, "barline", barlineRegion, 0.95));
    const idPrefix = options.pickupPrefix ?? `m${measureNumber}-`;
    const groups = buildGroups(events, layout, idPrefix);
    return `${!options.pickup && !options.suppressSystemBreak && systemStarts.has(measureNumber) ? "<sb/>" : ""}<measure xml:id="${measureId}" facs="#zone-${measureId}" n="${options.pickup ? options.pickupNumber : measureNumber}"${options.pickup ? ' metcon="false"' : ""}${options.right ? ` right="${options.right}"` : ""}${options.left ? ` left="${options.left}"` : ""}><staff n="1"><layer n="1">${groups.join("")}</layer></staff></measure>`;
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
            pickup: true,
            pickupId: `section-${pickup.pickupIndex + 2}-pickup-measure`,
            pickupPrefix: `section-${pickup.pickupIndex + 2}-pickup-`,
            pickupNumber: `${measureNumber - 1}a`,
          }
        )
      : "";
    return `${pickup && systemStarts.has(measureNumber) ? "<sb/>" : ""}${pickupMei}${buildMeasure(
      events,
      measureNumber,
      layout,
      {
        ...(pickup ? { suppressSystemBreak: true } : {}),
        ...(extraction.repeatStarts?.includes(measureNumber) ? { left: "rptstart" } : {}),
        ...(extraction.repeatEnds?.includes(measureNumber) ? { right: "rptend" } : {}),
      }
    )}`;
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
          pickup: true,
          pickupId: "pickup-measure",
          pickupPrefix: "pickup-",
          pickupNumber: "0",
        }
      )
    : "";
  const tuning = extraction.tuning
    .map((course) => `<course n="${course.course}" pname="${course.pname}" oct="${course.oct}"/>`)
    .join("");
  const mei = `<?xml version="1.0" encoding="UTF-8"?><mei xmlns="http://www.music-encoding.org/ns/mei" meiversion="5.1"><meiHead><fileDesc><titleStmt><title>${escapeXml(extraction.title)}</title></titleStmt><pubStmt><p>Provisional source-linked transcription; not accepted.</p></pubStmt></fileDesc></meiHead><facsimile><surface xml:id="source-page-${extraction.sourcePage}" n="${extraction.sourcePage}">${zones.join("")}</surface></facsimile><music><body><mdiv xml:id="devisee-page9-mdiv"><score xml:id="devisee-page9-score"><scoreDef meter.count="${extraction.meter.count}" meter.unit="${extraction.meter.unit}"><staffGrp><staffDef n="1" lines="5" notationtype="tab.lute.french"><label>Guitare</label><tuning>${tuning}</tuning></staffDef></staffGrp></scoreDef><section xml:id="devisee-page9-section">${pickup}${measures.join("")}</section></score></mdiv></body></music></mei>`;
  return { mei, tokens };
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
