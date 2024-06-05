/**
 * A module which provides capabilities to deal with handling HTTP
 * [range requests](https://developer.mozilla.org/en-US/docs/Web/HTTP/Range_requests).
 *
 * The {@linkcode range} function can be used to determine if a range can be
 * satisfied for a requested resource. The {@linkcode responseRange} can be used
 * to fulfill range requests.
 *
 * The module provides specific support for {@linkcode Deno.FsFile} to provide
 * an efficient way of send the response to the range request without having to
 * read the whole file into memory by using the `.seek()` API.
 *
 * There are also some lower level constructs which can be used for advanced
 * use cases.
 *
 *   - {@linkcode MultiPartByteRangesStream} is a readable stream which
 *     generates a body that converts the source to a multipart byte range
 *     document.
 *   - {@linkcode RangeByteTransformStream} is a transform stream which will
 *     only stream the bytes indicated by the range.
 *   - {@linkcode contentRange} sets the headers that are appropriate when
 *     sending a range content response.
 *   - {@linkcode multiPartByteRanges} sets the headers that are appropriate
 *     when sending a multi part byte range content response.
 *   - {@linkcode asLimitedReadableStream} leverages the `.seek()` APIs with a
 *     {@linkcode Deno.FsFile} to provide a more performant and memory efficient
 *     way to stream just a range of bytes form a file.
 *
 * @example A simple static webserver supporting range requests
 *
 * ```ts
 * import { range, responseRange } from "jsr:@oak/commons/range";
 * import { typeByExtension } from "jsr:@std/media-types/type-by-extension";
 * import { extname } from "jsr:@std/path/extname";
 *
 * Deno.serve(async (req) => {
 *   const url = new URL(req.url);
 *   const file = await Deno.open(`./static${url.pathname}`);
 *   const fileInfo = await file.stat();
 *   const headers = { "accept-ranges": "bytes", "content-type": type };
 *   if (req.method === "HEAD") {
 *     return new Response(null, {
 *       headers: {
 *         ...headers,
 *         "content-length": String(fileInfo.size),
 *       },
 *     });
 *   }
 *   if (req.method === "GET") {
 *     const result = await range(req, fileInfo);
 *     if (result.ok) {
 *       if (result.ranges) {
 *         return responseRange(file, fileInfo.size, result.ranges, {
 *           headers,
 *         }, { type });
 *       } else {
 *         return new Response(file.readable, {
 *           headers: {
 *             ...headers,
 *             "content-length": String(fileInfo.size),
 *           },
 *         });
 *       }
 *     } else {
 *       return new Response(null, {
 *         status: 416,
 *         statusText: "Range Not Satisfiable",
 *         headers,
 *       });
 *     }
 *   }
 *   return new Response(null, { status: 405, statusText: "Method Not Allowed" });
 * });
 * ```
 *
 * @module
 */

import { assert } from "jsr:/@std/assert@0.226/assert";
import { concat } from "jsr:/@std/bytes@0.224/concat";
import {
  calculate,
  type Entity,
  type FileInfo,
} from "jsr:/@std/http@0.224/etag";

/**
 * A descriptor for the start and end of a byte range, which are inclusive of
 * the bytes.
 */
export interface ByteRange {
  /** The start byte of the range. The number is zero indexed. */
  start: number;
  /** The last byte to be included in the range. The number is zero indexed. */
  end: number;
}

/**
 * Options which can be used when creating a
 * {@linkcode MultiPartByteRangesStream}.
 */
interface MultiPartByteRangeStreamOptions {
  /**
   * If the source is a {@linkcode Deno.FsFile}, close the file once the ranges
   * have been read from the file. This defaults to `true`.
   */
  autoClose?: boolean;
  /**
   * The boundary that should be used when creating parts of the response. A
   * default one is used if none is supplied.
   */
  boundary?: string;
  /**
   * A content type to be used with the parts of the response. If one is not
   * supplied and the source is a {@linkcode Blob}, the blob's `.type` will be
   * used, otherwise `"application/octet-stream"`.
   */
  type?: string;
}

/**
 * Like {@linkcode BodyInit} but only accepts the bodies which can be provided
 * as ranges as well as adds {@linkcode Deno.FsFile}.
 */
export type RangeBodyInit =
  | Blob
  | BufferSource
  | ReadableStream<Uint8Array>
  | string
  | Deno.FsFile;

/**
 * The results object when calling {@linkcode range}.
 */
export type RangeResult = {
  ok: true;
  ranges: ByteRange[] | null;
} | {
  ok: false;
  ranges: null;
};

