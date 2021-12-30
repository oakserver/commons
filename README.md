# oak commons

A set of APIs that are common to HTTP/HTTPS servers.

## HTTP Methods (`/method.ts`)

A set of APIs for dealing with HTTP methods.

## Content Negotiation (`/negotiation.ts`)

A set of APIs for dealing with content negotiation of HTTP requests.

### `accepts()`

Negotiates an acceptable content type based upon the request. The function can
be called without any content types and the accepted content types will be
returned in priority order as an array of strings, or a set of content types can
be passed when calling the function and the best match is returned or
`undefined` if no match is made.

```ts
import { accepts } from "https://deno.land/x/oak_commons/negotiation.ts";

declare const req: Request;

// returns acceptable content types in priority order
accepts(req);

// returns the best matching content type of the ones provided
accepts(req, ["text/html", "application/json", "text/plain"]);
```

### `acceptsEncoding()`

Negotiates an acceptable encoding type based upon the request. The function can
be called without any encodings and the accepted content types will be returned
in priority order as an array of strings, or a set of encodings can be passed
when calling the function and the best match is returned or `undefined` if no
match is made.

You should always supply `identity` as one of the encodings to ensure that there
is a match when the `Accept-Encoding` header is part of the request.

```ts
import { acceptsEncodings } from "https://deno.land/x/oak_commons/negotiation.ts";

declare const req: Request;

// returns acceptable encodings in priority order
acceptsEncodings(req);

// returns the best matching encoding of the ones provided
acceptsEncodings(req, ["gzip", "identity"]);
```

### `acceptsLanguages()`

Negotiates an acceptable language based upon the request. The function can be
called without any languages and the accepted languages will be returned in
priority order as an array of strings, or a set of languages can be passed when
calling the function and the best language is returned or `undefined` if no
match is made.

```ts
import { acceptsLanguages } from "https://deno.land/x/oak_commons/negotiation.ts";

declare const req: Request;

// returns acceptable languages in priority order
acceptsLanguages(req);

// returns the best matching language of the ones provided
acceptsLanguages(req, ["en-gb", "en", "fr"]);
```

## HTTP Status (`/status.ts`)

An enum, a constant record and a set of guard functions for dealing with HTTP
status codes.
