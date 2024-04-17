import { assertThrows } from "./deps_test.ts";
import {
  assert,
  assertEquals,
  calculate,
  timingSafeEqual,
} from "./deps_test.ts";

import {
  MultiPartByteRangesStream,
  range,
  RangeByteTransformStream,
  responseRange,
} from "./range.ts";

const fixture = new Uint8Array(65_000);
const fixtureInfo = {
  size: 65_000,
  mtime: new Date("2015-10-21T07:28:00.755Z"),
};
const fixtureInfoNoMtime = {
  size: 65_000,
  mtime: null,
};
const etag = (await calculate(fixture))!;
const weakEtag = (await calculate(fixtureInfo))!;

Deno.test({
  name: "range - no range - entity + fileInfo",
  async fn() {
    const req = new Request("http://localhost/movie.mp4");
    const res = await range(req, fixture, fixtureInfo);
    assertEquals(res, { ok: true, ranges: null });
  },
});

Deno.test({
  name: "range - no range - fileInfo",
  async fn() {
    const req = new Request("http://localhost/movie.mp4");
    const res = await range(req, fixtureInfo);
    assertEquals(res, { ok: true, ranges: null });
  },
});

Deno.test({
  name: "range - range - entity + fileInfo",
  async fn() {
    const req = new Request("http://localhost/movie.mp4", {
      headers: { "range": "bytes=0-499" },
    });
    const res = await range(req, fixture, fixtureInfo);
    assertEquals(res, { ok: true, ranges: [{ start: 0, end: 499 }] });
  },
});

Deno.test({
  name: "range - range - fileInfo",
  async fn() {
    const req = new Request("http://localhost/movie.mp4", {
      headers: { "range": "bytes=0-499" },
    });
    const res = await range(req, fixtureInfo);
    assertEquals(res, { ok: true, ranges: [{ start: 0, end: 499 }] });
  },
});

Deno.test({
  name: "range - range to end - entity + fileInfo",
  async fn() {
    const req = new Request("http://localhost/movie.mp4", {
      headers: { "range": "bytes=500-" },
    });
    const res = await range(req, fixture, fixtureInfo);
    assertEquals(res, { ok: true, ranges: [{ start: 500, end: 64999 }] });
  },
});

Deno.test({
  name: "range - range to end - fileInfo",
  async fn() {
    const req = new Request("http://localhost/movie.mp4", {
      headers: { "range": "bytes=500-" },
    });
    const res = await range(req, fixtureInfo);
    assertEquals(res, { ok: true, ranges: [{ start: 500, end: 64999 }] });
  },
});

Deno.test({
  name: "range - range last bytes - entity + fileInfo",
  async fn() {
    const req = new Request("http://localhost/movie.mp4", {
      headers: { "range": "bytes=-499" },
    });
    const res = await range(req, fixture, fixtureInfo);
    assertEquals(res, { ok: true, ranges: [{ start: 64500, end: 64999 }] });
  },
});

Deno.test({
  name: "range - range last bytes - fileInfo",
  async fn() {
    const req = new Request("http://localhost/movie.mp4", {
      headers: { "range": "bytes=-499" },
    });
    const res = await range(req, fixtureInfo);
    assertEquals(res, { ok: true, ranges: [{ start: 64500, end: 64999 }] });
  },
});

Deno.test({
  name: "range - range multiple - entity + fileInfo",
  async fn() {
    const req = new Request("http://localhost/movie.mp4", {
      headers: { "range": "bytes=200-999, 2000-2499, 9500-" },
    });
    const res = await range(req, fixture, fixtureInfo);
    assertEquals(res, {
      ok: true,
      ranges: [
        { start: 200, end: 999 },
        { start: 2000, end: 2499 },
        { start: 9500, end: 64999 },
      ],
    });
  },
});

Deno.test({
  name: "range - range multiple - fileInfo",
  async fn() {
    const req = new Request("http://localhost/movie.mp4", {
      headers: { "range": "bytes=200-999, 2000-2499, 9500-" },
    });
    const res = await range(req, fixtureInfo);
    assertEquals(res, {
      ok: true,
      ranges: [
        { start: 200, end: 999 },
        { start: 2000, end: 2499 },
        { start: 9500, end: 64999 },
      ],
    });
  },
});

