// Copyright 2018-2022 the oak authors. All rights reserved. MIT license.

import { assertInstanceOf } from "./deps_test.ts";

import { type ErrorStatus, Status } from "./status.ts";

import {
  createHttpError,
  errors,
  type ErrorStatusKeys,
  HttpError,
} from "./http_errors.ts";

const clientErrorStatus: ErrorStatus[] = [
  Status.BadRequest,
  Status.Unauthorized,
  Status.PaymentRequired,
  Status.Forbidden,
  Status.NotFound,
  Status.MethodNotAllowed,
  Status.NotAcceptable,
  Status.ProxyAuthRequired,
  Status.RequestTimeout,
  Status.Conflict,
  Status.Gone,
  Status.LengthRequired,
  Status.PreconditionFailed,
  Status.RequestEntityTooLarge,
  Status.RequestURITooLong,
  Status.UnsupportedMediaType,
  Status.RequestedRangeNotSatisfiable,
  Status.ExpectationFailed,
  Status.Teapot,
  Status.MisdirectedRequest,
  Status.UnprocessableEntity,
  Status.Locked,
  Status.FailedDependency,
  Status.UpgradeRequired,
  Status.PreconditionRequired,
  Status.TooManyRequests,
  Status.RequestHeaderFieldsTooLarge,
  Status.UnavailableForLegalReasons,
];

const serverErrorStatus: ErrorStatus[] = [
  Status.InternalServerError,
  Status.NotImplemented,
  Status.BadGateway,
  Status.ServiceUnavailable,
  Status.GatewayTimeout,
  Status.HTTPVersionNotSupported,
  Status.VariantAlsoNegotiates,
  Status.InsufficientStorage,
  Status.LoopDetected,
  Status.NotExtended,
  Status.NetworkAuthenticationRequired,
];

Deno.test({
  name: "http_error - validate client errors",
  fn() {
    for (const errorStatus of clientErrorStatus) {
      const error = createHttpError(errorStatus);
      assertInstanceOf(error, HttpError);
      assertInstanceOf(error, errors[Status[errorStatus] as ErrorStatusKeys]);
    }
  },
});

Deno.test({
  name: "http_error - validate server errors",
  fn() {
    for (const errorStatus of serverErrorStatus) {
      const error = createHttpError(errorStatus);
      assertInstanceOf(error, HttpError);
      assertInstanceOf(error, errors[Status[errorStatus] as ErrorStatusKeys]);
    }
  },
});
