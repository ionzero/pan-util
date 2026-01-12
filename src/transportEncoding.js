// this module handles transport encoding.  IE from websocket wire to useful structure.
/*
 * PAN Transport Encoding
 *
 * Supports:
 *  - v0x01.0x00 binary routing envelope
 *  - v0x7B JSON agent encoding
 *
 * This module is environment-neutral (Node + browser).
 */
import { NULL_ID, MAX_JSON_ENVELOPE_SIZE, MAX_PAYLOAD_SIZE } from './constants.js';
import { validateMessageFromAgent, validateMessageToAgent } from './validators.js';
import { v4 as uuidv4 } from 'uuid';

const FRAME_PREFIX_LENGTH = 4;
const JSON_FRAME_PREFIX_LENGTH = 4;

const ROUTING_ENVELOPE_SIZE = 88;

const MAJOR_BINARY = 0x01;
const MINOR_BINARY = 0x00;
const MAJOR_JSON = 0x7B;
const MINOR_JSON = 0x00;

const PACKET_TYPES = {
    'control': 0x00,
    'directed': 0x01,
    'broadcast': 0x02,
    0x00: 'control',
    0x01: 'directed',
    0x02: 'broadcast'
};

/* ------------------------------------------------------------------ *
 * UUID helpers
 * ------------------------------------------------------------------ */

/**
 * Convert UUID string to 16-byte Uint8Array
 */
export function uuidToBytes(uuid) {
    if (!uuid) throw new Error("UUID required");

    const hex = uuid.replace(/-/g, "");
    if (hex.length !== 32) {
        throw new Error("Invalid UUID format");
    }

    const out = new Uint8Array(16);
    for (let i = 0; i < 16; i++) {
        out[i] = parseInt(hex.substr(i * 2, 2), 16);
    }
    return out;
}

/**
 * Convert 16-byte Uint8Array to UUID string
 */
export function bytesToUuid(bytes) {
    if (!(bytes instanceof Uint8Array) || bytes.length !== 16) {
        throw new Error("Expected 16-byte Uint8Array");
    }

    const hex = Array.from(bytes)
        .map(b => b.toString(16).padStart(2, "0"))
        .join("");

    return (
        hex.slice(0, 8) + "-" +
        hex.slice(8, 12) + "-" +
        hex.slice(12, 16) + "-" +
        hex.slice(16, 20) + "-" +
        hex.slice(20)
    );
}

/* ------------------------------------------------------------------ *
 * Public API
 * ------------------------------------------------------------------ */

export function encodePacket(packet, options = {}) {
    const major = packet.version?.major;

    if (major === MAJOR_BINARY) {
        return encodeV1Packet(packet);
    }

    if (major === MAJOR_JSON) {
        return encodeV7BPacket(packet);
    }

    throw new Error(`Unsupported packet version: ${major}`);
}

export function decodePacket(buffer) {
    const bytes = toUint8Array(buffer);
    const major = bytes[0];

    if (major === MAJOR_BINARY) {
        return decodeV1Packet(bytes);
    }

    if (major === MAJOR_JSON) {
        return decodeV7BPacket(bytes);
    }

    throw new Error(`Unsupported packet version byte: ${major}`);
}

/* ------------------------------------------------------------------ *
 * v0x01.0x00 Binary Encoding
 * ------------------------------------------------------------------ */

/**
 * Encode v0x01.0x00 packet
 */
