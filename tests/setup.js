import '@testing-library/jest-dom'
// jsdom has no IndexedDB; provide a real in-memory implementation for the storage layer.
import 'fake-indexeddb/auto'
