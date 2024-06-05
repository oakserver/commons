// Copyright 2018-2024 the oak authors. All rights reserved. MIT license.

/**
 * The ability to parse a request body into {@linkcode FormData} when not
 * supported natively by the runtime.
 *
 * @example
 *
 * ```ts
 * import { parse } from "jsr:@oak/commons/form_data";
 *
 * const body = new Blob([someFormData]).stream();
 * const contentType = "multipart/form-data; boundary=SOME_BOUNDARY";
 *
 * const formData = await parse(contentType, body);
 * ```
 *
 * @module
 */

import { concat } from "jsr:/@std/bytes@0.224/concat";
import { timingSafeEqual } from "jsr:@std/crypto@0.224/timing-safe-equal";

import { toParamRegExp, unquote } from "./header_utils.ts";
import { createHttpError } from "./http_errors.ts";
import { getFilename } from "./content_disposition.ts";
import { Status } from "./status.ts";

type Part = [
  key: string,
  value: string | Blob,
  fileName: string | undefined,
];

const BOUNDARY_PARAM_RE = toParamRegExp("boundary", "i");
const NAME_PARAM_RE = toParamRegExp("name", "i");

const LF = 0x0a;
const CR = 0x0d;
const COLON = 0x3a;
const HTAB = 0x09;
const SPACE = 0x20;

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function indexOfCRLF(u8: Uint8Array): number {
  let start = 0;
  while (true) {
    const idx = u8.indexOf(CR, start);
    if (idx < 0) {
      return idx;
    }
    if (u8.at(idx + 1) === LF) {
      return idx + 1;
    }
    start = idx + 1;
  }
}

/** Returns `u8` with leading white space removed. */
function skipLWSPChar(u8: Uint8Array): Uint8Array {
  const result = new Uint8Array(u8.length);
  let j = 0;
  for (let i = 0; i < u8.length; i++) {
    if (u8[i] === SPACE || u8[i] === HTAB) continue;
    result[j++] = u8[i];
  }
  return result.slice(0, j);
}

function stripEol(value: Uint8Array): Uint8Array {
  if (value[value.byteLength - 1] == LF) {
    let drop = 1;
    if (value.byteLength > 1 && value[value.byteLength - 2] === CR) {
      drop = 2;
    }
    return value.subarray(0, value.byteLength - drop);
  }
  return value;
}

function isEqual(a: Uint8Array, b: Uint8Array): boolean {
  return timingSafeEqual(skipLWSPChar(a), b);
}

class MultipartStream extends TransformStream<Uint8Array, Part> {
  #buffer = new Uint8Array(0);
  #boundaryFinal: Uint8Array;
  #boundaryPart: Uint8Array;
  #current?: { headers?: Headers };
  #finalized = false;
  #pos = 0;

  constructor(contentType: string) {
    const matches = contentType.match(BOUNDARY_PARAM_RE);
    if (!matches) {
      throw createHttpError(
        Status.BadRequest,
        `Content type "${contentType}" does not contain a valid boundary.`,
      );
    }
    super({
      transform: (chunk, controller) => {
        this.#transform(chunk, controller);
      },
      flush: (controller) => {
        if (!this.#finalized) {
          controller.error(
            createHttpError(
              Status.BadRequest,
              `Body terminated without being finalized.`,
            ),
          );
        }
      },
    });

    let [, boundary] = matches;
    boundary = unquote(boundary);
    this.#boundaryPart = encoder.encode(`--${boundary}`);
    this.#boundaryFinal = encoder.encode(`--${boundary}--`);
  }

  #readLine(strip = true): Uint8Array | null {
    let slice: Uint8Array | null = null;

    const i = indexOfCRLF(this.#buffer.subarray(this.#pos));
    if (i >= 0) {
      slice = this.#buffer.subarray(this.#pos, this.#pos + i + 1);
      this.#pos += i + 1;
      if (slice.byteLength && strip) {
        return stripEol(slice);
      }
      return slice;
    }
    return null;
  }

