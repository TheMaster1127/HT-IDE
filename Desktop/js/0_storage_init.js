// js/0_storage_init.js
'use strict';

// This immediately-executing async function is the core of our solution.
// It fetches all stored data from the main process ONCE on startup,
// then creates a fake `localStorage` object in the window.
// This fake object works just like the real one but reads/writes from our
// file-backed cache, making the migration seamless for the rest of the app's code.
(async () => {
    // Fetch the entire storage from the main process file.
    const initialStorageData = await window.electronAPI.storageGetAll();
    const storageCache = initialStorageData || {};

    // Redefine the global window.localStorage object with our own implementation.
    Object.defineProperty(window, 'localStorage', {
        value: {
            /**
             * Retrieves an item from our file-backed cache.
             * @param {string} key The key of the item to retrieve.
             * @returns {string|null} The value of the item, or null if not found.
             */
            getItem: function(key) {
                const value = storageCache[key];
                // The localStorage API returns null for missing keys, so we replicate that.
                return value === undefined ? null : value;
            },
            /**
             * Sets an item in our cache and tells the main process to save it to the file.
             * @param {string} key The key of the item to set.
             * @param {any} value The value to set (will be converted to a string).
             */
            setItem: function(key, value) {
                const stringValue = String(value);
                storageCache[key] = stringValue;
                // Asynchronously tell the main process to persist the change.
                window.electronAPI.storageSetItem(key, stringValue);
            },
            /**
             * Removes an item from the cache and the persistent file.
             * @param {string} key The key of the item to remove.
             */
            removeItem: function(key) {
                delete storageCache[key];
                window.electronAPI.storageRemoveItem(key);
            },
            /**
             * Clears the entire storage cache and the persistent file.
             */
            clear: function() {
                // Clear the local cache
                for (const key in storageCache) {
                    delete storageCache[key];
                }
                // Tell the main process to clear the file
                window.electronAPI.storageClear();
            },
            /**
             * Returns the name of the nth key in the storage.
             * @param {number} index The index of the key to retrieve.
             * @returns {string|null} The name of the key, or null if the index is out of bounds.
             */
            key: function(index) {
                const keys = Object.keys(storageCache);
                return keys[index] || null;
            },
            /**
             * A getter property that returns the number of items in the storage.
             * This makes `localStorage.length` work as expected.
             */
            get length() {
                return Object.keys(storageCache).length;
            }
        },
        writable: false, // Prevent other scripts from accidentally overwriting our mock localStorage
        configurable: true
    });

    // For debugging or advanced use, we can signal that our mock is ready.
    window.dispatchEvent(new Event('localStorageReady'));
})();