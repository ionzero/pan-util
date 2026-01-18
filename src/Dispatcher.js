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

const DISPATCH_METHODS = [
    'on',
    'once',
    'off',
    'emit',
    'waitFor'
];

export function attachDispatcher(target) {
    if (target === null || typeof target !== 'object') {
        throw new TypeError('attachDispatcher target must be an object');
    }

    for (const name of DISPATCH_METHODS) {
        if (Object.prototype.hasOwnProperty.call(target, name)) {
            throw new Error(
                `attachDispatcher conflict: target already has property "${name}"`
            );
        }
    }

    const handlers = new Map();

    function get(event) {
        let set = handlers.get(event);
        if (!set) {
            set = new Set();
            handlers.set(event, set);
        }
        return set;
    }

    target.on = function (event, fn) {
        if (typeof fn !== 'function') {
            throw new TypeError('handler must be a function');
        }
        get(event).add(fn);
        return target;
    };

    target.once = function (event, fn) {
        if (typeof fn !== 'function') {
            throw new TypeError('handler must be a function');
        }

        const wrapper = (...args) => {
            target.off(event, wrapper);
            fn(...args);
        };

        get(event).add(wrapper);
        return target;
    };

    target.off = function (event, fn) {
        const set = handlers.get(event);
        if (!set) {
            return target;
        }

        set.delete(fn);

        if (set.size === 0) {
            handlers.delete(event);
        }

        return target;
    };

    target.emit = function (event, ...args) {
        const set = handlers.get(event);
        if (!set || set.size === 0) {
            return false;
        }

        const snapshot = Array.from(set);

        for (const fn of snapshot) {
            setTimeout(() => {
                try {
                    fn(...args);
                } catch (err) {
                    console.warn(`Dispatch handler error for "${event}"`, err);
                }
            }, 0);
        }

        return true;
    };

    target.waitFor = function (event, { timeout, match } = {}) {
        return new Promise((resolve, reject) => {
            let timer = null;

            const handler = (...args) => {
                try {
                    if (typeof match === 'function' && match(args) !== true) {
                        return;
                    }
                } catch (err) {
                    cleanup();
                    reject(err);
                    return;
                }

                cleanup();
                resolve(args);
            };

            const cleanup = () => {
                target.off(event, handler);
                if (timer !== null) {
                    clearTimeout(timer);
                }
            };

            target.on(event, handler);

            if (typeof timeout === 'number') {
                timer = setTimeout(() => {
                    cleanup();
                    reject(new Error(`Timeout waiting for "${event}"`));
                }, timeout);
            }
        });
    };

    return target;
}

export default {
    attachDispatcher
};
