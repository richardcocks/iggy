// Licensed to the Apache Software Foundation (ASF) under one
// or more contributor license agreements.  See the NOTICE file
// distributed with this work for additional information
// regarding copyright ownership.  The ASF licenses this file
// to you under the Apache License, Version 2.0 (the
// "License"); you may not use this file except in compliance
// with the License.  You may obtain a copy of the License at
//
//   http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing,
// software distributed under the License is distributed on an
// "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
// KIND, either express or implied.  See the License for the
// specific language governing permissions and limitations
// under the License.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { deserializeToken, deserializeTokens } from './token.utils.js';
import { toDate } from '../serialize.utils.js';

// Serialize a token in the wire layout deserializeToken expects:
//   u8 nameLength | name bytes | u64 LE expiry
const enc = (name: string, expiry: bigint): Buffer => {
  const n = Buffer.from(name);
  const b = Buffer.alloc(1 + n.length + 8);
  b.writeUInt8(n.length, 0);
  n.copy(b, 1);
  b.writeBigUInt64LE(expiry, 1 + n.length);
  return b;
};

describe('deserializeToken', () => {

  it('reports a relative byte count, not an absolute offset', () => {
    // A token placed partway through a buffer must report only its own size,
    // so the list walk can advance by pos += bytesRead.
    const prefix = Buffer.alloc(7);
    const buf = Buffer.concat([prefix, enc('abc', 42n)]);
    const { bytesRead, data } = deserializeToken(buf, prefix.length);
    assert.equal(bytesRead, 1 + 3 + 8);
    assert.equal(data.name, 'abc');
  });

});

describe('deserializeTokens', () => {

  it('walks every token in a multi-token buffer', () => {
    // Distinct name lengths so a wrong walk offset corrupts, not just drops,
    // later entries. Expiries are microseconds (see toDate).
    const input = [
      { name: 'a', expiry: 1_000_000n },
      { name: 'bb', expiry: 2_000_000n },
      { name: 'cccccccccc', expiry: 3_000_000n },
    ];
    const buf = Buffer.concat(input.map(t => enc(t.name, t.expiry)));

    const tokens = deserializeTokens(buf);

    assert.equal(tokens.length, input.length);
    assert.deepEqual(tokens.map(t => t.name), input.map(t => t.name));
    assert.deepEqual(
      tokens.map(t => t.expiry?.getTime()),
      input.map(t => toDate(t.expiry).getTime())
    );
  });

  it('handles a single token', () => {
    const buf = enc('solo', 1234n);
    const tokens = deserializeTokens(buf);
    assert.equal(tokens.length, 1);
    assert.equal(tokens[0].name, 'solo');
  });

});
