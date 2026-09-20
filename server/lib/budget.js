// Per-click NVIDIA call budget. A single user click (one route handler run)
// may trigger several model calls (primary + retry + fallback, then another
// task); the budget caps total OUTBOUND NVIDIA calls at 4. Pollinations and
// cache hits never touch the budget.

import { AiError, AI_CODES } from '../providers/AiError.js';

export function createBudget(max = 4) {
  return { max, used: 0 };
}

export function budgetExceeded() {
  const err = new AiError(
    AI_CODES.BUSY,
    'That took too many tries to get through. Try again, or type the concept instead.',
    { status: 502, retryable: false }
  );
  err.noFallback = true; // failing over cannot help: this click's budget is spent
  return err;
}
