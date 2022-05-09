// Copyright 2018-2022 the oak authors. All rights reserved. MIT license.

/**
 * Provides the {@linkcode Cookies} class which provides an async iterable
 * interface for reading and writing cookies from a request and response.
 *
 * @module
 */

import { type KeyRing } from "./types.d.ts";

export interface CookiesOptions {
  /** A key ring which will be used to validate and sign cookies. */
  keys?: KeyRing;
  /** A flag that indicates if the request and response are being handled over
   * a secure connection. Defaults to `false`. */
  secure?: boolean;
}

export interface CookiesGetOptions {
  /** Overrides the flag that was set when the instance was created. */
  signed?: boolean;
}

export interface CookiesSetDeleteOptions {
  /** The domain to scope the cookie for. */
  domain?: string;
  /** When the cookie expires. */
  expires?: Date;
  /** A flag that indicates if the cookie is valid over HTTP only. */
  httpOnly?: boolean;
  /** Do not error when signing and validating cookies over an insecure
   * connection. */
  ignoreInsecure?: boolean;
  /** Overwrite an existing value. */
  overwrite?: boolean;
  /** The path the cookie is valid for. */
  path?: string;
  /** Override the flag that was set when the instance was created. */
  secure?: boolean;
  /** Set the same-site indicator for a cookie. */
  sameSite?: "strict" | "lax" | "none" | boolean;
  /** Override the default behavior of signing the cookie. */
  signed?: boolean;
}

type CookieAttributes = CookiesSetDeleteOptions;

const matchCache: Record<string, RegExp> = {};

// deno-lint-ignore no-control-regex
const FIELD_CONTENT_REGEXP = /^[\u0009\u0020-\u007e\u0080-\u00ff]+$/;
const KEY_REGEXP = /(?:^|;) *([^=]*)=[^;]*/g;
const SAME_SITE_REGEXP = /^(?:lax|none|strict)$/i;

function getPattern(name: string): RegExp {
  if (name in matchCache) {
    return matchCache[name];
  }

  return matchCache[name] = new RegExp(
    `(?:^|;) *${name.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&")}=([^;]*)`,
  );
}

function pushCookie(headers: string[], cookie: Cookie): void {
  if (cookie.overwrite) {
    for (let i = headers.length - 1; i >= 0; i--) {
      if (headers[i].indexOf(`${cookie.name}=`) === 0) {
        headers.splice(i, 1);
      }
    }
  }
  headers.push(cookie.toHeader());
}

function validateCookieProperty(
  key: string,
  value: string | undefined | null,
): void {
  if (value && !FIELD_CONTENT_REGEXP.test(value)) {
    throw new TypeError(`The ${key} of the cookie (${value}) is invalid.`);
  }
}

/** An internal abstraction used to manage cookies. */
class Cookie implements CookieAttributes {
  domain?: string;
  expires?: Date;
  httpOnly = true;
  maxAge?: number;
  name: string;
  overwrite = false;
  path = "/";
  sameSite: "strict" | "lax" | "none" | boolean = false;
  secure = false;
  signed?: boolean;
  value: string;

  constructor(
    name: string,
    value: string | null,
    attributes: CookieAttributes,
  ) {
    validateCookieProperty("name", name);
    validateCookieProperty("value", value);
    this.name = name;
    this.value = value ?? "";
    Object.assign(this, attributes);
    if (!this.value) {
      this.expires = new Date(0);
      this.maxAge = undefined;
    }

    validateCookieProperty("path", this.path);
    validateCookieProperty("domain", this.domain);
    if (
      this.sameSite && typeof this.sameSite === "string" &&
      !SAME_SITE_REGEXP.test(this.sameSite)
    ) {
      throw new TypeError(
        `The sameSite of the cookie ("${this.sameSite}") is invalid.`,
      );
    }
  }

  toHeader(): string {
    let header = this.toString();
    if (this.maxAge) {
      this.expires = new Date(Date.now() + (this.maxAge * 1000));
    }

    if (this.path) {
      header += `; path=${this.path}`;
    }
    if (this.expires) {
      header += `; expires=${this.expires.toUTCString()}`;
    }
    if (this.domain) {
      header += `; domain=${this.domain}`;
    }
    if (this.sameSite) {
      header += `; samesite=${
        this.sameSite === true ? "strict" : this.sameSite.toLowerCase()
      }`;
    }
    if (this.secure) {
      header += "; secure";
    }
    if (this.httpOnly) {
      header += "; httponly";
    }

    return header;
  }

  toString(): string {
    return `${this.name}=${this.value}`;
  }
}

export class Cookies {
  #cookieKeys?: string[];
  #keys?: KeyRing;
  #requestHeaders: Headers;
  #responseHeaders: Headers;
  #secure: boolean;