/**
 * Options which can be set with {@linkcode responseRange} or
 * {@linkcode asLimitedReadableStream}.
 */
export interface ResponseRangeOptions {
  /**
   * Once the stream or body is finished being read, close the source
   * {@linkcode Deno.FsFile}.
   *
   * @default true
   */
  autoClose?: boolean;
  /**
   * When handling multiple ranges and sending a multiple response, override
   * the default boundary.
   */
  boundary?: string;
  /**
   * The size of which chunks are attempted to be read. This defaults to 512k.
   * The value is specified in number of bytes.
   */
  chunkSize?: number;
  /**
   * Provide a content type for the response. This will override any automatic
   * determination of the type.
   */
  type?: string;
}

const DEFAULT_CHUNK_SIZE = 524_288;
const ETAG_RE = /(?:W\/)?"[ !#-\x7E\x80-\xFF]+"/;
const encoder = new TextEncoder();

function isDenoFsFile(value: unknown): value is Deno.FsFile {
  if (!value || value === null || !("Deno" in globalThis) || !Deno.FsFile) {
    return false;
  }
  return value instanceof Deno.FsFile;
}

function isFileInfo(value: unknown): value is FileInfo {
  return !!(typeof value === "object" && value && "mtime" in value);
}

function isModified(value: string, mtime: Date): boolean {
  const a = new Date(value).getTime();
  let b = mtime.getTime();
  // adjust to the precision of HTTP UTC time
  b -= b % 1000;
  return a < b;
}

async function readRange(
  file: Deno.FsFile,
  { start, end }: ByteRange,
): Promise<Uint8Array> {
  const parts: Uint8Array[] = [];
  let read = 0;
  const length = end - start + 1;
  const pos = await file.seek(start, Deno.SeekMode.Start);
  if (pos !== start) {
    throw new RangeError("Could not seek to range start.");
  }
  while (read < length) {
    const chunk = new Uint8Array(length - read);
    const count = await file.read(chunk);
    if (count === null) {
      throw new RangeError("Could not read to range end.");
    }
    parts.push(chunk);
    read += count;
  }
  return parts.length > 1 ? concat(parts) : parts[0];
}

/**
 * A readable stream that will stream a body formatted as a
 * `multipart/byteranges` document. The `source` needs to be a
 * {@linkcode Deno.FsFile}, {@linkcode ReadableStream}, {@linkcode Blob},
 * {@linkcode BufferSource}, or a `string`.
 */
export class MultiPartByteRangesStream extends ReadableStream<Uint8Array> {
  #boundary: string;
  #contentLength: number;
  #postscript: Uint8Array;
  #previous: Uint8Array | undefined;
  #ranges: ByteRange[];
  #seen = 0;
  #source:
    | ArrayBuffer
    | Blob
    | ReadableStreamDefaultReader<Uint8Array>
    | Deno.FsFile;
  #type: string;

  /**
   * The boundary being used when segmenting different parts of the body
   * response. This should be reflected in the `Content-Type` header when
   * being sent to a client.
   */
  get boundary(): string {
    return this.#boundary;
  }

  /**
   * The length of the content being supplied by the stream. This should be
   * reflected in the `Content-Length` header when being sent to a client.
   */
  get contentLength(): number {
    return this.#contentLength;
  }

