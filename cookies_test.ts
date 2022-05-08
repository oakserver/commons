// Copyright 2018-2022 the oak authors. All rights reserved. MIT license.

// deno-lint-ignore-file

import { assertEquals, assertRejects } from "./deps_test.ts";

import { Cookies } from "./cookies.ts";
import { KeyStack } from "./key_stack.ts";

function isNode(): boolean {
  return "process" in globalThis && "global" in globalThis;
}

function createHeaders(cookies?: string[]) {
  return new Headers(
    cookies ? [["cookie", cookies.join("; ")]] : undefined,
  );
}

Deno.test({
  name: "get cookie value",
  async fn() {
    const request = createHeaders(["foo=bar"]);
    const response = createHeaders();
    const cookies = new Cookies(request, response);
    assertEquals(await cookies.get("foo"), "bar");
    assertEquals(await cookies.get("bar"), undefined);
    assertEquals([...response], []);
  },
});

Deno.test({
  name: "get signed cookie",
  async fn() {
    const request = createHeaders(
      ["bar=foo", "bar.sig=S7GhXzJF3n4j8JwTupr7H-h25qtt_vs0stdETXZb-Ro"],
    );
    const response = createHeaders();
    const cookies = new Cookies(
      request,
      response,
      { keys: new KeyStack(["secret1"]) },
    );
    assertEquals(await cookies.get("bar"), "foo");
    assertEquals([...response], []);
  },
});

Deno.test({
  name: "get signed cookie requiring re-signing",
  async fn() {
    const request = createHeaders(
      ["bar=foo", "bar.sig=S7GhXzJF3n4j8JwTupr7H-h25qtt_vs0stdETXZb-Ro"],
    );
    const response = createHeaders();
    const cookies = new Cookies(
      request,
      response,
      { keys: new KeyStack(["secret2", "secret1"]) },
    );
    assertEquals(await cookies.get("bar"), "foo");
    assertEquals([...response], [[
      "set-cookie",
      "bar.sig=ar46bgP3n0ZRazFOfiZ4SyZVFxKUvG1-zQZCb9lbcPI; path=/; httponly",
    ]]);
  },
});

Deno.test({
  name: "get invalid signed cookie",
  async fn() {
    const request = createHeaders(
      ["bar=foo", "bar.sig=tampered", "foo=baz"],
    );
    const response = createHeaders();
    const cookies = new Cookies(
      request,
      response,
      { keys: new KeyStack(["secret1"]) },
    );
    assertEquals(await cookies.get("bar"), undefined);
    assertEquals(await cookies.get("foo"), undefined);
    assertEquals([...response], [
      [
        "set-cookie",
        "bar.sig=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; httponly",
      ],
    ]);
  },
});

Deno.test({
  name: "set cookie",
  async fn() {
    const request = createHeaders();
    const response = createHeaders();
    const cookies = new Cookies(request, response);
    await cookies.set("foo", "bar");
    assertEquals([...response], [
      ["set-cookie", "foo=bar; path=/; httponly"],
    ]);
  },
});

Deno.test({
  name: "set multiple cookies",
  async fn() {
    const request = createHeaders();
    const response = createHeaders();
    const cookies = new Cookies(request, response);
    await cookies.set("a", "a");
    await cookies.set("b", "b");
    await cookies.set("c", "c");
    const expected = isNode()
      ? [[
        "set-cookie",
        "a=a; path=/; httponly, b=b; path=/; httponly, c=c; path=/; httponly",
      ]]
      : [
        ["set-cookie", "a=a; path=/; httponly"],
        ["set-cookie", "b=b; path=/; httponly"],
        ["set-cookie", "c=c; path=/; httponly"],
      ];
    assertEquals([...response], expected);
  },
});

Deno.test({
  name: "set cookie with options",
  async fn() {
    const request = createHeaders();
    const response = createHeaders();
    const cookies = new Cookies(request, response);
    await cookies.set("foo", "bar", {
      domain: "*.example.com",
      expires: new Date("2020-01-01T00:00:00+00:00"),
      httpOnly: false,
      overwrite: false,
      path: "/foo",
      sameSite: "strict",
    });
    assertEquals(
      response.get("set-cookie"),
      "foo=bar; path=/foo; expires=Wed, 01 Jan 2020 00:00:00 GMT; domain=*.example.com; samesite=strict",
    );
  },
});

