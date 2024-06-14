// Copyright 2018-2024 the oak authors. All rights reserved. MIT license.

import { assert, assertEquals, assertInstanceOf } from "./deps_test.ts";

import { type ErrorStatus, Status, STATUS_TEXT } from "./status.ts";

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
      const errorExpose = createHttpError(
        errorStatus,
        STATUS_TEXT[errorStatus],
        { expose: false },
      );
      assertInstanceOf(error, HttpError);
      assertInstanceOf(error, errors[Status[errorStatus] as ErrorStatusKeys]);
      assertEquals(error.name, `${Status[errorStatus]}Error`);
      assertEquals(error.message, STATUS_TEXT[errorStatus]);
      assertEquals(errorExpose.status, errorStatus);
      const res = errorExpose.asResponse({
        headers: new Headers({ "WWW-Authenticate": "Bearer" }),
      });
      assertEquals(res.headers.get("WWW-Authenticate"), "Bearer");
      assertEquals(res.headers.get("Content-Type"), "application/json");
      assert(error.expose);
      assert(!errorExpose.expose);
    }
  },
});

Deno.test({
  name: "http_error - validate server errors",
  fn() {
    for (const errorStatus of serverErrorStatus) {
      const error = createHttpError(errorStatus);
      const errorExpose = createHttpError(
        errorStatus,
        STATUS_TEXT[errorStatus],
        {
          expose: true,
        },
      );
      assertInstanceOf(error, HttpError);
      assertInstanceOf(error, errors[Status[errorStatus] as ErrorStatusKeys]);
      assertEquals(error.name, `${Status[errorStatus]}Error`);
      assertEquals(error.message, STATUS_TEXT[errorStatus]);
      assertEquals(error.status, errorStatus);
      assert(!error.expose);
      assert(errorExpose.expose);
    }
  },
});

Deno.test({
  name: "http_error - asResponse() - accept",
  async fn() {
    const error = createHttpError(
      Status.Unauthorized,
      "Authorization required",
    );
    let res = error.asResponse();
    const body = await res.json();
    assertEquals(body.status, 401);
    assertEquals(body.statusText, "Unauthorized");
    assert(body.stack.startsWith("Unauthorized"));
    assertEquals(body.message, "Authorization required");
    let request = new Request("http://localhost:8080", {
      method: "GET",
      headers: {
        "accept":
          "text/html, application/xhtml+xml, application/xml;q=0.9, image/webp, */*;q=0.8",
      },
    });
    res = error.asResponse({
      request,
      prefer: "json",
      headers: { "WWW-Authenticate": "Bearer" },
    });
    assertEquals(res.headers.get("content-type"), "text/html; charset=UTF-8");
    request = new Request("http://localhost:8080", {
      method: "GET",
      headers: { "accept": "application/json, text/html" },
    });
    res = error.asResponse({ request, prefer: "json" });
    assertEquals(
      res.headers.get("content-type"),
      "application/json",
    );
    res = error.asResponse({ request, prefer: "html" });
    assertEquals(
      res.headers.get("content-type"),
      "text/html; charset=UTF-8",
    );
    request = new Request("http://localhost:8080", {
      headers: { "accept": "img/jpeg" },
    });
    res = error.asResponse({ request });
    assertEquals(
      res.headers.get("content-type"),
      "text/plain; charset=UTF-8",
    );
  },
});