Deno.test({
  name: "range - range not bytes",
  async fn() {
    const req = new Request("http://localhost/movie.mp4", {
      headers: { "range": "items=0-499" },
    });
    const res = await range(req, fixture, fixtureInfo);
    assertEquals(res, { ok: false, ranges: null });
  },
});

Deno.test({
  name: "range - range beyond end",
  async fn() {
    const req = new Request("http://localhost/movie.mp4", {
      headers: { "range": "bytes=9500-65000" },
    });
    const res = await range(req, fixture, fixtureInfo);
    assertEquals(res, { ok: false, ranges: null });
  },
});

Deno.test({
  name: "range - range illogical range",
  async fn() {
    const req = new Request("http://localhost/movie.mp4", {
      headers: { "range": "bytes=64999-9000" },
    });
    const res = await range(req, fixture, fixtureInfo);
    assertEquals(res, { ok: false, ranges: null });
  },
});

Deno.test({
  name: "range - if-range not modified - entity + fileInfo",
  async fn() {
    const req = new Request("http://localhost/movie.mp4", {
      headers: {
        "if-range": "Wed, 21 Oct 2015 07:28:00 GMT",
        "range": "bytes=0-499",
      },
    });
    const res = await range(req, fixture, fixtureInfo);
    assertEquals(res, { ok: true, ranges: [{ start: 0, end: 499 }] });
  },
});

Deno.test({
  name: "range - if-range not modified - fileInfo",
  async fn() {
    const req = new Request("http://localhost/movie.mp4", {
      headers: {
        "if-range": "Wed, 21 Oct 2015 07:28:00 GMT",
        "range": "bytes=0-499",
      },
    });
    const res = await range(req, fixtureInfo);
    assertEquals(res, { ok: true, ranges: [{ start: 0, end: 499 }] });
  },
});

Deno.test({
  name: "range - if-range modified - entity + fileInfo",
  async fn() {
    const req = new Request("http://localhost/movie.mp4", {
      headers: {
        "if-range": "Wed, 21 Oct 2015 07:27:00 GMT",
        "range": "bytes=0-499",
      },
    });
    const res = await range(req, fixture, fixtureInfo);
    assertEquals(res, { ok: true, ranges: null });
  },
});

Deno.test({
  name: "range - if-range modified - fileInfo",
  async fn() {
    const req = new Request("http://localhost/movie.mp4", {
      headers: {
        "if-range": "Wed, 21 Oct 2015 07:27:00 GMT",
        "range": "bytes=0-499",
      },
    });
    const res = await range(req, fixtureInfo);
    assertEquals(res, { ok: true, ranges: null });
  },
});

Deno.test({
  name: "range - if-range no mtime",
  async fn() {
    const req = new Request("http://localhost/movie.mp4", {
      headers: {
        "if-range": "Wed, 21 Oct 2015 07:28:00 GMT",
        "range": "bytes=0-499",
      },
    });
    const res = await range(req, fixture, fixtureInfoNoMtime);
    assertEquals(res, { ok: true, ranges: null });
  },
});

Deno.test({
  name: "range - if-range etag - entity + fileInfo",
  async fn() {
    const req = new Request("http://localhost/movie.mp4", {
      headers: {
        "if-range": etag,
        "range": "bytes=0-499",
      },
    });
    const res = await range(req, fixture, fixtureInfo);
    assertEquals(res, { ok: true, ranges: [{ start: 0, end: 499 }] });
  },
});

Deno.test({
  name: "range - if-range etag - fileInfo",
  async fn() {
    const req = new Request("http://localhost/movie.mp4", {
      headers: {
        "if-range": etag,
        "range": "bytes=0-499",
      },
    });
    const res = await range(req, fixtureInfo);
    assertEquals(res, { ok: true, ranges: null });
  },
});

Deno.test({
  name: "range - if-range weak etag - entity + fileInfo",
  async fn() {
    const req = new Request("http://localhost/movie.mp4", {
      headers: {
        "if-range": weakEtag,
        "range": "bytes=0-499",
      },
    });
    const res = await range(req, fixture, fixtureInfo);
    assertEquals(res, { ok: true, ranges: null });
  },
});

