// Copyright 2018-2021 the oak authors. All rights reserved. MIT license.

/**
 * Contains the constant {@linkcode HTTP_METHODS} and the type
 * {@linkcode HttpMethods} and the type guard {@linkcode isHttpMethod} for
 * working with HTTP methods with type safety.
 *
 * @module
 */

export const HTTP_METHODS = [
  "HEAD",
  "OPTIONS",
  "GET",
  "PUT",
  "PATCH",
  "POST",
  "DELETE",
] as const;

/** A type representing string literals of each HTTP method. */
export type HttpMethods = typeof HTTP_METHODS[number];

/** A type guard that determines if a value is a valid HTTP method. */
export function isHttpMethod(value: unknown): value is HttpMethods {
  // deno-lint-ignore no-explicit-any
  return HTTP_METHODS.includes(value as any);
}
