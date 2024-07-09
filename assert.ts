// Copyright 2018-2024 the oak authors. All rights reserved. MIT license.

import { createHttpError, type HttpErrorOptions } from "./http_errors.ts";
import { type ErrorStatus, Status } from "./status.ts";

/**
 * A standard assert function, but if the condition is not met, it will throw
 * an `HttpError`. The error status and text can be changed, but defaults to
 * `400 Bad Request`.
 */
export function assert(
  condition: unknown,
  message = "Assertion failed.",
  errorStatus: ErrorStatus = Status.BadRequest,
  options?: HttpErrorOptions,
): asserts condition {
  if (!condition) {
    throw createHttpError(errorStatus, message, options);
  }
}
