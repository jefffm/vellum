const escapeXml = (value) =>
  String(value).replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;");

export function buildDiplomaticMei(extraction) {
  const zones = [];
  const tokens = [];
  const layoutByMeasure = sourceLayoutByMeasure(extraction);
  const systemStarts = new Set(
    extraction.sourceLayout.systems.slice(1).map(({ measureStart }) => measureStart)
  );
  const measures = extraction.measures.map((events, measureIndex) => {
    const measureNumber = measureIndex + 1;
    const layout = layoutByMeasure.get(measureNumber);
    if (!layout) throw new Error(`Source layout is missing measure ${measureNumber}`);
    const [measureLeft, measureRight] = layout.measureBounds;
    const measureId = `measure-${measureIndex + 1}`;
    const barlineRegion = {
      page: extraction.sourcePage,
      x: measureRight - 0.004,
      y: layout.staffTop,
      width: 0.008,
      height: layout.staffBottom - layout.staffTop,
    };
    zones.push(zone(measureId, barlineRegion));
    tokens.push(token(measureId, "barline", barlineRegion, 0.95));
    const groups = events.map((event, eventIndex) => {
      const slotWidth = (measureRight - measureLeft) / events.length;
      const x = Math.max(0, measureLeft + (eventIndex - 0.15) * slotWidth);
      const width = Math.min(1 - x, slotWidth * 1.3);
      const rhythmId = `m${measureIndex + 1}-rhythm-${eventIndex + 1}`;
      const rhythmRegion = {
        page: extraction.sourcePage,
        x,
        y: layout.rhythmTop,
        width,
        height: layout.staffTop - layout.rhythmTop + 0.008,
      };
      zones.push(zone(rhythmId, rhythmRegion));
      tokens.push(token(rhythmId, "rhythm", rhythmRegion, event.confidence));
      const notes = event.notes.map(([course, fret], noteIndex) => {
        const id = `m${measureIndex + 1}-e${eventIndex + 1}-n${noteIndex + 1}`;
        const courseGap = (layout.staffBottom - layout.staffTop) / 4;
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
      return `<tabGrp xml:id="m${measureIndex + 1}-event-${eventIndex + 1}" dur="${event.dur}"${event.dots ? ` dots="${event.dots}"` : ""}><tabDurSym xml:id="${rhythmId}" facs="#zone-${rhythmId}"/>${notes.join("")}</tabGrp>`;
    });
    return `${systemStarts.has(measureNumber) ? "<sb/>" : ""}<measure xml:id="${measureId}" facs="#zone-${measureId}" n="${measureIndex + 1}"${measureIndex === extraction.measures.length - 1 ? ' right="rptend"' : ""}><staff n="1"><layer n="1">${groups.join("")}</layer></staff></measure>`;
  });
  const tuning = extraction.tuning
    .map((course) => `<course n="${course.course}" pname="${course.pname}" oct="${course.oct}"/>`)
    .join("");
  const mei = `<?xml version="1.0" encoding="UTF-8"?><mei xmlns="http://www.music-encoding.org/ns/mei" meiversion="5.1"><meiHead><fileDesc><titleStmt><title>${escapeXml(extraction.title)}</title></titleStmt><pubStmt><p>Provisional source-linked transcription; not accepted.</p></pubStmt></fileDesc></meiHead><facsimile><surface xml:id="source-page-${extraction.sourcePage}" n="${extraction.sourcePage}">${zones.join("")}</surface></facsimile><music><body><mdiv xml:id="devisee-page9-mdiv"><score xml:id="devisee-page9-score"><scoreDef meter.count="${extraction.meter.count}" meter.unit="${extraction.meter.unit}"><staffGrp><staffDef n="1" lines="5" notationtype="tab.lute.french"><label>Guitare</label><tuning>${tuning}</tuning></staffDef></staffGrp></scoreDef><section xml:id="devisee-page9-section">${measures.join("")}</section></score></mdiv></body></music></mei>`;
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
