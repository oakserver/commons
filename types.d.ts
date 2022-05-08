// Copyright 2018-2022 the oak authors. All rights reserved. MIT license.

/** Types of data that can be signed cryptographically. */
export type Data = string | number[] | ArrayBuffer | Uint8Array;

/** Types of keys that can be used to sign data. */
export type Key = string | number[] | ArrayBuffer | Uint8Array;

export interface KeyRing {
  readonly length: number;

  indexOf(data: Data, digest: string): Promise<number>;
  sign(data: Data): Promise<string>;
  verify(data: Data, digest: string): Promise<boolean>;
}
