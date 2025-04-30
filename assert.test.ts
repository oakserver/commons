// Copyright 2018-2025 the oak authors. All rights reserved. MIT license.

import { assert } from "./assert.ts";
import { assertEquals, assertInstanceOf } from "./deps_test.ts";
import { HttpError, isHttpError } from "./http_errors.ts";
import { Status } from "./status.ts";

Deno.test({
  name: "assert - does not throw when condition is true",
  fn() {
    assert(true);
  },
});

Deno.test({
  name: "assert - throws bad request error",
  fn() {
    try {
      assert(false);
    } catch (error) {
      if (!isHttpError(error)) {
        throw new Error("expected error to be an HttpError");
      }
      assertEquals(error.status, 400);
      assertEquals(error.message, "Assertion failed.");
      assertEquals(error.expose, true);
    }
  },
});

Deno.test({
  name: "assert - message is customizable",
  fn() {
    try {
      assert(false, "This is a custom message.");
    } catch (error) {
      assertInstanceOf(error, Error);
      assertEquals(error.message, "This is a custom message.");
    }
  },
});

Deno.test({
  name: "assert - status is customizable",
  fn() {
    try {
      assert(false, "This is a custom message.", Status.NotFound);
    } catch (error) {
      assertInstanceOf(error, HttpError);
      assertEquals(error.status, 404);
      assertEquals(error.expose, true);
    }
  },
});

Deno.test({
  name: "assert - options are passed through",
  fn() {
    try {
      assert(false, "This is a custom message.", Status.NotFound, {
        expose: false,
      });
    } catch (error) {
      assertInstanceOf(error, HttpError);
      assertEquals(error.expose, false);
    }
  },
});
