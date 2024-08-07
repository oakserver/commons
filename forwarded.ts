/*!
 * Adapted directly from forwarded-parse at https://github.com/lpinca/forwarded-parse
 * which is licensed as follows:
 *
 * Copyright(c) 2015 Luigi Pinca
 * Copyright(c) 2023 the oak authors
 * MIT Licensed
 */

/**
 * Provides utilities for parsing and validating the `Forwarded` header.
 *
 * @module
 */

import { assert } from "jsr:@std/assert@^1.0/assert";

/**
 * Unescape a string.
 *
 * @param str The string to unescape.
 * @returns A new unescaped string.
 */
function decode(value: string): string {
  return value.replace(/\\(.)/g, "$1");
}

/**
 * Check if a character is a delimiter as defined in section 3.2.6 of RFC 7230.
 *
 * @param code The code of the character to check.
 * @returns `true` if the character is a delimiter, else `false`.
 */
function isDelimiter(code: number): boolean {
  return code === 0x22 || // '"'
    code === 0x28 || // '('
    code === 0x29 || // ')'
    code === 0x2C || // ','
    code === 0x2F || // '/'
    code >= 0x3A && code <= 0x40 || // ':', ';', '<', '=', '>', '?' '@'
    code >= 0x5B && code <= 0x5D || // '[', '\', ']'
    code === 0x7B || // '{'
    code === 0x7D; // '}'
}

/**
 * Check if a character is an extended ASCII character.
 *
 * @param code The code of the character to check.
 * @returns `true` if `code` is in the %x80-FF range, else `false`.
 */
function isExtended(code: number): boolean {
  return code >= 0x80 && code <= 0xFF;
}

/**
 * Check if a character is a printable ASCII character.
 *
 * @param code The code of the character to check.
 * @returns `true` if `code` is in the %x20-7E range, else `false`.
 */
function isPrint(code: number): boolean {
  return code >= 0x20 && code <= 0x7E;
}

/**
 * Check if a character is allowed in a token as defined in section 3.2.6
 * of RFC 7230.
 *
 * @param code The code of the character to check.
 * @returns `true` if the character is allowed, else `false`.
 */
function isTokenChar(code: number): boolean {
  return code === 0x21 || // '!'
    code >= 0x23 && code <= 0x27 || // '#', '$', '%', '&', '''
    code === 0x2A || // '*'
    code === 0x2B || // '+'
    code === 0x2D || // '-'
    code === 0x2E || // '.'
    code >= 0x30 && code <= 0x39 || // 0-9
    code >= 0x41 && code <= 0x5A || // A-Z
    code >= 0x5E && code <= 0x7A || // '^', '_', '`', a-z
    code === 0x7C || // '|'
    code === 0x7E; // '~'
}

/**
 * Parse the `Forwarded` header field value into an array of objects. If the
 * value is not parsable, `undefined` is returned.
 *
 * @param value The header field value.
 */
export function parse(value: string): Record<string, string>[] | undefined {
  let parameter: undefined | string;
  let start = -1;
  let end = -1;
  let isEscaping = false;
  let inQuotes = false;
  let mustUnescape = false;

  let code;
  let forwarded: Record<string, string> = {};
  const output: Record<string, string>[] = [];
  let i;

  for (i = 0; i < value.length; i++) {
    code = value.charCodeAt(i);

    if (parameter === undefined) {
      if (i !== 0 && start === -1 && (code === 0x20 || code === 0x09)) {
        continue;
      }

      if (isTokenChar(code)) {
        if (start === -1) {
          start = i;
        }
      } else if (code === 0x3D && start !== -1) {
        parameter = value.slice(start, i).toLowerCase();
        start = -1;
      } else {
        return undefined;
      }
    } else {
      if (
        isEscaping && (code === 0x09 || isPrint(code) || isExtended(code))
      ) {
        isEscaping = false;
      } else if (isTokenChar(code)) {
        if (end !== -1) {
          return undefined;
        }
        if (start === -1) {
          start = i;
        }
      } else if (isDelimiter(code) || isExtended(code)) {
        if (inQuotes) {
          if (code === 0x22) {
            inQuotes = false;
            end = i;
          } else if (code === 0x5C) {
            if (start === -1) {
              start = i;
            }
            isEscaping = mustUnescape = true;
          } else if (start === -1) {
            start = i;
          }
        } else if (code === 0x22 && value.charCodeAt(i - 1) === 0x3D) {
          inQuotes = true;
        } else if (
          (code === 0x2C || code === 0x3B) && (start !== -1 || end !== -1)
        ) {
          assert(parameter, "Variable 'parameter' not defined.");
          if (start !== -1) {
            if (end === -1) {
              end = i;
            }

            forwarded[parameter] = mustUnescape
              ? decode(value.slice(start, end))
              : value.slice(start, end);
          } else {
            forwarded[parameter] = "";
          }

          if (code === 0x2C) {
            output.push(forwarded);
            forwarded = {};
          }

          parameter = undefined;
          start = end = -1;
        } else {
          return undefined;
        }
      } else if (code === 0x20 || code === 0x09) {
        if (end !== -1) {
          continue;
        }

        if (inQuotes) {
          if (start === -1) {
            start = i;
          }
        } else if (start !== -1) {
          end = i;
        } else {
          return undefined;
        }
      } else {
        return undefined;
      }
    }
  }

  if (
    parameter === undefined || inQuotes || (start === -1 && end === -1) ||
    code === 0x20 || code === 0x09
  ) {
    return undefined;
  }

  if (start !== -1) {
    if (end === -1) {
      end = i;
    }
    forwarded[parameter] = mustUnescape
      ? decode(value.slice(start, end))
      : value.slice(start, end);
  } else {
    forwarded[parameter] = "";
  }

  output.push(forwarded);
  return output;
}
