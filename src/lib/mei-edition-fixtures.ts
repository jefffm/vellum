export const MEI_EDITION_PROOF_ID = "edition.visee-proof.1" as const;
export const MEI_EDITION_PROOF_VERSION = 1 as const;

export const FRENCH_TAB_MEI_FIXTURE = String.raw`<?xml version="1.0" encoding="UTF-8"?>
<mei xmlns="http://www.music-encoding.org/ns/mei" meiversion="5.1">
  <meiHead><fileDesc><titleStmt><title>Vellum French tablature proof</title></titleStmt><pubStmt/></fileDesc></meiHead>
  <music><facsimile><surface xml:id="source-page-9" n="9">
    <zone xml:id="zone-rhythm-1" ulx="500" uly="1000" lrx="900" lry="1800"/>
    <zone xml:id="zone-note-1" ulx="1300" uly="1000" lrx="1700" lry="1800"/>
    <zone xml:id="zone-note-2" ulx="2100" uly="1000" lrx="2500" lry="1800"/>
    <zone xml:id="zone-note-3" ulx="2900" uly="1000" lrx="3300" lry="1800"/>
    <zone xml:id="zone-rhythm-2" ulx="3700" uly="1000" lrx="4100" lry="1800"/>
    <zone xml:id="zone-note-4" ulx="4500" uly="1000" lrx="4900" lry="1800"/>
    <zone xml:id="zone-rhythm-3" ulx="5300" uly="1000" lrx="5700" lry="1800"/>
    <zone xml:id="zone-note-5" ulx="6100" uly="1000" lrx="6500" lry="1800"/>
    <zone xml:id="zone-note-6" ulx="6900" uly="1000" lrx="7300" lry="1800"/>
  </surface></facsimile><body><mdiv><score>
    <scoreDef meter.count="3" meter.unit="4"><staffGrp><staffDef n="1" lines="5" notationtype="tab.lute.french"><label>Five-course guitar</label><tuning>
      <course n="1" pname="e" oct="4"/><course n="2" pname="b" oct="3"/><course n="3" pname="g" oct="3"/><course n="4" pname="d" oct="3"/><course n="5" pname="a" oct="3"/>
    </tuning></staffDef></staffGrp></scoreDef>
    <section><measure n="1" xml:id="measure-1"><staff n="1"><layer n="1">
      <tabGrp dur="4" dots="1" xml:id="event-1"><tabDurSym facs="#zone-rhythm-1" xml:id="rhythm-1"/><note facs="#zone-note-1" tab.course="1" tab.fret="1" xml:id="note-1"/><note facs="#zone-note-2" tab.course="3" tab.fret="0" xml:id="note-2"/><note facs="#zone-note-3" tab.course="5" tab.fret="2" xml:id="note-3"/></tabGrp>
      <tabGrp dur="8" xml:id="event-2"><tabDurSym facs="#zone-rhythm-2" xml:id="rhythm-2"/><note facs="#zone-note-4" tab.course="1" tab.fret="3" xml:id="note-4"/></tabGrp>
      <tabGrp dur="4" xml:id="event-3"><tabDurSym facs="#zone-rhythm-3" xml:id="rhythm-3"/><note facs="#zone-note-5" tab.course="2" tab.fret="1" xml:id="note-5"/><note facs="#zone-note-6" tab.course="4" tab.fret="2" xml:id="note-6"/></tabGrp>
    </layer></staff></measure></section>
  </score></mdiv></body></music>
</mei>`;

export const LUTE_DIAPASON_MEI_FIXTURE = String.raw`<?xml version="1.0" encoding="UTF-8"?>
<mei xmlns="http://www.music-encoding.org/ns/mei" meiversion="5.1">
  <meiHead><fileDesc><titleStmt><title>Vellum diapason proof</title></titleStmt><pubStmt/></fileDesc></meiHead>
  <music><body><mdiv><score>
    <scoreDef meter.count="6" meter.unit="4"><staffGrp><staffDef n="1" lines="6" notationtype="tab.lute.french"><label>Thirteen-course lute</label><tuning>
      <course n="1" pname="f" oct="4"/><course n="2" pname="d" oct="4"/><course n="3" pname="a" oct="3"/><course n="4" pname="f" oct="3"/><course n="5" pname="d" oct="3"/><course n="6" pname="a" oct="2"/><course n="7" pname="g" oct="2"/><course n="8" pname="f" oct="2"/><course n="9" pname="e" oct="2"/><course n="10" pname="d" oct="2"/><course n="11" pname="c" oct="2"/><course n="12" pname="b" oct="1" accid="f"/><course n="13" pname="a" oct="1"/>
    </tuning></staffDef></staffGrp></scoreDef>
    <section><measure n="1" xml:id="lute-measure-1"><staff n="1"><layer n="1">
      <tabGrp dur="4" xml:id="diapason-7"><tabDurSym/><note tab.course="7" tab.fret="0" xml:id="course-7"/></tabGrp>
      <tabGrp dur="4" xml:id="diapason-8"><tabDurSym/><note tab.course="8" tab.fret="0" xml:id="course-8"/></tabGrp>
      <tabGrp dur="4" xml:id="diapason-9"><tabDurSym/><note tab.course="9" tab.fret="0" xml:id="course-9"/></tabGrp>
      <tabGrp dur="4" xml:id="diapason-10"><tabDurSym/><note tab.course="10" tab.fret="0" xml:id="course-10"/></tabGrp>
      <tabGrp dur="4" xml:id="diapason-11"><tabDurSym/><note tab.course="11" tab.fret="0" xml:id="course-11"/></tabGrp>
      <tabGrp dur="4" xml:id="diapason-12"><tabDurSym/><note tab.course="12" tab.fret="0" xml:id="course-12"/></tabGrp>
    </layer></staff></measure></section>
  </score></mdiv></body></music>
</mei>`;

export const EXPECTED_DIAPASON_LABELS = Object.freeze({
  "course-7": "a",
  "course-8": "/a",
  "course-9": "//a",
  "course-10": "///a",
  "course-11": "4",
  "course-12": "5",
});

export function diapasonLabels(course13Label: string): Readonly<Record<string, string>> {
  if (!/^(?:\/+a|\d+)$/.test(course13Label)) {
    throw new Error("Course 13 label must be a French diapason slash-letter or ordinal sign");
  }
  return Object.freeze({ ...EXPECTED_DIAPASON_LABELS, "course-13": course13Label });
}