Deno.test({
  name: "responseRange - from start",
  async fn() {
    const fixture = (await Deno.readFile("./_fixtures/png-1mb.png")).slice(
      0,
      65_000,
    );
    const file = await Deno.open("./_fixtures/png-1mb.png");
    const stats = await file.stat();
    const res = responseRange(
      file,
      stats.size,
      [{ start: 0, end: 64_999 }],
      { headers: { "content-type": "image/png" } },
    );
    const actual = await res.arrayBuffer();
    assert(timingSafeEqual(fixture, actual));
    assertEquals(res.headers.get("content-range"), "bytes 0-64999/1050986");
    assertEquals(res.headers.get("content-length"), "65000");
    assertEquals(res.status, 206);
    assertEquals(res.statusText, "Partial Content");
  },
});

Deno.test({
  name: "responseRange - to end",
  async fn() {
    const fixture = (await Deno.readFile("./_fixtures/png-1mb.png")).slice(
      65_000,
    );
    const file = await Deno.open("./_fixtures/png-1mb.png");
    const stats = await file.stat();
    const res = responseRange(
      file,
      stats.size,
      [{ start: 65_000, end: 1_050_985 }],
      { headers: { "content-type": "image/png" } },
    );
    const actual = await res.arrayBuffer();
    assert(timingSafeEqual(fixture, actual));
    assertEquals(
      res.headers.get("content-range"),
      "bytes 65000-1050985/1050986",
    );
    assertEquals(res.headers.get("content-length"), "985986");
    assertEquals(res.status, 206);
    assertEquals(res.statusText, "Partial Content");
  },
});

Deno.test({
  name: "responseRange - Deno.FsFile - auto close",
  async fn() {
    const file = await Deno.open("./_fixtures/png-1mb.png");
    const stats = await file.stat();
    const res = responseRange(
      file,
      stats.size,
      [{ start: 0, end: 64_999 }],
      { headers: { "content-type": "image/png" } },
    );
    await res.arrayBuffer();
    assertThrows(() => {
      file.close();
    }, "Bad resource ID");
  },
});

Deno.test({
  name: "responseRange - Deno.FsFile - no auto close",
  async fn() {
    const file = await Deno.open("./_fixtures/png-1mb.png");
    const stats = await file.stat();
    const res = responseRange(
      file,
      stats.size,
      [{ start: 0, end: 64_999 }],
      { headers: { "content-type": "image/png" } },
      { autoClose: false },
    );
    await res.arrayBuffer();
    file.close();
  },
});

Deno.test({
  name: "responseRange - stream body",
  async fn() {
    const fixture = (await Deno.readFile("./_fixtures/png-1mb.png")).slice(
      65_000,
    );
    const file = await Deno.open("./_fixtures/png-1mb.png");
    const stats = await file.stat();
    const res = responseRange(
      file.readable,
      stats.size,
      [{ start: 65_000, end: 1_050_985 }],
      { headers: { "content-type": "image/png" } },
    );
    const actual = await res.arrayBuffer();
    assert(timingSafeEqual(fixture, actual));
    assertEquals(
      res.headers.get("content-range"),
      "bytes 65000-1050985/1050986",
    );
    assertEquals(res.headers.get("content-length"), "985986");
    assertEquals(res.status, 206);
    assertEquals(res.statusText, "Partial Content");
  },
});

Deno.test({
  name: "responseRange - blob body",
  async fn() {
    const fixture = (await Deno.readFile("./_fixtures/png-1mb.png")).slice(
      65_000,
    );
    const blob = new Blob([await Deno.readFile("./_fixtures/png-1mb.png")]);
    const res = responseRange(
      blob,
      1_050_986,
      [{ start: 65_000, end: 1_050_985 }],
      { headers: { "content-type": "image/png" } },
    );
    const actual = await res.arrayBuffer();
    assert(timingSafeEqual(fixture, actual));
    assertEquals(
      res.headers.get("content-range"),
      "bytes 65000-1050985/1050986",
    );
    assertEquals(res.headers.get("content-length"), "985986");
    assertEquals(res.status, 206);
    assertEquals(res.statusText, "Partial Content");
  },
});

