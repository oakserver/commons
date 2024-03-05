// Copyright 2018-2024 the oak authors. All rights reserved. MIT license.

import {
  assert,
  assertEquals,
  assertStrictEquals,
  assertThrows,
} from "./deps_test.ts";

import { format, matches, MediaType, parse } from "./media_types.ts";

Deno.test({
  name: "MediaType - basic",
  fn() {
    const mediaType = new MediaType("application", "json");
    assertEquals(mediaType.type, "application");
    assertEquals(mediaType.subtype, "json");
    assertEquals(mediaType.suffix, undefined);
    assertEquals(String(mediaType), "application/json");
    assert(mediaType instanceof MediaType);
  },
});

Deno.test({
  name: "MediaType.parse()",
  fn() {
    const mediaType = MediaType.parse("application/vnd+json");
    assert(mediaType instanceof MediaType);
    assertEquals(mediaType.type, "application");
    assertEquals(mediaType.subtype, "vnd");
    assertEquals(mediaType.suffix, "json");
  },
});

Deno.test({
  name: "format basic type",
  fn() {
    const actual = format({ type: "text", subtype: "html" });
    assertStrictEquals(actual, "text/html");
  },
});

Deno.test({
  name: "format type with suffic",
  fn() { // formatWithSuffix() {
    const actual = format({ type: "image", subtype: "svg", suffix: "xml" });
    assertStrictEquals(actual, "image/svg+xml");
  },
});

Deno.test({
  name: "format invalid type",
  fn() {
    assertThrows(
      () => {
        format({ type: "text/", subtype: "html" });
      },
      TypeError,
      "Invalid type",
    );
  },
});

Deno.test({
  name: "format invalid sub type",
  fn() {
    assertThrows(
      () => {
        format({ type: "text", subtype: "html/" });
      },
      TypeError,
      "Invalid subtype",
    );
  },
});

Deno.test({
  name: "format invalid suffix",
  fn() {
    assertThrows(
      () => {
        format({ type: "image", subtype: "svg", suffix: "xml\\" });
      },
      TypeError,
      "Invalid suffix",
    );
  },
});

Deno.test({
  name: "parse basic type",
  fn() {
    const actual = parse("text/html");
    assertEquals(actual.type, "text");
    assertEquals(actual.subtype, "html");
    assertEquals(actual.suffix, undefined);
  },
});

Deno.test({
  name: "parse with suffix",
  fn() {
    const actual = parse("image/svg+xml");
    assertEquals(actual.type, "image");
    assertEquals(actual.subtype, "svg");
    assertEquals(actual.suffix, "xml");
  },
});

Deno.test({
  name: "parse is case insensitive",
  fn() {
    const actual = parse("IMAGE/SVG+XML");
    assertEquals(actual.type, "image");
    assertEquals(actual.subtype, "svg");
    assertEquals(actual.suffix, "xml");
  },
});

const invalidTypes = [
  " ",
  "null",
  "undefined",
  "/",
  "text/;plain",
  'text/"plain"',
  "text/p£ain",
  "text/(plain)",
  "text/@plain",
  "text/plain,wrong",
  "text/plain/",
];

for (const type of invalidTypes) {
  Deno.test({
    name: `parse invalidType: "${type}"`,
    fn() {
      assertThrows(
        () => {
          parse(type);
        },
        TypeError,
        "Invalid media type",
      );
    },
  });
}

Deno.test({
  name: "matches should ignore params",
  fn() {
    const actual = matches("text/html; charset=UTF-8", ["text/*"]);
    assertEquals(actual, "text/html");
  },
});

Deno.test({
  name: "matches should ignore params LWS",
  fn() {
    const actual = matches("text/html ; charset=UTF-8", ["text/*"]);
    assertEquals(actual, "text/html");
  },
});

Deno.test({
  name: "matches should ignore casing",
  fn() {
    const actual = matches("text/HTML", ["text/*"]);
    assertEquals(actual, "text/html");
  },
});

Deno.test({
  name: "matches should fail with invalid type",
  fn() {
    const actual = matches("text/html**", ["text/*"]);
    assertEquals(actual, undefined);
  },
});

Deno.test({
  name: "matches returns undefined with invalid types",
  fn() {
    assertEquals(matches("text/html", ["text/html/"]), undefined);
  },
});