function encodeV1Packet(pkt) {
    if (!(pkt.payload instanceof Uint8Array)) {
        throw new Error("v0x01 payload must be Uint8Array");
    }

    if (pkt.payload.length > MAX_PAYLOAD_SIZE) {
        throw new Error("Payload exceeds 60 KiB limit");
    }

    const totalLength = ROUTING_ENVELOPE_SIZE + pkt.payload.length;
    const buffer = new Uint8Array(totalLength);
    const view = new DataView(buffer.buffer);

    buffer[0] = MAJOR_BINARY;
    buffer[1] = pkt.version.minor ?? 0;
    view.setUint16(2, totalLength, false); // network byte order
    buffer[4] = pkt.spread ?? 0;
    buffer[5] = pkt.ttl ?? 0;
    buffer[6] = pkt.type;
    buffer[7] = pkt.flags ?? 0;


    buffer.set(uuidToBytes(pkt.from.node_id), 8);
    buffer.set(uuidToBytes(pkt.from.conn_id), 24);
    buffer.set(uuidToBytes(pkt.to.id), 40);
    buffer.set(uuidToBytes(pkt.to.sub_id), 56);
    buffer.set(uuidToBytes(pkt.message_id), 72);

    buffer.set(pkt.payload, ROUTING_ENVELOPE_SIZE);

    return buffer;
}

/**
 * Decode v0x01.0x00 packet
 */
function decodeV1Packet(bytes) {
    if (bytes.length < ROUTING_ENVELOPE_SIZE) {
        throw new Error("Packet too small");
    }

    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const packetLength = view.getUint16(2, false);

    if (packetLength !== bytes.length) {
        throw new Error("Packet length mismatch");
    }

    const payload = bytes.slice(ROUTING_ENVELOPE_SIZE);

    const new_pkt = {
        version: { major: MAJOR_BINARY, minor: bytes[1] },
        spread: bytes[4],
        ttl: bytes[5],
        type: PACKET_TYPES[bytes[6]],
        flags: bytes[7],
        from: {
            node_id: bytesToUuid(bytes.slice(8, 24)),
            conn_id: bytesToUuid(bytes.slice(24, 40))
        },
        message_id: bytesToUuid(bytes.slice(72, 88)),
        payload
    };
    let destination = {
        id: bytesToUuid(bytes.slice(40, 56)),
        sub_id: bytesToUuid(bytes.slice(56, 72))
    };
    switch (new_pkt.type) {
        case 'control': 
        case 'directed': 
            new_pkt.to = {
                node_id: destination.id,
                conn_id: destination.sub_id
            }
            break;
        case 'broadcast': 
            new_pkt.to = {
                group_id: destination.id,
                message_type: destination.sub_id
            }
            break;
    }

    return new_pkt;
}

/* ------------------------------------------------------------------ *
 * v0x7B JSON Encoding
 * ------------------------------------------------------------------ */

/**
 * Encode v0x7B JSON packet
 */
/**
 * Encode v0x7B JSON packet
 *
 * Rules:
 * - Always emit encoded_payload
 * - payload may be arbitrary JS value or binary
 * - encoded_payload may be supplied directly (base64 string)
 */
function encodeV7BPacket(pkt) {
    if (typeof pkt !== 'object' || pkt === null) {
        throw new Error('Packet must be an object');
    }
    
    let payload_data;
    if (pkt.payload instanceof Uint8Array) {
        payload_data = pkt.payload;
    } else if (typeof pkt.payload == 'undefined' || pkt.payload == null) {
        payload_data = new Uint8Array(0) 
    } else {
        payload_data = new TextEncoder().encode(JSON.stringify(pkt.payload));
    }

    if (payload_data.length > MAX_PAYLOAD_SIZE) {
        throw new Error("Payload exceeds 60 KiB limit");
    }

    const pkt_header = {
        spread: pkt.spread ?? 0,
        ttl: pkt.ttl,
        type: pkt.type,
        flags: pkt.flags ?? 0,
        from: pkt.from,
        to: pkt.to,
        message_id: pkt.message_id ?? uuidv4()
    };

    // Normalize numeric packet types to string form if needed
    if (typeof pkt.type === 'number') {
        pkt_header.type = PACKET_TYPES[pkt.type];
    }

    if (!validateRequiredFieldsByType(pkt_header, pkt.payload, false)) {
        throw new Error('Invalid message to agent (v0x7B)');
    }

    // now we JSON encode our packet header.
    let header = new TextEncoder().encode(JSON.stringify(pkt_header));

    if (header.length > MAX_JSON_ENVELOPE_SIZE) {
        throw new Error("JSON header too large");
    }
    const totalLength = JSON_FRAME_PREFIX_LENGTH + header.length + payload_data.length; 
    
    const buffer = new Uint8Array(totalLength);
    const view = new DataView(buffer.buffer);

    buffer[0] = MAJOR_JSON;
    buffer[1] = MINOR_JSON;
    // we'll need to figure out our sizes first.
    view.setUint16(2, totalLength, false); // network byte order
    view.setUint16(4, header.length, false);
    buffer.set(header, JSON_FRAME_PREFIX_LENGTH);
    buffer.set(payload_data,  JSON_FRAME_PREFIX_LENGTH + header.length);

    return buffer;
}


