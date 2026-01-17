/*
 * Dispatcher
 *
 * Minimal async-only event dispatcher.
 *
 * Semantics:
 * - All handlers run asynchronously (setTimeout)
 * - emit() never blocks
 * - Handlers are isolated from each other
 * - Listener set is snapshotted per emit
 */

export class Dispatcher {
    constructor() {
        // Map<event, Set<handler>>
        this._handlers = new Map();
    }

    _get(event) {
        let set = this._handlers.get(event);
        if (!set) {
            set = new Set();
            this._handlers.set(event, set);
        }
        return set;
    }

    on(event, fn) {
        if (typeof fn !== 'function') {
            throw new TypeError('handler must be a function');
        }
        this._get(event).add(fn);
        return this;
    }

    once(event, fn) {
        if (typeof fn !== 'function') {
            throw new TypeError('handler must be a function');
        }

        const wrapper = (...args) => {
            this.off(event, wrapper);
            fn(...args);
        };

        this._get(event).add(wrapper);
        return this;
    }

    off(event, fn) {
        const set = this._handlers.get(event);
        if (!set) {
            return this;
        }

        set.delete(fn);

        if (set.size === 0) {
            this._handlers.delete(event);
        }

        return this;
    }

    emit(event, ...args) {
        const set = this._handlers.get(event);
        if (!set || set.size === 0) {
            return false;
        }

        // Snapshot handlers at emit time
        const handlers = Array.from(set);

        for (const fn of handlers) {
            setTimeout(() => {
                try {
                    fn(...args);
                } catch (err) {
                    // Fault isolation only; no policy
                    console.warn(`Dispatch handler error for "${event}"`, err);
                }
            }, 0);
        }

        return true;
    }
}
