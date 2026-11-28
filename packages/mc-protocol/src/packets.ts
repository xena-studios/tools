// The Java Edition Server List Ping (1.7 and later), over TCP:
//
//   client: Handshake (0x00: protocol, host, port, next state 1)
//   client: Status Request (0x00, empty)
//   server: Status Response (0x00: a JSON string)
//   client: Ping (0x01: an 8-byte long)
//   server: Pong (0x01: the same long)
//
// Every packet is framed as VarInt length, VarInt packet id, then the body;
// the length counts the id and the body. Status packets are never compressed.

import { decodeVarInt, encodeVarInt } from "./varint.ts";

/**
 * By convention a client asking a server which version it runs sends -1; the
 * server answers with its own version either way.
 */
export const PROTOCOL_QUERY = -1;

/** Next state 1 is status; 2 is login. */
export const NEXT_STATE_STATUS = 1;

const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8", { fatal: false });

export function concat(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

/** A protocol string: its UTF-8 length as a VarInt, then the bytes. */
export function encodeString(value: string): Uint8Array {
  const bytes = encoder.encode(value);
  return concat([encodeVarInt(bytes.length), bytes]);
}

function encodeUShort(value: number): Uint8Array {
  if (!Number.isInteger(value) || value < 0 || value > 0xffff)
    throw new RangeError(`${value} isn't a port`);
  return Uint8Array.of(value >> 8, value & 0xff);
}

function encodeLong(value: bigint): Uint8Array {
  const out = new Uint8Array(8);
  new DataView(out.buffer).setBigInt64(0, value);
  return out;
}

/** One framed packet: length, id, body. */
export function framePacket(id: number, body: Uint8Array = new Uint8Array()): Uint8Array {
  const idBytes = encodeVarInt(id);
  return concat([encodeVarInt(idBytes.length + body.length), idBytes, body]);
}

export interface HandshakeOptions {
  host: string;
  port: number;
  protocol?: number;
  nextState?: number;
}

export function handshakePacket({
  host,
  port,
  protocol = PROTOCOL_QUERY,
  nextState = NEXT_STATE_STATUS,
}: HandshakeOptions): Uint8Array {
  return framePacket(
    0x00,
    concat([
      encodeVarInt(protocol),
      encodeString(host),
      encodeUShort(port),
      encodeVarInt(nextState),
    ]),
  );
}

export const statusRequestPacket = (): Uint8Array => framePacket(0x00);

export const pingPacket = (payload: bigint): Uint8Array => framePacket(0x01, encodeLong(payload));

export interface Frame {
  id: number;
  body: Uint8Array;
}

export class ProtocolError extends Error {}

/**
 * Collects bytes from a stream and cuts them into packets. `maxBytes` caps a
 * single packet, so a server can't make us buffer more than that.
 */
export class FrameReader {
  private buf: Uint8Array = new Uint8Array(0);
  constructor(private readonly maxBytes = 256 * 1024) {}

  push(chunk: Uint8Array): void {
    if (this.buf.length + chunk.length > this.maxBytes + 10)
      throw new ProtocolError(`More than ${this.maxBytes} bytes`);
    this.buf = this.buf.length === 0 ? chunk.slice() : concat([this.buf, chunk]);
  }

  /** The next whole packet, or null if it hasn't all arrived. */
  next(): Frame | null {
    const length = decodeVarInt(this.buf);
    if (!length) return null;
    if (length.value <= 0) throw new ProtocolError(`Bad packet length ${length.value}`);
    if (length.value > this.maxBytes)
      throw new ProtocolError(`Packet of ${length.value} bytes is over the limit`);
    const end = length.size + length.value;
    if (this.buf.length < end) return null;
    const packet = this.buf.subarray(length.size, end);
    const id = decodeVarInt(packet);
    if (!id) throw new ProtocolError("Packet ends inside its id");
    const frame = { id: id.value, body: packet.slice(id.size) };
    this.buf = this.buf.slice(end);
    return frame;
  }
}

/** Reads a protocol string from a packet body. */
export function decodeString(body: Uint8Array, offset = 0): { value: string; size: number } {
  const length = decodeVarInt(body, offset);
  if (!length) throw new ProtocolError("String ends inside its length");
  if (length.value < 0) throw new ProtocolError("Negative string length");
  const start = offset + length.size;
  const end = start + length.value;
  if (end > body.length) throw new ProtocolError("String runs past the packet");
  return { value: decoder.decode(body.subarray(start, end)), size: end - offset };
}

/** The JSON string in a Status Response (packet 0x00). */
export function readStatusResponse(frame: Frame): string {
  if (frame.id !== 0x00) throw new ProtocolError(`Expected a status response, got 0x${frame.id}`);
  return decodeString(frame.body).value;
}

/** The long in a Pong (packet 0x01). */
export function readPong(frame: Frame): bigint {
  if (frame.id !== 0x01) throw new ProtocolError(`Expected a pong, got 0x${frame.id}`);
  if (frame.body.length !== 8) throw new ProtocolError("A pong is 8 bytes");
  return new DataView(frame.body.buffer, frame.body.byteOffset, 8).getBigInt64(0);
}
