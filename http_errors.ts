// Copyright 2018-2024 the oak authors. All rights reserved. MIT license.

/**
 * A collection of HTTP errors and utilities.
 *
 * The export {@linkcode errors} contains an individual class that extends
 * {@linkcode HttpError} which makes handling HTTP errors in a structured way.
 *
 * The function {@linkcode createHttpError} provides a way to create instances
 * of errors in a factory pattern.
 *
 * The function {@linkcode isHttpError} is a type guard that will narrow a value
 * to an `HttpError` instance.
 *
 * @example
 * ```ts
 * import { errors, isHttpError } from "jsr:@oak/commons/http_errors";
 *
 * try {
 *   throw new errors.NotFound();
 * } catch (e) {
 *   if (isHttpError(e)) {
 *     const response = new Response(e.message, { status: e.status });
 *   } else {
 *     throw e;
 *   }
 * }
 * ```
 *
 * @example
 * ```ts
 * import { createHttpError } from "jsr:@oak/commons/http_errors";
 * import { Status } from "jsr:@oak/commons/status";
 *
 * try {
 *   throw createHttpError(
 *     Status.BadRequest,
 *     "The request was bad.",
 *     { expose: false }
 *   );
 * } catch (e) {
 *   // handle errors
 * }
 * ```
 *
 * @module
 */

import { accepts } from "jsr:@std/http@^1.0/negotiation";
import { contentType } from "jsr:@std/media-types@^1.0/content-type";

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

/**
 * A type alias which is a set of all the string literal names of the error
 * status codes.
 */
export type ErrorStatusKeys = keyof typeof ERROR_STATUS_MAP;

/**
 * Options which can be set when initializing an {@linkcode HttpError}
 */
export interface HttpErrorOptions extends ErrorOptions {
  /** Determine if the underlying error stack should be exposed to a client. */
  expose?: boolean;
}

export interface AsResponseOptions {
  /**
   * Any additional headers that should be included when creating the
   * response.
   */
  headers?: HeadersInit;
  /**
   * When determining what format to respond in, prefer either a JSON or HTML
   * response. If a request is provided, the accept header will be used to
   * determine the final response content type.
   *
   * Defaults to `"json"`.
   */
  prefer?: "json" | "html";
  /**
   * An optional {@linkcode Request}, which will be used to determine what
   * type of response the request can accept.
   */
  request?: Request;
}

/**
 * The base class that all derivative HTTP extend, providing a `status` and an
 * `expose` property.
 */
export class HttpError<S extends ErrorStatus = Status.InternalServerError>
  extends Error {
  #expose: boolean;
  constructor(
    message = "Http Error",
    options?: HttpErrorOptions,
  ) {
    super(message, options);
    this.#expose = options?.expose === undefined
      ? isClientErrorStatus(this.status)
      : options.expose;
  }

  /** A flag to indicate if the internals of the error, like the stack, should
   * be exposed to a client, or if they are "private" and should not be leaked.
   * By default, all client errors are `true` and all server errors are
   * `false`. */
  get expose(): boolean {
    return this.#expose;
  }

  /** The error status that is set on the error. */
  get status(): S {
    return Status.InternalServerError as S;
  }

  /**
   * Format the error as a {@linkcode Response} which can be sent to a client.
   */
  asResponse(options: AsResponseOptions = {}): Response {
    const { prefer = "json", request, headers } = options;
    const acceptsContent = request
      ? prefer === "json"
        ? accepts(request, "application/json", "text/html")
        : accepts(request, "text/html", "application/json")
      : prefer === "json"
      ? "application/json"
      : "text/html";
    switch (acceptsContent) {
      case "application/json":
        return Response.json({
          status: this.status,
          statusText: STATUS_TEXT[this.status],
          message: this.message,
          stack: this.#expose ? this.stack : undefined,
        }, {
          status: this.status,
          statusText: STATUS_TEXT[this.status],
          headers,
        });
      case "text/html": {
        const res = new Response(
          `<!DOCTYPE html><html>
        <head>
          <title>${STATUS_TEXT[this.status]} - ${this.status}</title>
        </head>
        <body>
          <h1>${STATUS_TEXT[this.status]} - ${this.status}</h1>
          <h2>${this.message}</h2>
          ${
            this.#expose && this.stack
              ? `<h3>Stack trace:</h3><pre>${this.stack}</pre>`
              : ""
          }
        </body>
      </html>`,
          {
            status: this.status,
            statusText: STATUS_TEXT[this.status],
            headers,
          },
        );
        res.headers.set("content-type", contentType("html"));
        return res;
      }
    }
    const res = new Response(
      `${STATUS_TEXT[this.status]} - ${this.status}\n${this.message}\n\n${
        this.#expose ? this.stack : ""
      }`,
      {
        status: this.status,
        statusText: STATUS_TEXT[this.status],
        headers,
      },
    );
    res.headers.set("content-type", contentType("txt"));
    return res;
  }
}

function createHttpErrorConstructor<S extends ErrorStatus>(
  status: S,
): typeof HttpError<S> {
  const name = `${Status[status]}Error`;
  const ErrorCtor = class extends HttpError<S> {
    constructor(
      message = STATUS_TEXT[status],
      options?: HttpErrorOptions,
    ) {
      super(message, options);
      Object.defineProperty(this, "name", {
        configurable: true,
        enumerable: false,
        value: name,
        writable: true,
      });
    }

    override get status(): S {
      return status;
    }
  };
  return ErrorCtor;
}

/**
 * A namespace that contains each error constructor. Each error extends
 * `HTTPError` and provides `.status` and `.expose` properties, where the
 * `.status` will be an error `Status` value and `.expose` indicates if
 * information, like a stack trace, should be shared in the response.
 *
 * By default, `.expose` is set to false in server errors, and true for client
 * errors.
 *
 * @example
 * ```ts
 * import { errors } from "jsr:@oak/commons/http_errors";
 *
 * throw new errors.InternalServerError("Ooops!");
 * ```
 */
export const errors: Record<ErrorStatusKeys, typeof HttpError<ErrorStatus>> =
  {} as Record<
    ErrorStatusKeys,
    typeof HttpError<ErrorStatus>
  >;

for (const [key, value] of Object.entries(ERROR_STATUS_MAP)) {
  errors[key as ErrorStatusKeys] = createHttpErrorConstructor(value);
}

/**
 * A factory function which provides a way to create errors. It takes up to 3
 * arguments, the error `Status`, an message, which defaults to the status text
 * and error options, which includes the `expose` property to set the `.expose`
 * value on the error.
 */
export function createHttpError<
  S extends ErrorStatus = Status.InternalServerError,
>(
  status: S = Status.InternalServerError as S,
  message?: string,
  options?: HttpErrorOptions,
): HttpError<S> {
  return new errors[Status[status] as ErrorStatusKeys](
    message,
    options,
  ) as HttpError<S>;
}

/**
 * A type guard that determines if the value is an HttpError or not.
 */
export function isHttpError(value: unknown): value is HttpError<ErrorStatus> {
  return value instanceof HttpError;
}