  #readHeaders(): Headers | null {
    const currentPos = this.#pos;
    const headers = new Headers();
    let line = this.#readLine();
    while (line) {
      let i = line.indexOf(COLON);
      if (i < 0) {
        return headers;
      }
      const key = decoder.decode(line.subarray(0, i)).trim();
      i++;
      while (i < line.byteLength && (line[i] === SPACE || line[i] === HTAB)) {
        i++;
      }
      const value = decoder.decode(line.subarray(i)).trim();
      headers.set(key, encodeURIComponent(value));
      line = this.#readLine();
    }
    // if we have a partial part that breaks across chunks, we won't have the
    // right read position and so need to reset the pos and return a `null`.
    this.#pos = currentPos;
    return null;
  }

  *#readParts(): IterableIterator<Part | null> {
    while (true) {
      const headers = this.#current?.headers ?? this.#readHeaders();
      if (!headers) {
        break;
      }
      const contentDisposition = decodeURIComponent(
        headers.get("content-disposition") ?? "",
      );
      if (!contentDisposition) {
        throw createHttpError(
          Status.BadRequest,
          'Form data part missing "content-disposition" header.',
        );
      }
      if (!contentDisposition.match(/^form-data;/i)) {
        throw createHttpError(
          Status.BadRequest,
          `Invalid "content-disposition" header: "${contentDisposition}"`,
        );
      }
      const matches = NAME_PARAM_RE.exec(contentDisposition);
      if (!matches) {
        throw createHttpError(
          Status.BadRequest,
          "Unable to determine name of form body part.",
        );
      }
      this.#current = { headers };
      let [, key] = matches;
      key = unquote(key);
      const rawContentType = headers.get("content-type");
      if (rawContentType) {
        const contentType = decodeURIComponent(rawContentType);
        const fileName = getFilename(contentDisposition);
        const arrays: Uint8Array[] = [];
        const pos = this.#pos;
        while (true) {
          const line = this.#readLine(false);
          if (!line) {
            // abnormal termination of part, therefore we will reset pos and
            // return
            this.#pos = pos;
            return null;
          }
          const stripped = stripEol(line);
          if (
            isEqual(stripped, this.#boundaryPart) ||
            isEqual(stripped, this.#boundaryFinal)
          ) {
            this.#current = {};
            arrays[arrays.length - 1] = stripEol(arrays[arrays.length - 1]);
            yield [key, new Blob(arrays, { type: contentType }), fileName];
            this.#truncate();
            if (isEqual(stripped, this.#boundaryFinal)) {
              this.#finalized = true;
              return null;
            }
            break;
          }
          arrays.push(line);
        }
      } else {
        const lines: string[] = [];
        const pos = this.#pos;
        while (true) {
          const line = this.#readLine();
          if (!line) {
            this.#pos = pos;
            return null;
          }
          if (
            isEqual(line, this.#boundaryPart) ||
            isEqual(line, this.#boundaryFinal)
          ) {
            this.#current = {};
            yield [key, lines.join("\n"), undefined];
            this.#truncate();
            if (isEqual(line, this.#boundaryFinal)) {
              this.#finalized = true;
              return null;
            }
            break;
          }
          lines.push(decoder.decode(line));
        }
      }
    }
    return null;
  }

  #readToBoundary(): "part" | "final" | null {
    let line: Uint8Array | null;
    while ((line = this.#readLine())) {
      if (isEqual(line, this.#boundaryPart)) {
        return "part";
      }
      if (isEqual(line, this.#boundaryFinal)) {
        return "final";
      }
    }
    return null;
  }

  #transform(
    chunk: Uint8Array,
    controller: TransformStreamDefaultController<Part>,
  ) {
    this.#buffer = concat([this.#buffer, chunk]);
    if (!this.#current) {
      const boundary = this.#readToBoundary();
      if (!boundary) {
        return;
      }
      if (boundary === "final") {
        this.#finalized = true;
        controller.terminate();
        return;
      }
    }
    try {
      for (const part of this.#readParts()) {
        if (!part) {
          break;
        }
        controller.enqueue(part);
      }
      if (this.#finalized) {
        controller.terminate();
      }
    } catch (err) {
      controller.error(err);
    }
  }

  #truncate() {
    this.#buffer = this.#buffer.slice(this.#pos);
    this.#pos = 0;
  }
}

/**
 * Take a content type and the body of a request and parse it as
 * {@linkcode FormData}.
 *
 * This is used can be used in run-times where there isn't native support for
 * this feature.
 */
export async function parse(
  contentType: string,
  body: ReadableStream<Uint8Array>,
): Promise<FormData> {
  const formData = new FormData();
  if (body) {
    const stream = body
      .pipeThrough(new MultipartStream(contentType));
    for await (const [key, value, fileName] of stream) {
      if (fileName) {
        formData.append(key, value, fileName);
      } else {
        formData.append(key, value);
      }
    }
  }
  return formData;
}
