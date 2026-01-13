// validators.js
// PAN fast packet validators
// 
// These validators enforce basic syntactic correctness of incoming packets
// They are designed to be very fast: fail early, no allocations, minimal branching.
//
// Usage:
// - First call the appropriate validateIncomingXMessage(msg)
//   - validateIncomingAgentMessage(msg)
//   - validateIncomingAgentMessage(msg, localNodeId)
//   - validateIncomingPeerMessage(msg)
// - These return `true` (valid) or `false` (invalid)
// - If invalid, immediately close the connection.
import constants from './constants.js';

const VALID_MSG_TYPE = /^[\w\-.@]+$/u;

const MAX_TTL = 255;
const MIN_TTL = 0;

const MAX_AGENT_TTL = 1;
const MIN_AGENT_TTL = 0;

const FORCE_DEBUGGING = true;

// Ultra-fast "looks like a UUID" checker
export function isFastUuid(str) {
    return typeof str === 'string' &&
           str.length === 36 &&
           str[8] === '-' &&
           str[13] === '-' &&
           str[18] === '-' &&
           str[23] === '-';
}

// --- Universal basic field validation ---
// This is meant to do a basic validation on a packet and fail
// as quickly as possible with as little overhead as possible.
export function isValidBaseFields(msg, { fromAgent = false } = {}) {
    console.log('dddd', msg);
    FORCE_DEBUGGING && console.log('msg check');
    if (typeof msg !== 'object' || msg === null) return false;
    FORCE_DEBUGGING && console.log('msg_id check');
    console.log('eee', msg.msg_id);
    if (!isFastUuid(msg.msg_id)) return false;
    console.log('fff');
    FORCE_DEBUGGING && console.log('msg from object check');
    if (typeof msg.from !== 'object' || msg.from === null) return false;
    FORCE_DEBUGGING && console.log('msg from node_id check');
    if (!isFastUuid(msg.from.node_id)) return false;
    FORCE_DEBUGGING && console.log('msg from conn_id check');
    if (typeof msg.from.conn_id !== 'string') return false;

/*  
    FORCE_DEBUGGING && console.log('msg from msg_type check');
    if (typeof msg.msg_type !== 'string' || msg.msg_type.length > 64 || !VALID_MSG_TYPE.test(msg.msg_type)) return false;
    FORCE_DEBUGGING && console.log('msg payload check');
    if (typeof msg.payload !== 'object' || msg.payload === null) return false;
*/

    FORCE_DEBUGGING && console.log('msg ttl check');
    const ttl = Number(msg.ttl);
    const minTtl = fromAgent ? MIN_AGENT_TTL : MIN_TTL;
    const maxTtl = fromAgent ? MAX_AGENT_TTL : MAX_TTL;
    if (!Number.isInteger(ttl) || ttl < minTtl || ttl > maxTtl) return false;

    FORCE_DEBUGGING && console.log('ran the gauntlet');
    return true;
}

export function validateRequiredFieldsByType(msg, payload, fromAgent) {
    const baseValid = isValidBaseFields(msg, { fromAgent: fromAgent })

    if (!baseValid) {
        return false;
    }

    console.log("type check", msg.type);
    if (!constants.VALID_AGENT_MESSAGE_TYPES.includes(msg.type)) return false;

    switch (msg.type) {
        case 'direct':
            if (!msg.to || !isFastUuid(msg.to.node_id)) return false;
            if (!isFastUuid(msg.to.conn_id)) return false;
            return true;

        case 'broadcast':
            if (!msg.to || !isFastUuid(msg.to.group_id)) return false;
            if (!msg.to || !isFastUuid(msg.to.message_type)) return false;
            return true;

        case 'control':
            if (!msg.to || !isFastUuid(msg.to.node_id)) return false;
            if (!isFastUuid(msg.to.conn_id)) return false;
            console.log("control test", msg);
            if (!payload) return false;
            console.log("looks good");
            return true; 

        default:
            return false;
    }
}

// --- Agent-specific validation ---
export function validateAgentMessage(msg) {
    console.log("type check", msg.type);
    if (!constants.VALID_AGENT_MESSAGE_TYPES.includes(msg.type)) return false;

    switch (msg.type) {
        case 'direct':
            if (!msg.to || !isFastUuid(msg.to.node_id)) return false;
            if (typeof msg.to.conn_id !== 'string') return false;
            return true;

        case 'broadcast':
            if (!msg.to || !isFastUuid(msg.to.group_id)) return false;
            if (!msg.to || !isFastUuid(msg.to.message_type)) return false;
            return true;

        case 'control':
            console.log("control test", msg);
            if (!msg.payload) return false;
            console.log("looks good");
            return true; 

        default:
            return false;
    }
}

// --- Special agent-specific validation ---
export function validateSpecialAgentMessage(msg, localNodeId) {
    if (!constants.VALID_AGENT_MESSAGE_TYPES.includes(msg.type)) return false;

    switch (msg.type) {
        case 'direct':
            if (!msg.to || typeof msg.to.node_id !== 'string' || !isFastUuid(msg.to.node_id)) return false;
            if (typeof msg.to.conn_id !== 'string') return false;
            if (msg.to.node_id !== localNodeId || msg.to.conn_id !== localNodeId) return false;
            return true;

        case 'broadcast':
            if (!msg.to || typeof msg.to.group_id !== 'string' || !isFastUuid(msg.to.group_id)) return false;
            return true;

        case 'agent_control':
            return true; // No extra fields required

        default:
            return false;
    }
}

// --- Peer-specific validation ---
export function validateNodeMessage(msg) {
    if (!constants.VALID_NODE_MESSAGE_TYPES.includes(msg.type)) return false;

    // No extra peer fields beyond base validation at this time
    return true;
}

// --- Public functions for fast validation of incoming messages ---

export function validateMessageFromAgent(msg) {
    return isValidBaseFields(msg, { fromAgent: true }) &&
           validateAgentMessage(msg);
}

export function validateMessageToAgent(msg) {
    return isValidBaseFields(msg, { fromAgent: false }) &&
           validateAgentMessage(msg);
}

export function validateMessageFromSpecialAgent(msg, localNodeId) {
    return isValidBaseFields(msg, { fromAgent: true }) &&
           validateSpecialAgentMessage(msg, localNodeId);
}

export function validateMessageToSpecialAgent(msg, localNodeId) {
    return isValidBaseFields(msg, { fromAgent: false }) &&
           validateSpecialAgentMessage(msg, localNodeId);
}

export function validateIncomingNodeMessage(msg) {
    return isValidBaseFields(msg, { fromAgent: false }) &&
           validateNodeMessage(msg);
}

export default {
    isFastUuid,
    isValidBaseFields,
    validateAgentMessage,
    validateNodeMessage,
    validateMessageFromAgent,
    validateMessageToAgent,
    validateMessageFromSpecialAgent,
    validateMessageToSpecialAgent,
    validateIncomingNodeMessage,
    validateRequiredFieldsByType
};
