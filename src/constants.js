// constants.js

export const VALID_AGENT_MESSAGE_TYPES = [
    'direct',
    'broadcast',
    'control'
];

export const VALID_NODE_MESSAGE_TYPES = [
    'peer_control'
];

export const VALID_SPECIAL_AGENT_MESSAGE_TYPES = [
    'direct',
    'broadcast',
    'agent_control'
];

export const ROUTING_ENVELOPE_SIZE = 88;
export const MAX_JSON_ENVELOPE_SIZE = 442;
export const MAX_PAYLOAD_SIZE = 60 * 1024;

export const NULL_ID = '00000000-0000-0000-0000-000000000000';

export function isNullId(id) {
    return id === NULL_ID;
}

export function isNullFromField(from) {
    return from &&
           isNullId(from.node_id) &&
           isNullId(from.conn_id);
}

export default {
    VALID_AGENT_MESSAGE_TYPES,
    VALID_NODE_MESSAGE_TYPES,
    VALID_SPECIAL_AGENT_MESSAGE_TYPES,
    NULL_ID,
    MAX_PAYLOAD_SIZE,
    MAX_JSON_ENVELOPE_SIZE,
    ROUTING_ENVELOPE_SIZE,
    isNullId,
    isNullFromField
};