/* Example 0x7b packet

{ 
    "version": {
      "major": 123,
      "minor": 0
    },
    "spread": 0,
    "ttl": 8,
    "type": 'broadcast',
    "flags": 0
    "from": {
      "node_id": "00000000-0000-0000-0000-000000000000",
      "conn_id": "00000000-0000-0000-0000-000000000000",
    },
    "to": {
      "node_id": "uuid",
      "conn_id": "uuid"
    },
    "to": {
      "group_id": "00000000-0000-0000-0000-000000000000"
      "message_type": "00000000-0000-0000-0000-000000000000"
    },
    "encoded_payload": "<base64 string>"
}
*/


/**
 * Decode v0x7B JSON packet
 */
/**
 * Decode v0x7B JSON packet
 *
 * Rules:
 * - Always expect encoded_payload on the wire
 * - Always decode it to Uint8Array
 * - Never auto-JSON-parse payload
 */
function decodeV7BPacket(buffer) {
    if (!(buffer instanceof Uint8Array)) {
        throw new Error('Packet must be a Uint8Array');
    }

    if (buffer.length < JSON_FRAME_PREFIX_LENGTH) {
        throw new Error('Packet too short');
    }

    const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);

    const major = buffer[0];
    const minor = buffer[1];

    if (major !== MAJOR_JSON || minor !== MINOR_JSON) {
        throw new Error(`Unsupported JSON packet version ${major}.${minor}`);
    }

    const packetLength = view.getUint16(2, false); // network byte order

    if (packetLength !== buffer.length) {
        throw new Error('Packet length mismatch');
    }

    const headerLength = view.getUint16(4, false);

    if (headerLength <= 0 || headerLength > MAX_JSON_ENVELOPE_SIZE) {
        throw new Error('Invalid JSON header length');
    }

    const headerStart = JSON_FRAME_PREFIX_LENGTH;
    const headerEnd = headerStart + headerLength;

    if (headerEnd > buffer.length) {
        throw new Error('Header exceeds packet bounds');
    }

    let header;
    try {
        const headerBytes = buffer.subarray(headerStart, headerEnd);
        const headerText = new TextDecoder().decode(headerBytes);
        header = JSON.parse(headerText);
    } catch (err) {
        throw new Error('Failed to parse JSON header');
    }

    const payloadStart = headerEnd;
    const payloadLength = buffer.length - payloadStart;

    if (payloadLength > MAX_PAYLOAD_SIZE) {
        throw new Error('Payload exceeds 60 KiB limit');
    }

    const payload = buffer.subarray(payloadStart); // zero-copy view

    // Validate header semantics now that we have it
    if (!validateRequiredFieldsByType(header, payload, true)) {
        throw new Error('Invalid message from agent (v0x7B)');
    }

    return {
        ...header,
        version: {
            major,
            minor
        },
        payload
    };
}

export function decodeJsonPayload(msg) {
    const text = new TextDecoder().decode(msg.payload);
    return JSON.parse(text);
}

/* ------------------------------------------------------------------ *
 * Utilities
 * ------------------------------------------------------------------ */

function toUint8Array(input) {
    if (input instanceof Uint8Array) return input;
    if (input instanceof ArrayBuffer) return new Uint8Array(input);
    throw new Error("Expected Uint8Array or ArrayBuffer");
}

export default {
    decodePacket,
    encodePacket,
    decodeJsonPayload
};
