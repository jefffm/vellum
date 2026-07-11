export function midiNoteOns(midi: Buffer): number[] {
  const notes: number[] = [];
  let offset = 14;
  while (offset + 8 <= midi.length) {
    const chunk = midi.toString("ascii", offset, offset + 4);
    const length = midi.readUInt32BE(offset + 4);
    offset += 8;
    if (chunk !== "MTrk") {
      offset += length;
      continue;
    }
    const end = offset + length;
    let runningStatus = 0;
    while (offset < end) {
      offset = skipVariableLength(midi, offset);
      let status = midi[offset]!;
      if (status < 0x80) status = runningStatus;
      else {
        offset += 1;
        runningStatus = status;
      }
      if (status === 0xff) {
        offset += 1;
        const metaLengthStart = offset;
        offset = skipVariableLength(midi, offset);
        offset += readVariableLength(midi, metaLengthStart);
      } else if (status === 0xf0 || status === 0xf7) {
        const sysexLengthStart = offset;
        offset = skipVariableLength(midi, offset);
        offset += readVariableLength(midi, sysexLengthStart);
      } else {
        const kind = status & 0xf0;
        const dataLength = kind === 0xc0 || kind === 0xd0 ? 1 : 2;
        const note = midi[offset]!;
        const velocity = dataLength === 2 ? midi[offset + 1]! : 0;
        if (kind === 0x90 && velocity > 0) notes.push(note);
        offset += dataLength;
      }
    }
  }
  return notes;
}

function skipVariableLength(buffer: Buffer, offset: number): number {
  do {
    const byte = buffer[offset++]!;
    if ((byte & 0x80) === 0) return offset;
  } while (offset < buffer.length);
  return offset;
}

function readVariableLength(buffer: Buffer, offset: number): number {
  let value = 0;
  let byte = 0;
  do {
    byte = buffer[offset++]!;
    value = (value << 7) | (byte & 0x7f);
  } while (byte & 0x80);
  return value;
}
