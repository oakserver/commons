# oak commons

[![jsr.io/@oak/commons](https://jsr.io/badges/@oak/commons)](https://jsr.io/@oak/commons)
[![jsr.io/@oak/commons score](https://jsr.io/badges/@oak/commons/score)](https://jsr.io/@oak/commons)
[![deno.land/x/oak_commons](https://deno.land/badge/oak_commons/version)](https://deno.land/x/oak_commons)

A set of APIs that are common to HTTP/HTTPS servers.

> [!NOTE]
> Originally most of this code was contributed to the Deno standard library but
> the maintainers after accepting the contributions have moved to remove this
> code, so I had to resurrect this library to be able to provide common HTTP
> functionality.

Each module is designed to be largely independent of other modules, with as few
shared dependencies as reasonable. These modules are designed as building blocks
for more complex HTTP/HTTPS and server frameworks.

The [acorn](https://deno.land/x/acorn) (a RESTful services framework) and
[oak](https://jsr.io/@oak/oak) are examples of something built on top of
oak commons.

## Usage

Each module/export is designed to be as independent as possible and there is no
top level export, so each area of functionality needs to be imported. For
example, to use `status` would look something like this:

```ts
import { STATUS_CODE, STATUS_TEXT } from "jsr:@oak/commons/status";

console.log(STATUS_CODE.NotFound); // Returns 404
console.log(STATUS_TEXT[STATUS_CODE.NotFound]); // Returns "Not Found"
```

## Documentation

The
[inline documentation](https://jsr.io/@oak/commons)
for each modules is the best guide on the usage of the APIs:

- [/cookie_map.ts](https://jsr.io/@oak/commons/doc/cookie_map/~) - an API for
  managing signed and unsigned cookies server side.
- [/form_data.ts](https://jsr.io/@oak/commons/doc/form_data/~) - the ability to
  parse a stream body into `FormData` when this functionality isn't available
  in the runtime.
- [/http_errors.ts](https://jsr.io/@oak/commons/doc/http_errors/~) - utilities
  for working with HTTP Error status as JavaScript errors.
- [/media_types.ts](https://jsr.io/@oak/commons/doc/media_types/~) - utilities
  for working with media types from a request.
- [/method.ts](https://jsr.io/@oak/commons/doc/method/~) - utilities for working
  with HTTP methods/verbs in a type safe way.
- [/range.ts](https://jsr.io/@oak/commons/doc/range/~) - utilities for
  supporting range requests.
- [/server_sent_event.ts](https://jsr.io/@oak/commons/doc/server_sent_event/~) -
  an abstraction for managing server sent events like DOM events.
- [/status.ts](https://jsr.io/@oak/commons/doc/status/~) - utilities for working
  with HTTP statuses in a type safe way.

---

Copyright 2018 - 2024 the oak authors. All rights reserved. MIT License.
