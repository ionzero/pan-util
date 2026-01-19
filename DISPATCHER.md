# Dispatcher

Dispatcher is a small utility that adds an **async, event-based interface** to an object.

At a high level:

* You attach a dispatcher to an object
* You register handlers for named events
* You emit events
* Handlers run asynchronously

That's the core model.

---

## Basic idea

You attach a dispatcher to any object and then use it like this:

```js
import { attachDispatcher } from 'pan-utils';

const obj = {};
attachDispatcher(obj);

obj.on('greet', (name) => {
    console.log('hello', name);
});

obj.emit('greet', 'world');
```

Handlers are invoked asynchronously. Emitting an event never blocks and never depends on handler behavior.

---

## Attaching a dispatcher

Dispatcher is attached using a mixin-style function:

```js
attachDispatcher(target)
```

This mutates the target object by adding the following methods:

* `on`
* `once`
* `off`
* `emit`
* `waitFor`

Dispatcher state is private to the object instance. There is no shared global state.

`attachDispatcher()` is intended to be called once, typically in a constructor. It will throw if the target already defines any of the dispatcher method names.

Example with a class:

```js
class Thing {
    constructor() {
        attachDispatcher(this);
    }
}
```

---

## Core event API

### `on(event, handler)`

Register a handler for a recurring event.

```js
obj.on('update', (data) => {
    console.log('update', data);
});
```

* Multiple handlers per event are supported
* Handlers run asynchronously
* Returns the target object for chaining

---

### `once(event, handler)`

Register a handler that runs at most once.

```js
obj.once('ready', () => {
    console.log('ready');
});
```

After the first invocation, the handler is automatically removed.

---

### `off(event, handler)`

Remove a previously registered handler.

```js
obj.off('update', handlerFn);
```

This is a no-op if the handler is not registered.

---

### `emit(event, ...data)`

Emit an event.

```js
obj.emit('update', { status: 'ok' });
```

Semantics:

* Handlers are scheduled asynchronously using `setTimeout`
* `emit()` never blocks
* Handler exceptions are caught and logged
* Other handlers continue executing normally

The set of handlers is snapshotted at emit time. Adding or removing handlers during an emit does not affect that emit.

Returns `true` if at least one handler was scheduled, otherwise `false`.

---

## Waiting for an event with `waitFor`

In some cases, you want to wait until a **previous step completes** before continuing, such as:

* waiting for authentication
* waiting for a join or handshake
* waiting for a specific response

`waitFor()` provides an async/await-friendly way to do this.

```js
const { event, data } = await obj.waitFor('ready');
```

This is intended for **one-off coordination points in linear flows**.

Event handlers (`on`) remain the primary interface for ongoing behavior.

---

### `waitFor(event | events, options)`

Wait for one of one or more events and resolve when a matching event occurs.

```js
await obj.waitFor('connected');
```

or:

```js
await obj.waitFor(['auth.ok', 'auth.failed']);
```

#### Resolution shape

`waitFor()` always resolves with an object:

```js
{
    event: 'event.name',
    data: value | [values]
}
```

* If the event emitted a single value, `data` is that value
* If the event emitted multiple values, `data` is an array

This keeps the interface consistent even when waiting on multiple possible events.

---

### Matching and correlation

When events may arrive out of order, `match` can be used to filter which event resolves the wait.

```js
await obj.waitFor('group:joined', {
    match: ({ data }) => data.groupId === expectedId
});
```

* Non-matching events are ignored
* Matching events resolve the promise
* Multiple concurrent `waitFor()` calls are supported

---

### Intentional rejection via `match`

If the `match` function throws, the promise is rejected.

This is useful both for catching programming errors and for explicitly rejecting on certain scenarios.

```js
await obj.waitFor(['auth.ok', 'auth.failed'], {
    match: ({ event, data }) => {
        if (event === 'auth.failed') {
            throw new Error(data.reason);
        }
        return true;
    }
});
```

Timeouts also cause rejection.

Protocol "failure" events themselves do not automatically reject; interpretation is left to the caller.

---

## Usage guidelines

* Use events to signal that something happened
* Use functions for decisions and return values
* Use `on()` for recurring behavior
* Use `waitFor()` for one-time coordination
* Avoid building business logic entirely out of events

---

## Why Dispatcher exists in PAN

PAN-based applications are inherently event-driven:

* agents are long-lived
* messages arrive asynchronously and out of order
* multiple outcomes are often valid

`PanAgent` and `PanGroup` both attach a Dispatcher to expose a consistent event interface for lifecycle events, direct messages, and group-level signals.

Dispatcher provides a small, predictable foundation for this model without embedding protocol logic or policy into the event layer itself.
