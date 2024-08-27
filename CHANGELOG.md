# @oak/commons Change Log

## Version 1.0.0

Stabilization of the library, as Deno std is also stabilized!

- chore: update to @std 1.0 (70da74)
- docs: correct documentation for `ServerSentEvent` (#1)

## Version 0.13.0

- feat: add assert (22ddaa9)

  Oak commons now has an `assert()` function that throws an HTTP error, which is
  useful when asserting something in middleware or a handler where a more
  informative response can be sent to the client.

- feat: add keystack (fd092b3)

  Oak commons has taken back over a previous contribution to the Deno std
  library that was removed. It is used to manage multiple encryption keys and
  adheres to the interface of the secure cookie map to be able to sign and
  verify cookies.

- chore: update std dependencies (73b5576)

## Version 0.12.0

- feat: add `asResponse()` method to HTTP errors (36f8232)

  HTTP errors now supports the method `.asResponse()` which allows HTTP errors
  to be more easily sent to a client. When a request is supplied as an option to
  the method, content negotiation will be used to determine the format of the
  response body, with the `prefer` option given preference to a format during
  negotiation.

  **BREAKING CHANGE** Because of this, previously HTTP errors took the `headers`
  option on construction as well as instances had a `.headers` property. This
  has been removed, and a `headers` option can be instead passed to the
  `.asResponse()` method.

- chore: update `@std/bytes` version (8a29360)

## Version 0.11.0

- feat: add forwarded parser (6fb5752)
- docs: complete inline docs for getFilename (17c7007)

## Version 0.10.2

- chore: update dependencies (c53c610)

## Version 0.10.1

- feat: add form data parse (030ac0b)

## Version 0.10.0

_skipped due to a sad mis-tagging adventure_

## Version 0.9.1

- feat: return status 206 on range responses (cc5e8f2)

## Version 0.9.0

- feat: add support for multipart byte ranges (29b4ec3)

## Version 0.8.1

- chore: export range from package (dd3d78c)

## Version 0.8.0

- feat: add range APIs (898140a)
- chore: update packaging info (989344d)
- chore: update to std 0.222 (041edac)