Deno.test({
  name: "set signed cookie",
  async fn() {
    const request = createHeaders();
    const response = createHeaders();
    const cookies = new Cookies(
      request,
      response,
      { keys: new KeyStack(["secret1"]) },
    );
    await cookies.set("bar", "foo");

    assertEquals(
      response.get("set-cookie"),
      "bar=foo; path=/; httponly, bar.sig=S7GhXzJF3n4j8JwTupr7H-h25qtt_vs0stdETXZb-Ro; path=/; httponly",
    );
  },
});

Deno.test({
  name: "set secure cookie",
  async fn() {
    const request = createHeaders([]);
    const response = createHeaders();
    const cookies = new Cookies(request, response, { secure: true });
    await cookies.set("bar", "foo", { secure: true });

    assertEquals(
      response.get("set-cookie"),
      "bar=foo; path=/; secure; httponly",
    );
  },
});

Deno.test({
  name: "set secure cookie on insecure context fails",
  async fn() {
    const request = createHeaders();
    const response = createHeaders();
    const cookies = new Cookies(request, response);
    await assertRejects(
      async () => {
        await cookies.set("bar", "foo", { secure: true });
      },
      TypeError,
      "Cannot send secure cookie over unencrypted connection.",
    );
  },
});

Deno.test({
  name: "set secure cookie on insecure context with ignoreInsecure",
  async fn() {
    const request = createHeaders();
    const response = createHeaders();
    const cookies = new Cookies(request, response);
    await cookies.set("bar", "foo", { secure: true, ignoreInsecure: true });

    assertEquals(
      response.get("set-cookie"),
      "bar=foo; path=/; secure; httponly",
    );
  },
});

Deno.test({
  name: "iterate cookies",
  async fn() {
    const request = createHeaders(
      ["bar=foo", "foo=baz", "baz=1234"],
    );
    const response = createHeaders();
    const cookies = new Cookies(
      request,
      response,
    );
    const actual = [];
    for await (const cookie of cookies) {
      actual.push(cookie);
    }
    assertEquals(
      actual,
      [["bar", "foo"], ["foo", "baz"], ["baz", "1234"]],
    );
  },
});

Deno.test({
  name: "iterate signed cookie",
  async fn() {
    const request = createHeaders(
      ["bar=foo", "bar.sig=S7GhXzJF3n4j8JwTupr7H-h25qtt_vs0stdETXZb-Ro"],
    );
    const response = createHeaders();
    const cookies = new Cookies(
      request,
      response,
      { keys: new KeyStack(["secret1"]) },
    );
    const actual = [];
    for await (const cookie of cookies) {
      actual.push(cookie);
    }
    assertEquals(actual, [["bar", "foo"]]);
  },
});

Deno.test({
  name: "Cookies - inspecting",
  fn() {
    const request = createHeaders(
      ["bar=foo", "foo=baz", "baz=1234"],
    );
    const response = createHeaders();
    assertEquals(
      Deno.inspect(new Cookies(request, response)),
      `Cookies []`,
    );
  },
});

Deno.test({
  name: "set multiple cookies with options",
  async fn() {
    const request = createHeaders();
    const response = createHeaders();
    const cookies = new Cookies(request, response);
    await cookies.set("foo", "bar", {
      domain: "*.example.com",
      expires: new Date("2020-01-01T00:00:00+00:00"),
      httpOnly: false,
      overwrite: false,
      path: "/foo",
      sameSite: "strict",
    });
    await cookies.set("a", "b", {
      domain: "*.example.com",
      expires: new Date("2020-01-01T00:00:00+00:00"),
      httpOnly: false,
      overwrite: false,
      path: "/a",
      sameSite: "strict",
    });
    await cookies.set("foo", "baz", {
      domain: "*.example.com",
      expires: new Date("2020-01-01T00:00:00+00:00"),
      httpOnly: false,
      overwrite: true,
      path: "/baz",
      sameSite: "strict",
    });
    const expected = isNode()
      ? "foo=baz; path=/baz; expires=Wed, 01 Jan 2020 00:00:00 GMT; domain=*.example.com; samesite=strict"
      : "a=b; path=/a; expires=Wed, 01 Jan 2020 00:00:00 GMT; domain=*.example.com; samesite=strict, foo=baz; path=/baz; expires=Wed, 01 Jan 2020 00:00:00 GMT; domain=*.example.com; samesite=strict";
    assertEquals(response.get("set-cookie"), expected);
  },
});