Deno.test({
  name: "matches no types given",
  fn() {
    assertEquals(matches("image/png", []), "image/png");
  },
});

Deno.test({
  name: "matches type or undefined",
  fn() {
    assertEquals(matches("image/png", ["png"]), "png");
    assertEquals(matches("image/png", [".png"]), ".png");
    assertEquals(matches("image/png", ["image/png"]), "image/png");
    assertEquals(matches("image/png", ["image/*"]), "image/png");
    assertEquals(matches("image/png", ["*/png"]), "image/png");

    assertEquals(matches("image/png", ["jpeg"]), undefined);
    assertEquals(matches("image/png", [".jpeg"]), undefined);
    assertEquals(matches("image/png", ["image/jpeg"]), undefined);
    assertEquals(matches("image/png", ["text/*"]), undefined);
    assertEquals(matches("image/png", ["*/jpeg"]), undefined);

    assertEquals(matches("image/png", ["bogus"]), undefined);
    assertEquals(matches("image/png", ["something/bogus*"]), undefined);
  },
});

Deno.test({
  name: "matches first type or undefined",
  fn() {
    assertEquals(matches("image/png", ["png"]), "png");
    assertEquals(matches("image/png", [".png"]), ".png");
    assertEquals(matches("image/png", ["text/*", "image/*"]), "image/png");
    assertEquals(matches("image/png", ["image/*", "text/*"]), "image/png");
    assertEquals(
      matches("image/png", ["image/*", "image/png"]),
      "image/png",
    );
    assertEquals(
      matches("image/png", ["image/png", "image/*"]),
      "image/png",
    );

    assertStrictEquals(matches("image/png", ["jpeg"]), undefined);
    assertStrictEquals(matches("image/png", [".jpeg"]), undefined);
    assertStrictEquals(
      matches("image/png", ["text/*", "application/*"]),
      undefined,
    );
    assertStrictEquals(
      matches("image/png", ["text/html", "text/plain", "application/json"]),
      undefined,
    );
  },
});

Deno.test({
  name: "matches match suffix",
  fn() {
    assertEquals(
      matches("application/vnd+json", ["+json"]),
      "application/vnd+json",
    );
    assertEquals(
      matches("application/vnd+json", ["application/vnd+json"]),
      "application/vnd+json",
    );
    assertEquals(
      matches("application/vnd+json", ["application/*+json"]),
      "application/vnd+json",
    );
    assertEquals(
      matches("application/vnd+json", ["*/vnd+json"]),
      "application/vnd+json",
    );
    assertStrictEquals(
      matches("application/vnd+json", ["application/json"]),
      undefined,
    );
    assertStrictEquals(
      matches("application/vnd+json", ["text/*+json"]),
      undefined,
    );
  },
});

Deno.test({
  name: "matches start matches content type",
  fn() {
    assertEquals(matches("text/html", ["*/*"]), "text/html");
    assertEquals(matches("text/xml", ["*/*"]), "text/xml");
    assertEquals(matches("application/json", ["*/*"]), "application/json");
    assertEquals(
      matches("application/vnd+json", ["*/*"]),
      "application/vnd+json",
    );
  },
});

Deno.test({
  name: "matches start with invalid media type returns undefined",
  fn() {
    assertStrictEquals(matches("bogus", ["*/*"]), undefined);
  },
});

Deno.test({
  name: "matches matching url encoded",
  fn() { //matchUrlEncoded() {
    assertEquals(
      matches("application/x-www-form-urlencoded", ["urlencoded"]),
      "urlencoded",
    );
    assertEquals(
      matches("application/x-www-form-urlencoded", ["json", "urlencoded"]),
      "urlencoded",
    );
    assertEquals(
      matches("application/x-www-form-urlencoded", ["urlencoded", "json"]),
      "urlencoded",
    );
  },
});

Deno.test({
  name: "matches matching multipart star",
  fn() { //matchMultipartStar() {
    assertEquals(
      matches("multipart/form-data", ["multipart/*"]),
      "multipart/form-data",
    );
  },
});

Deno.test({
  name: "matches matching multipart",
  fn() { //matchMultipart() {
    assertEquals(
      matches("multipart/form-data", ["multipart"]),
      "multipart",
    );
  },
});
