// Reads timetable files straight out of a GTFS zip, without unpacking it.
//
// The HSL zip holds a 1 GB stop_times.txt, so files are streamed line by line
// through Node's own deflate support. Only plain zip is read: a zip64 archive
// (over 4 GB) throws instead of giving wrong data.
import {open} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {createInflateRaw} from 'node:zlib';
import {createInterface} from 'node:readline';

async function zipEntries(path) {
  const handle = await open(path, 'r');
  try {
    const {size} = await handle.stat();
    const tail = Buffer.alloc(Math.min(size, 65557));
    await handle.read(tail, 0, tail.length, size - tail.length);
    const end = tail.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
    if (end < 0) throw new Error(`${path} is not a zip file`);
    const count = tail.readUInt16LE(end + 10),
      cdSize = tail.readUInt32LE(end + 12),
      cdOffset = tail.readUInt32LE(end + 16);
    if (count === 0xffff || cdOffset === 0xffffffff)
      throw new Error(`${path} is a zip64 archive, which this reader does not support`);
    const cd = Buffer.alloc(cdSize);
    await handle.read(cd, 0, cdSize, cdOffset);
    const entries = new Map();
    for (let p = 0, i = 0; i < count; i++) {
      if (cd.readUInt32LE(p) !== 0x02014b50) throw new Error(`${path}: broken zip directory`);
      const nameLength = cd.readUInt16LE(p + 28);
      const entry = {
        method: cd.readUInt16LE(p + 10),
        compressed: cd.readUInt32LE(p + 20),
        local: cd.readUInt32LE(p + 42),
      };
      entries.set(cd.toString('utf8', p + 46, p + 46 + nameLength), entry);
      p += 46 + nameLength + cd.readUInt16LE(p + 30) + cd.readUInt16LE(p + 32);
    }
    // The data starts after the local header, whose name and extra fields can differ from the directory's copy.
    const header = Buffer.alloc(30);
    for (const entry of entries.values()) {
      await handle.read(header, 0, 30, entry.local);
      entry.start = entry.local + 30 + header.readUInt16LE(26) + header.readUInt16LE(28);
    }
    return entries;
  } finally {
    await handle.close();
  }
}

// One CSV line -> fields. Handles quoted fields with commas and doubled quotes.
export function parseCsvLine(line) {
  const out = [];
  let i = 0;
  while (i <= line.length) {
    if (line[i] === '"') {
      let value = '';
      for (i++; i < line.length; i++) {
        if (line[i] !== '"') value += line[i];
        else if (line[i + 1] === '"') {
          value += '"';
          i++;
        } else break;
      }
      out.push(value);
      i += 2;
    } else {
      const comma = line.indexOf(',', i),
        stop = comma < 0 ? line.length : comma;
      out.push(line.slice(i, stop));
      i = stop + 1;
    }
  }
  return out;
}

export async function openGtfs(path) {
  const entries = await zipEntries(path);
  return {
    // fn(line, column, keys) for every data line; column(name) -> field index, keys = header
    // names. Raw lines let the caller skip parsing rows it does not need (stop_times).
    async each(name, fn) {
      const entry = entries.get(name);
      if (!entry) throw new Error(`${path} has no ${name}`);
      if (entry.method !== 0 && entry.method !== 8)
        throw new Error(`${name}: unsupported zip compression ${entry.method}`);
      const raw = createReadStream(path, {start: entry.start, end: entry.start + entry.compressed - 1});
      const input = entry.method === 8 ? raw.pipe(createInflateRaw()) : raw;
      raw.on('error', error => input.destroy(error));
      let keys = null,
        index;
      const column = key => {
        if (!index.has(key)) throw new Error(`${name} has no column ${key}`);
        return index.get(key);
      };
      for await (const line of createInterface({input, crlfDelay: Infinity})) {
        if (keys === null) {
          keys = parseCsvLine(line.replace(/^﻿/, '')).map(k => k.trim());
          index = new Map(keys.map((k, i) => [k, i]));
          continue;
        }
        if (line) fn(line, column, keys);
      }
      if (keys === null) throw new Error(`${name} is empty`);
    },
    // Whole small file as objects keyed by column name.
    async rows(name) {
      const out = [];
      await this.each(name, (line, column, keys) => {
        const fields = parseCsvLine(line);
        out.push(Object.fromEntries(keys.map((key, i) => [key, fields[i]])));
      });
      return out;
    },
  };
}