  async #readRange({ start, end }: ByteRange): Promise<Uint8Array> {
    if (isDenoFsFile(this.#source)) {
      return readRange(this.#source, { start, end });
    }
    if (this.#source instanceof Blob) {
      return new Uint8Array(
        await this.#source.slice(start, end + 1).arrayBuffer(),
      );
    }
    if (this.#source instanceof ArrayBuffer) {
      return new Uint8Array(this.#source.slice(start, end + 1));
    }

    const length = end - start;
    let read = 0;
    let result: Uint8Array | undefined;

    const processChunk = (chunk: Uint8Array): Uint8Array | undefined => {
      if (this.#seen + chunk.byteLength >= start) {
        if (this.#seen < start) {
          chunk = chunk.slice(start - this.#seen);
          this.#seen = start;
        }
        if (read + chunk.byteLength > length + 1) {
          this.#previous = chunk.slice(length - read + 1);
          chunk = chunk.slice(0, length - read + 1);
        }
        read += chunk.byteLength;
        this.#seen += chunk.byteLength;
        return chunk;
      }
      this.#seen += chunk.byteLength;
    };

    if (this.#previous) {
      const chunk = this.#previous;
      this.#previous = undefined;
      const res = processChunk(chunk);
      if (res) {
        result = res;
      }
    }

    while (read < length) {
      const { done, value: chunk } = await this.#source.read();
      if (chunk) {
        const res = processChunk(chunk);
        if (res) {
          result = result ? concat([result, res]) : res;
        }
      }
      if (done) {
        throw new RangeError("Unable to read range.");
      }
    }
    assert(result);
    return result;
  }

  constructor(
    source: RangeBodyInit,
    ranges: ByteRange[],
    size: number,
    options: MultiPartByteRangeStreamOptions = {},
  ) {
    const {
      autoClose = true,
      boundary = "OAK-COMMONS-BOUNDARY",
      type,
    } = options;
    super({
      pull: async (controller) => {
        const range = this.#ranges.shift();
        if (!range) {
          controller.enqueue(this.#postscript);
          controller.close();
          if (autoClose && isDenoFsFile(this.#source)) {
            this.#source.close();
          }
          if (this.#source instanceof ReadableStreamDefaultReader) {
            this.#source.releaseLock();
          }
          return;
        }
        const bytes = await this.#readRange(range);
        const preamble = encoder.encode(
          `\r\n--${boundary}\r\nContent-Type: ${this.#type}\r\nContent-Range: ${range.start}-${range.end}/${size}\r\n\r\n`,
        );
        controller.enqueue(concat([preamble, bytes]));
      },
    });
    this.#boundary = boundary;
    this.#ranges = [...ranges];
    this.#ranges.sort(({ start: a }, { start: b }) => a - b);
    if (ArrayBuffer.isView(source)) {
      this.#source = source.buffer;
    } else if (typeof source === "string") {
      this.#source = encoder.encode(source).buffer;
    } else if (source instanceof ReadableStream) {
      this.#source = source.getReader();
    } else {
      this.#source = source;
    }
    this.#type = type || (source instanceof Blob && source.type) ||
      "application/octet-stream";
    this.#postscript = encoder.encode(`\r\n--${boundary}--\r\n`);
    this.#contentLength = ranges.reduce(
      (prev, { start, end }): number =>
        prev +
        encoder.encode(
          `\r\n--${boundary}\r\nContent-Type: ${this.#type}\r\nContent-Range: ${start}-${end}/${size}\r\n\r\n`,
        ).byteLength + (end - start) + 1,
      this.#postscript.byteLength,
    );
  }
}

/**
 * A {@linkcode TransformStream} which will only provide the range of bytes from
 * the source stream.
 */
export class RangeByteTransformStream
  extends TransformStream<Uint8Array, Uint8Array> {
  constructor(range: ByteRange) {
    const { start, end } = range;
    const length = end - start;
    let seen = 0;
    let read = 0;
    super({
      transform(chunk, controller) {
        if (seen + chunk.byteLength >= start) {
          if (seen < start) {
            // start is part way through chunk
            chunk = chunk.slice(start - seen);
            seen = start;
          }
          if (read + chunk.byteLength > length + 1) {
            // chunk extends past end
            chunk = chunk.slice(0, length - read + 1);
          }
          read += chunk.byteLength;
          seen += chunk.byteLength;
          controller.enqueue(chunk);
          if (read >= length) {
            controller.terminate();
          }
        } else {
          // skip chunk
          seen += chunk.byteLength;
        }
      },
    });
  }
}

/**
 * Set {@linkcode Headers} related to returning a content range to the client.
 *
 * This will set the `Accept-Ranges`, `Content-Range` and `Content-Length` as
 * appropriate. If the headers does not contain a `Content-Type` header, and one
 * is supplied, it will be added.
 */
export function contentRange(
  headers: Headers,
  range: ByteRange,
  size: number,
  type?: string,
): void {
  const { start, end } = range;
  headers.set("accept-ranges", "bytes");
  headers.set("content-range", `bytes ${start}-${end}/${size}`);
  headers.set("content-length", String(end - start + 1));
  if (type && !headers.has("content-type")) {
    headers.set("content-type", type);
  }
}

/**
 * Set {@linkcode Headers} related to returning a multipart byte range response.
 *
 * This will set the `Content-Type` and `Content-Length` headers as appropriate.
 */
export function multiPartByteRanges(
  headers: Headers,
  init: { contentLength: number; boundary: string },
) {
  const { contentLength, boundary } = init;
  headers.set("content-type", `multipart/byteranges; boundary=${boundary}`);
  headers.set("content-length", String(contentLength));
}

/**
 * Converts a {@linkcode DenoFile} and a {@linkcode ByteRange} into a byte
 * {@linkcode ReadableStream} which will provide just the range of bytes.
 *
 * When the stream is finished being ready, the file will be closed. Changing
 * the option to `autoClose` to `false` will disable this behavior.
 */
export function asLimitedReadableStream(
  fsFile: Deno.FsFile,
  range: ByteRange,
  options: ResponseRangeOptions = {},
): ReadableStream<Uint8Array> {
  const { start, end } = range;
  const { autoClose = true, chunkSize = DEFAULT_CHUNK_SIZE } = options;
  let read = 0;
  const length = end - start + 1;
  return new ReadableStream({
    start(controller) {
      const pos = fsFile.seekSync(start, Deno.SeekMode.Start);
      if (pos !== start) {
        controller.error(new RangeError("Could not seek to range start."));
      }
    },
    async pull(controller) {
      const chunk = new Uint8Array(Math.min(length - read, chunkSize));
      const count = await fsFile.read(chunk);
      if (count == null) {
        controller.error(new RangeError("Could not read to range end."));
        return;
      }
      controller.enqueue(chunk);
      read += count;
      if (read >= length) {
        controller.close();
        if (autoClose) {
          fsFile.close();
        }
      }
    },
    autoAllocateChunkSize: chunkSize,
    type: "bytes",
  });
}

/**
 * Determine if a requested byte range can be fulfilled. Both the `Range` and
 * `If-Range` header will be inspected if present to determine if the request
 * can be fulfilled.
 *
 * The `request` is the current {@linkcode Request}, the `entity` is the
 * resource being requested. If {@linkcode FileInfo} is being used for the
 * entity, no further information needs to be provided, but if the entity is a
 * `string` or {@linkcode Uint8Array}, the `fileInfo` argument also needs to
 * be provided.
 *
 * Three different scenarios can result:
 *
 * | Result | Typical Response |
 * | - | - |
 * | Ok and byte ranges supplied | The range request can be fulfilled. The response should be a `206 Partial Content` and provide the requested bytes. |
 * | Ok and ranges are `null` | A range was requested, but the request is out of date. The response should be a `200 Ok` and the full entity be provided. |
 * | Not ok | A range was requested, but cannot be fulfilled. The response should be a `416 Range Not Satisfiable` and no content should be provided. |
 *
 * @example
 *
 * ```ts
 * import { range } from "jsr:/@oak/commons/range";
 *
 * const req = new Request(
 *   "https://localhost:8080/movie.mp4",
 *   { headers: { "Range": "bytes=0-499" } }
 * );
 * const res = range(req, { size: 5000, mtime: null });
 * if (res.ok && res.range) {
 *   // respond with 206 Partial Content
 * } else if (res.ok) {
 *   // response with 200 OK
 * } else {
 *   // respond with 416 Range Not Satisfiable
 * }
 * ```
 */
export async function range(
  request: Request,
  entity: FileInfo,
): Promise<RangeResult>;
/**
 * Determine if a requested byte range can be fulfilled. Both the `Range` and
 * `If-Range` header will be inspected if present to determine if the request
 * can be fulfilled.
 *
 * The `request` is the current {@linkcode Request}, the `entity` is the
 * resource being requested. If {@linkcode FileInfo} is being used for the
 * entity, no further information needs to be provided, but if the entity is a
 * `string` or {@linkcode Uint8Array}, the `fileInfo` argument also needs to
 * be provided.
 *
 * Three different scenarios can result:
 *
 * | Result | Typical Response |
 * | - | - |
 * | Ok and byte ranges supplied | The range request can be fulfilled. The response should be a `206 Partial Content` and provide the requested bytes. |
 * | Ok and ranges are `null` | A range was requested, but the request is out of date. The response should be a `200 Ok` and the full entity be provided. |
 * | Not ok | A range was requested, but cannot be fulfilled. The response should be a `416 Range Not Satisfiable` and no content should be provided. |
 *
 * @example
 *
 * ```ts
 * import { range } from "jsr:/@oak/commons/range";
 *
 * const req = new Request(
 *   "https://localhost:8080/movie.mp4",
 *   { headers: { "Range": "bytes=0-499" } }
 * );
 * const res = range(req, { size: 5000, mtime: null });
 * if (res.ok && res.range) {
 *   // respond with 206 Partial Content
 * } else if (res.ok) {
 *   // response with 200 OK
 * } else {
 *   // respond with 416 Range Not Satisfiable
 * }
 * ```
 */
export async function range(
  request: Request,
  entity: string | Uint8Array,
  fileInfo: FileInfo,
): Promise<RangeResult>;
export async function range(
  request: Request,
  entity: Entity,
  fileInfo?: FileInfo,
): Promise<RangeResult> {
  const ifRange = request.headers.get("if-range");
  if (ifRange) {
    const matches = ETAG_RE.exec(ifRange);
    if (matches) {
      const [match] = matches;
      // this indicates that it would be a weak tag, and we cannot compare on
      // weak tags, the full entity should be returned
      if (!fileInfo || match.startsWith("W")) {
        return { ok: true, ranges: null };
      }
      if (match !== await calculate(entity)) {
        return { ok: true, ranges: null };
      }
    } else {
      assert(fileInfo || isFileInfo(entity));
      const { mtime } = fileInfo ?? (entity as FileInfo);
      if (!mtime || isModified(ifRange, mtime)) {
        return { ok: true, ranges: null };
      }
    }
  }
  const value = request.headers.get("range");
  if (!value) {
    return { ok: true, ranges: null };
  }
  const [unit, rangesStr] = value.split("=");
  if (unit !== "bytes") {
    return { ok: false, ranges: null };
  }
  const ranges: ByteRange[] = [];
  for (const range of rangesStr.split(/\s*,\s+/)) {
    const item = range.split("-");
    if (item.length !== 2) {
      return { ok: false, ranges: null };
    }
    const { size } = fileInfo ?? (entity as FileInfo);
    const [startStr, endStr] = item;
    let start: number;
    let end: number;
    try {
      if (startStr === "") {
        start = size - parseInt(endStr, 10) - 1;
        end = size - 1;
      } else if (endStr === "") {
        start = parseInt(startStr, 10);
        end = size - 1;
      } else {
        start = parseInt(startStr, 10);
        end = parseInt(endStr, 10);
      }
    } catch {
      return { ok: false, ranges: null };
    }
    if (start < 0 || start >= size || end < 0 || end >= size || start > end) {
      return { ok: false, ranges: null };
    }
    ranges.push({ start, end });
  }
  return { ok: true, ranges };
}

/**
 * Resolves with a {@linkcode Response} with a body which is just the range of
 * bytes supplied, along with the appropriate headers which indicate that it is
 * the fulfillment of a range request.
 *
 * The `body` is a {@linkcode Response} {@linkcode BodyInit} with the addition
 * of supporting {@linkcode Deno.FsFile} and does not accept
 * {@linkcode FormData} or {@linkcode URLSearchParams}. When using
 * {@linkcode Deno.FsFile} the seek capabilities in order to read ranges more
 * efficiently.
 *
 * The `size` is the total number of bytes in the resource being responded to.
 * This needs to be provided, because the full size of the resource being
 * requested it may not be easy to determine at the time being requested.
 *
 * @example
 *
 * ```ts
 * import { responseRange } from "jsr:@oak/commons/range";
 *
 * const file = await Deno.open("./movie.mp4");
 * const { size } = await file.stat();
 * const res = responseRange(
 *   file,
 *   size,
 *   { start: 0, end: 1_048_575 },
 *   { headers: { "content-type": "video/mp4" } },
 * );
 * const ab = await res.arrayBuffer();
 * // ab will be the first 1MB of the video file
 * ```
 */
export function responseRange(
  body: RangeBodyInit,
  size: number,
  ranges: ByteRange[],
  init: ResponseInit = {},
  options: ResponseRangeOptions = {},
): Response {
  if (!ranges.length) {
    throw new RangeError("At least one range expected.");
  }
  if (ranges.length === 1) {
    const [range] = ranges;
    let type = options.type ?? "application/octet-stream";
    if (isDenoFsFile(body)) {
      body = asLimitedReadableStream(body, range, options);
    } else if (body instanceof ReadableStream) {
      body = body.pipeThrough(new RangeByteTransformStream(range));
    } else if (body instanceof Blob) {
      type = body.type;
      body = body.slice(range.start, range.end + 1);
    } else if (ArrayBuffer.isView(body)) {
      body = body.buffer.slice(range.start, range.end + 1);
    } else if (body instanceof ArrayBuffer) {
      body = body.slice(range.start, range.end + 1);
    } else if (typeof body === "string") {
      body = encoder.encode(body).slice(range.start, range.end + 1);
    } else {
      throw TypeError("Invalid body type.");
    }
    const res = new Response(body, {
      ...init,
      status: 206,
      statusText: "Partial Content",
    });
    contentRange(res.headers, range, size, type);
    return res;
  }
  const stream = new MultiPartByteRangesStream(body, ranges, size, options);
  const res = new Response(stream, {
    ...init,
    status: 206,
    statusText: "Partial Content",
  });
  multiPartByteRanges(res.headers, stream);
  return res;
}
