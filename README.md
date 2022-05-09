# oak commons

[![oak_commons ci](https://github.com/oakserver/commons/workflows/ci/badge.svg)](https://github.com/oakserver/commons)
[![deno doc](https://doc.deno.land/badge.svg)](https://doc.deno.land/https/deno.land/x/oak_commons)

A set of APIs that are common to HTTP/HTTPS servers.

Each module is designed to be largely independent of other modules, with as few
shared dependencies as reasonable. These modules are designed as building blocks
for more complex HTTP/HTTPS and server frameworks.

The [acorn](https://deno.land/x/acorn) RESTful services framework is an example
of something built on top of oak_commons.

The
[inline documentation](https://doc.deno.land/https://deno.land/x/oak_commons)
for each modules is the best guide on the usage of the APIs:

- [/cookies.ts](https://doc.deno.land/https://deno.land/x/oak_commons/cookies.ts) -
  an abstraction for handling request and response cookies, including automatic
  signing of cookies to prevent tampering.
- [/http_errors.ts](https://doc.deno.land/https://deno.land/x/oak_commons/http_errors.ts) -
  utilities for working with HTTP Error status as JavaScript errors.
- [/key_stack.ts](https://doc.deno.land/https://deno.land/x/oak_commons/key_stack.ts) -
  a key ring for handling signing of arbitrary data to prevent tampering,
  designed to work with the `Cookies` abstraction.
- [/method.ts](https://doc.deno.land/https://deno.land/x/oak_commons/method.ts) -
  utilities for working with HTTP methods/verbs in a type safe way.
- [/negotiation.ts](https://doc.deno.land/https://deno.land/x/oak_commons/negotiation.ts) -
  utilities for content, language, and encoding negotiation with requests and
  responses.
- [/status.ts](https://doc.deno.land/https://deno.land/x/oak_commons/status.ts) -
  utilities for working with HTTP statuses in a type safe way.
- [/types.d.ts](https://doc.deno.land/https://deno.land/x/oak_commons/types.d.ts) -
  abstract types and interfaces which are used by oak_commons.

---

Copyright 2018 - 2022 the oak authors. All rights reserved. MIT License.
