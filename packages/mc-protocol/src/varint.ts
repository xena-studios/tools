// VarInts, as the Java protocol writes them: seven bits a byte, least
// significant group first, the top bit set on every byte but the last. A
// VarInt is at most five bytes and holds a signed 32-bit integer, so -1 is
// five bytes (ff ff ff ff 0f).

export const VARINT_MAX_BYTES = 5;

export function encodeVarInt(value: number): Uint8Array {
  if (!Number.isInteger(value) || value < -0x80000000 || value > 0x7fffffff)
    throw new RangeError(`${value} doesn't fit in a VarInt`);
  const out: number[] = [];
  // >>> 0 reads the int as unsigned, so negative numbers take all five bytes.
  let v = value >>> 0;
  do {
    let byte = v & 0x7f;
    v >>>= 7;
    if (v !== 0) byte |= 0x80;
    out.push(byte);
  } while (v !== 0);
  return Uint8Array.from(out);
}

export interface Decoded {
  value: number;
  /** How many bytes it took. */
  size: number;
}

/**
 * Reads a VarInt at `offset`. Returns null when the bytes run out before it
 * ends (more are on the way), and throws when it's longer than five bytes.
 */
export function decodeVarInt(bytes: Uint8Array, offset = 0): Decoded | null {
  let value = 0;
  for (let i = 0; i < VARINT_MAX_BYTES; i++) {
    const byte = bytes[offset + i];
    if (byte === undefined) return null;
    value |= (byte & 0x7f) << (7 * i);
    if ((byte & 0x80) === 0) return { value: value | 0, size: i + 1 };
  }
  throw new RangeError("VarInt is longer than 5 bytes");
}

export function varIntSize(value: number): number {
  return encodeVarInt(value).length;
}
