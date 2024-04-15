/**
 * Benchmark tests for measuring the performance of range requests on
 * `Deno.FsFile`. It appears the limited readable stream which implements the
 * `.seek()` API outperforms or matches performance of a byte range transform
 * stream.
 */

import { asLimitedReadableStream, RangeByteTransformStream } from "./range.ts";

const RANGE_BIG = {
  start: 0,
  end: 1_000_000,
};

const RANGE_DEEP = {
  start: 860_000,
  end: 1_000_000,
};

const RANGE_SMALL = {
  start: 64_000,
  end: 64_999,
};

Deno.bench({
  name: "asLimitedReadableStream - big range",
  async fn() {
    const file = await Deno.open("./_fixtures/png-1mb.png");
    const stream = asLimitedReadableStream(file, RANGE_BIG);
    for await (const _chunk of stream) {
      //
    }
  },
});

Deno.bench({
  name: "RangeByteTransformStream - big range",
  async fn() {
    const file = await Deno.open("./_fixtures/png-1mb.png");
    const stream = file.readable.pipeThrough(
      new RangeByteTransformStream(RANGE_BIG),
    );
    for await (const _chunk of stream) {
      //
    }
  },
});

Deno.bench({
  name: "asLimitedReadableStream - deep range",
  async fn() {
    const file = await Deno.open("./_fixtures/png-1mb.png");
    const stream = asLimitedReadableStream(file, RANGE_DEEP);
    for await (const _chunk of stream) {
      //
    }
  },
});

Deno.bench({
  name: "RangeByteTransformStream - deep range",
  async fn() {
    const file = await Deno.open("./_fixtures/png-1mb.png");
    const stream = file.readable.pipeThrough(
      new RangeByteTransformStream(RANGE_DEEP),
    );
    for await (const _chunk of stream) {
      //
    }
  },
});

Deno.bench({
  name: "asLimitedReadableStream - small range",
  async fn() {
    const file = await Deno.open("./_fixtures/png-1mb.png");
    const stream = asLimitedReadableStream(file, RANGE_SMALL);
    for await (const _chunk of stream) {
      //
    }
  },
});

Deno.bench({
  name: "RangeByteTransformStream - small range",
  async fn() {
    const file = await Deno.open("./_fixtures/png-1mb.png");
    const stream = file.readable.pipeThrough(
      new RangeByteTransformStream(RANGE_SMALL),
    );
    for await (const _chunk of stream) {
      //
    }
  },
});