  #requestKeys(): string[] {
    if (this.#cookieKeys) {
      return this.#cookieKeys;
    }
    const result = this.#cookieKeys = [] as string[];
    const header = this.#requestHeaders.get("cookie");
    if (!header) {
      return result;
    }
    let matches: RegExpExecArray | null;
    while ((matches = KEY_REGEXP.exec(header))) {
      const [, key] = matches;
      result.push(key);
    }
    return result;
  }

  /** A class which provides an abstraction for getting and setting cookies in
   * request and response headers.
   *
   * This was heavily influenced by
   * [pillarjs/cookies](https://github.com/pillarjs/cookies/blob/master/index.js).
   *
   * @param requestHeaders The {@linkcode Headers} object which cookies are read
   *                       out of.
   * @param responseHeaders The {@linkcode Headers} object which cookies are
   *                        set.
   * @param options An optional set of options which impact the behavior of the
   *                instance.
   */
  constructor(
    requestHeaders: Headers,
    responseHeaders: Headers,
    options: CookiesOptions = {},
  ) {
    const { keys, secure = false } = options;
    this.#keys = keys;
    this.#requestHeaders = requestHeaders;
    this.#responseHeaders = responseHeaders;
    this.#secure = secure;
  }

  /** Set a cookie to be deleted in the response. This is a convenience function
   * for `.set(name, null, options?)`.
   */
  delete(name: string, options: CookiesSetDeleteOptions = {}): boolean {
    this.set(name, null, options);
    return true;
  }

  /** Iterate over the request's cookies, yielding up a tuple containing the
   * key and value of each cookie.
   *
   * If a key ring was provided, only properly signed cookie keys and values are
   * returned. */
  entries(): AsyncIterableIterator<[string, string]> {
    return this[Symbol.asyncIterator]();
  }

  /** Get the value of a cookie from the request.
   *
   * If the cookie is signed, and the signature is invalid, `undefined` will be
   * returned and the cookie will be set to be deleted in the response. If the
   * cookie is using an "old" key from the keyring, the cookie will be re-signed
   * with the current key and be added to the response to be updated. */
  async get(
    name: string,
    options: CookiesGetOptions = {},
  ): Promise<string | undefined> {
    const signed = options.signed ?? !!this.#keys;
    const nameSig = `${name}.sig`;

    const header = this.#requestHeaders.get("cookie");
    if (!header) {
      return;
    }
    const match = header.match(getPattern(name));
    if (!match) {
      return;
    }
    const [, value] = match;
    if (!signed) {
      return value;
    }
    const digest = await this.get(nameSig, { signed: false });
    if (!digest) {
      return;
    }
    const data = `${name}=${value}`;
    if (!this.#keys) {
      throw new TypeError("keys required for signed cookies");
    }
    const index = await this.#keys.indexOf(data, digest);

    if (index < 0) {
      this.delete(nameSig, { path: "/", signed: false });
    } else {
      if (index) {
        this.set(nameSig, await this.#keys.sign(data), { signed: false });
      }
      return value;
    }
  }

  /** Iterate over the request's cookies, yielding up the key of each cookie.
   *
   * If a keyring was provided, only properly signed cookie keys are
   * returned. */
  async *keys(): AsyncIterableIterator<string> {
    for await (const [key] of this) {
      yield key;
    }
  }

  /** Set a cookie in the response headers.
   *
   * If there was a keyring set, cookies will be automatically signed, unless
   * overridden by the passed options. Cookies can be deleted by setting the
   * value to `null`. */
  async set(
    name: string,
    value: string | null,
    options: CookiesSetDeleteOptions = {},
  ): Promise<this> {
    const responseHeaders = this.#responseHeaders;
    const headers: string[] = [];
    for (const [key, value] of responseHeaders.entries()) {
      if (key === "set-cookie") {
        headers.push(value);
      }
    }
    const secure = this.#secure;
    const signed = options.signed ?? !!this.#keys;

    if (!secure && options.secure && !options.ignoreInsecure) {
      throw new TypeError(
        "Cannot send secure cookie over unencrypted connection.",
      );
    }

    const cookie = new Cookie(name, value, options);
    cookie.secure = options.secure ?? secure;
    pushCookie(headers, cookie);

    if (signed) {
      if (!this.#keys) {
        throw new TypeError("keys required for signed cookies.");
      }
      cookie.value = await this.#keys.sign(cookie.toString());
      cookie.name += ".sig";
      pushCookie(headers, cookie);
    }

    responseHeaders.delete("set-cookie");
    for (const header of headers) {
      responseHeaders.append("set-cookie", header);
    }
    return this;
  }

  /** Iterate over the request's cookies, yielding up the value of each cookie.
   *
   * If a keyring was provided, only properly signed cookie values are
   * returned. */
  async *values(): AsyncIterableIterator<string> {
    for await (const [, value] of this) {
      yield value;
    }
  }

  async *[Symbol.asyncIterator](): AsyncIterableIterator<[string, string]> {
    const keys = this.#requestKeys();
    for (const key of keys) {
      const value = await this.get(key);
      if (value) {
        yield [key, value];
      }
    }
  }

  [Symbol.for("Deno.customInspect")]() {
    return `${this.constructor.name} []`;
  }

  [Symbol.for("nodejs.util.inspect.custom")](
    depth: number,
    // deno-lint-ignore no-explicit-any
    options: any,
    inspect: (value: unknown, options?: unknown) => string,
  ) {
    if (depth < 0) {
      return options.stylize(`[${this.constructor.name}]`, "special");
    }

    const newOptions = Object.assign({}, options, {
      depth: options.depth === null ? null : options.depth - 1,
    });
    return `${options.stylize(this.constructor.name, "special")} ${
      inspect([], newOptions)
    }`;
  }
}
