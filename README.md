# @ionzero/pan-util

`pan-util` is a small collection of low-level utilities shared by PAN core components. It exists primarily to support `pan-agent` and `pan-node`, but is published as a standalone package to enable protocol-level integration and advanced use cases.

This package is intentionally minimal, dependency-light, and usable in both Node.js and browser environments.

## Important note for PAN app developers

If you are building a PAN application, you almost certainly want **`@ionzero/pan-agent`**, not this package.

`pan-util` does **not** manage connections, groups, identity, authentication, or agent lifecycle.
Those higher-level concerns are handled by `pan-agent`.

`pan-util` is meant for shared infrastructure and low-level protocol work.

## What this package is (and is not)

**pan-util is:**

* A shared support library used by PAN core components
* Focused on protocol encoding, decoding, validation, and constants
* Environment-agnostic (Node.js and browser compatible)
* Small, explicit, and intentionally unopinionated

**pan-util is not:**

* An application-facing PAN API
* A WebSocket or networking library
* An agent or node implementation
* A replacement for `pan-agent`

## Why pan-util exists

This package exists to:

* Avoid duplication between PAN agents and PAN nodes
* Keep protocol logic centralized and consistent
* Provide a clean boundary between protocol mechanics and higher-level behavior
* Allow advanced users to integrate with PAN at the wire/protocol layer

Most PAN users will never need to install this directly. That is by design.

## When you might use pan-util directly

You may want to use `pan-util` if:

* You are implementing a custom or experimental PAN agent
* You want to speak PAN protocol directly over WebSockets
* You are building tooling that inspects, relays, or proxies PAN traffic
* You want to decode PAN messages without pulling in `pan-agent`

If none of the above apply, you should likely be using `@ionzero/pan-agent`.

## Modules

### transportEncoding

Utilities for encoding and decoding PAN wire-format packets. This is the primary entry point for protocol-level integration.

Public API:

* `encodePacket(pkt)`
* `decodePacket(buffer)`
* `decodeJsonPayload(packet)`

Other helpers in this module are internal implementation details and are **not** part of the public API.

### validators

Shared helpers for validating PAN message structure and protocol invariants. These are used internally by PAN components and may also be useful when implementing custom protocol handlers.

### constants

Protocol-level constants shared across PAN components.

## Relationship to other PAN packages

* `@ionzero/pan-agent` — High-level API for building PAN applications
* `@ionzero/pan-node` — PAN network node implementation
* `@ionzero/pan-util` — Shared low-level utilities used by both

These packages are designed as layers. Most developers should interact only with `pan-agent`.

## Stability and versioning

`pan-util` tracks the PAN protocol. Public exports are stable within a major version, but internal behavior may evolve as the protocol evolves.

Only the explicitly exported APIs should be considered supported.

## License

BSD 3-Clause License
