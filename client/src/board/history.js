// Snapshot-based undo/redo. Elements are treated as immutable; each step stores
// a deep clone of the elements array. Cap at 100 steps; new push clears redo.

import { cloneElements } from './elements.js';

export function createHistory(limit = 100) {
  let past = [[]]; // stack of snapshots, past[past.length-1] is current
  let future = [];

  function current() {
    return cloneElements(past[past.length - 1]);
  }

  function push(elements) {
    past.push(cloneElements(elements));
    if (past.length > limit + 1) {
      past = past.slice(past.length - (limit + 1));
    }
    future = []; // any new action after undo clears the redo stack
  }

  function undo() {
    if (past.length <= 1) return null;
    const cur = past.pop();
    future.push(cur);
    return current();
  }

  function redo() {
    if (future.length === 0) return null;
    const next = future.pop();
    past.push(next);
    return current();
  }

  function canUndo() {
    return past.length > 1;
  }

  function canRedo() {
    return future.length > 0;
  }

  function reset() {
    past = [[]];
    future = [];
  }

  return { current, push, undo, redo, canUndo, canRedo, reset };
}