Deno.test({
  name: "responseRange - multiple ranges",
  async fn() {
    const file = await Deno.open("./_fixtures/png-1mb.png");
    const stats = await file.stat();
    const res = responseRange(
      file,
      stats.size,
      [
        {
          start: 0,
          end: 499,
        },
        { start: 600, end: 600_000 },
        { start: 1_000_000, end: 1_000_199 },
        { start: 1_000_200, end: 1_000_299 },
        { start: 1_001_000, end: 1_050_985 },
      ],
      undefined,
      { type: "image/png" },
    );
    const ab = await res.arrayBuffer();
    assertEquals(res.headers.get("content-length"), String(ab.byteLength));
    assertEquals(
      res.headers.get("content-type"),
      "multipart/byteranges; boundary=OAK-COMMONS-BOUNDARY",
    );
    assertEquals(ab.byteLength, 650665);
    assertEquals(res.status, 206);
    assertEquals(res.statusText, "Partial Content");
    assertThrows(() => {
      file.close();
    }, "Bad resource ID");
  },
});

Deno.test({
  name: "RangeByteTransformStream - from start",
  async fn() {
    const fixture = (await Deno.readFile("./_fixtures/png-1mb.png")).slice(
      0,
      128_000,
    );
    const file = await Deno.open("./_fixtures/png-1mb.png");
    const stream = file.readable.pipeThrough(
      new RangeByteTransformStream({ start: 0, end: 127_999 }),
    );
    const parts: Uint8Array[] = [];
    for await (const chunk of stream) {
      parts.push(chunk);
    }
    const blob = new Blob(parts);
    const actual = await blob.arrayBuffer();
    assert(timingSafeEqual(fixture, actual));
  },
});

Deno.test({
  name: "RangeByteTransformStream - to end",
  async fn() {
    const fixture = (await Deno.readFile("./_fixtures/png-1mb.png")).slice(
      128_000,
    );
    const file = await Deno.open("./_fixtures/png-1mb.png");
    const stream = file.readable.pipeThrough(
      new RangeByteTransformStream({ start: 128_000, end: 1_050_985 }),
    );
    const parts: Uint8Array[] = [];
    for await (const chunk of stream) {
      parts.push(chunk);
    }
    const blob = new Blob(parts);
    const actual = await blob.arrayBuffer();
    assert(timingSafeEqual(fixture, actual));
  },
});

Deno.test({
  name: "RangeByteTransformStream - small range",
  async fn() {
    const fixture = (await Deno.readFile("./_fixtures/png-1mb.png")).slice(
      128_000,
      128_010,
    );
    const file = await Deno.open("./_fixtures/png-1mb.png");
    const stream = file.readable.pipeThrough(
      new RangeByteTransformStream({ start: 128_000, end: 128_009 }),
    );
    const parts: Uint8Array[] = [];
    for await (const chunk of stream) {
      parts.push(chunk);
    }
    const blob = new Blob(parts);
    const actual = await blob.arrayBuffer();
    assert(timingSafeEqual(fixture, actual));
  },
});

Deno.test({
  name: "MultiPartByteRangesStream - source stream",
  async fn() {
    const file = await Deno.open("./_fixtures/png-1mb.png");
    const stat = await file.stat();
    const stream = new MultiPartByteRangesStream(
      file.readable,
      [
        {
          start: 0,
          end: 499,
        },
        { start: 600, end: 600_000 },
        { start: 1_000_000, end: 1_000_199 },
        { start: 1_000_200, end: 1_000_299 },
        { start: 1_001_000, end: 1_050_985 },
      ],
      stat.size,
      { type: "image/png" },
    );
    const res = new Response(stream);
    const ab = await res.arrayBuffer();
    assertEquals(stream.contentLength, ab.byteLength);
    assertEquals(stream.boundary, "OAK-COMMONS-BOUNDARY");
    assertEquals(ab.byteLength, 650665);
    file.close();
  },
});

