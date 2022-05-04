// Copyright 2018-2021 the oak authors. All rights reserved. MIT license.

import {
  type ErrorStatus,
  isClientErrorStatus,
  Status,
  STATUS_TEXT,
} from "./status.ts";

const ERROR_STATUS_MAP = {
  "BadRequest": 400,
  "Unauthorized": 401,
  "PaymentRequired": 402,
  "Forbidden": 403,
  "NotFound": 404,
  "MethodNotAllowed": 405,
  "NotAcceptable": 406,
  "ProxyAuthRequired": 407,
  "RequestTimeout": 408,
  "Conflict": 409,
  "Gone": 410,
  "LengthRequired": 411,
  "PreconditionFailed": 412,
  "RequestEntityTooLarge": 413,
  "RequestURITooLong": 414,
  "UnsupportedMediaType": 415,
  "RequestedRangeNotSatisfiable": 416,
  "ExpectationFailed": 417,
  "Teapot": 418,
  "MisdirectedRequest": 421,
  "UnprocessableEntity": 422,
  "Locked": 423,
  "FailedDependency": 424,
  "UpgradeRequired": 426,
  "PreconditionRequired": 428,
  "TooManyRequests": 429,
  "RequestHeaderFieldsTooLarge": 431,
  "UnavailableForLegalReasons": 451,
  "InternalServerError": 500,
  "NotImplemented": 501,
  "BadGateway": 502,
  "ServiceUnavailable": 503,
  "GatewayTimeout": 504,
  "HTTPVersionNotSupported": 505,
  "VariantAlsoNegotiates": 506,
  "InsufficientStorage": 507,
  "LoopDetected": 508,
  "NotExtended": 510,
  "NetworkAuthenticationRequired": 511,
} as const;

type ErrorStatusKeys = keyof typeof ERROR_STATUS_MAP;

/** The base class that all derivative HTTP extend, providing a `status` and an
 * `expose` property. */
export class HttpError extends Error {
  /** A flag to indicate if the internals of the error, like the stack, should
   * be exposed to a client, or if they are "private" and should not be leaked.
   * By default, all client errors are `true` and all server errors are `false`.
   */
  get expose(): boolean {
    return false;
  }
  /** The error status that is set on the error. */
  get status(): ErrorStatus {
    return Status.InternalServerError;
  }
}

function createHttpErrorConstructor(status: ErrorStatus) {
  const name = `${Status[status]}Error`;
  const ErrorCtor = class extends HttpError {
    #expose = isClientErrorStatus(status);

    constructor(message = STATUS_TEXT[status]) {
      super(message);
      Object.defineProperty(this, "name", {
        configurable: true,
        enumerable: false,
        value: name,
        writable: true,
      });
    }

    get expose() {
      return this.#expose;
    }

    get status() {
      return status;
    }
  };
  return ErrorCtor;
}

/** A map of HttpErrors that are unique instances for each HTTP error status
 * code. */
export const errors = {} as Record<ErrorStatusKeys, typeof HttpError>;

for (const [key, value] of Object.entries(ERROR_STATUS_MAP)) {
  errors[key as ErrorStatusKeys] = createHttpErrorConstructor(value);
}

/** Create an instance of an HttpError based on the status code provided. */
export function createHttpError(
  status: ErrorStatus = 500,
  message?: string,
): HttpError {
  return new errors[Status[status] as ErrorStatusKeys](message);
}

/** A type guard that determines if the value is an HttpError or not. */
export function isHttpError(value: unknown): value is HttpError {
  return value instanceof HttpError;
}