Deno.test({
  name: "MultiPartByteRangesStream - source FsFile",
  async fn() {
    const file = await Deno.open("./_fixtures/png-1mb.png");
    const stat = await file.stat();
    const stream = new MultiPartByteRangesStream(
      file,
      [
        {
          start: 0,
          end: 499,
        },
        { start: 600, end: 600_000 },
        { start: 1_000_000, end: 1_000_199 },
        { start: 1_000_200, end: 1_000_299 },
        { start: 1_001_000, end: 1_050_985 },
      ],
      stat.size,
      { type: "image/png" },
    );
    const res = new Response(stream);
    const ab = await res.arrayBuffer();
    assertEquals(stream.contentLength, ab.byteLength);
    assertEquals(stream.boundary, "OAK-COMMONS-BOUNDARY");
    assertEquals(ab.byteLength, 650665);
  },
});

Deno.test({
  name: "MultiPartByteRangesStream - source Uint8Array",
  async fn() {
    const fixture = await Deno.readFile("./_fixtures/png-1mb.png");
    const stream = new MultiPartByteRangesStream(
      fixture,
      [
        {
          start: 0,
          end: 499,
        },
        { start: 600, end: 600_000 },
        { start: 1_000_000, end: 1_000_199 },
        { start: 1_000_200, end: 1_000_299 },
        { start: 1_001_000, end: 1_050_985 },
      ],
      fixture.byteLength,
      { type: "image/png" },
    );
    const res = new Response(stream);
    const ab = await res.arrayBuffer();
    assertEquals(stream.contentLength, ab.byteLength);
    assertEquals(stream.boundary, "OAK-COMMONS-BOUNDARY");
    assertEquals(ab.byteLength, 650665);
  },
});

Deno.test({
  name: "MultiPartByteRangesStream - source Blob",
  async fn() {
    const fixture = await Deno.readFile("./_fixtures/png-1mb.png");
    const blob = new Blob([fixture], { type: "image/png" });
    const stream = new MultiPartByteRangesStream(
      blob,
      [
        {
          start: 0,
          end: 499,
        },
        { start: 600, end: 600_000 },
        { start: 1_000_000, end: 1_000_199 },
        { start: 1_000_200, end: 1_000_299 },
        { start: 1_001_000, end: 1_050_985 },
      ],
      blob.size,
    );
    const res = new Response(stream);
    const ab = await res.arrayBuffer();
    assertEquals(stream.contentLength, ab.byteLength);
    assertEquals(stream.boundary, "OAK-COMMONS-BOUNDARY");
    assertEquals(ab.byteLength, 650665);
  },
});

Deno.test({
  name: "MultiPartByteRangesStream - source string",
  async fn() {
    const fixture = "hello world, ".repeat(500_000);
    const stream = new MultiPartByteRangesStream(
      fixture,
      [
        {
          start: 0,
          end: 499,
        },
        { start: 600, end: 600_000 },
        { start: 1_000_000, end: 1_000_199 },
        { start: 1_000_200, end: 1_000_299 },
        { start: 1_001_000, end: 1_050_985 },
      ],
      fixture.length,
      { type: "text/plain" },
    );
    const res = new Response(stream);
    const ab = await res.arrayBuffer();
    assertEquals(stream.contentLength, ab.byteLength);
    assertEquals(stream.boundary, "OAK-COMMONS-BOUNDARY");
    assertEquals(ab.byteLength, 650670);
  },
});

Deno.test({
  name: "MultiPartByteRangesStream - boundary options",
  async fn() {
    const fixture = await Deno.readFile("./_fixtures/png-1mb.png");
    const stream = new MultiPartByteRangesStream(
      fixture,
      [
        {
          start: 0,
          end: 499,
        },
        { start: 600, end: 600_000 },
        { start: 1_000_000, end: 1_000_199 },
        { start: 1_000_200, end: 1_000_299 },
        { start: 1_001_000, end: 1_050_985 },
      ],
      fixture.byteLength,
      { type: "image/png", boundary: "123456789" },
    );
    const res = new Response(stream);
    const ab = await res.arrayBuffer();
    assertEquals(stream.contentLength, ab.byteLength);
    assertEquals(stream.boundary, "123456789");
    assertEquals(ab.byteLength, 650599);
  },
});
