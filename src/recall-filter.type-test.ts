// Type-level test for the RecallFilter surface. Compiled by `tsc --noEmit`
// (the `type-check` script; tsconfig `include` covers `src`). No runtime code
// runs here — the assertions live entirely in the type checker.
//
// Each negative case is guarded by `@ts-expect-error`: the line MUST produce a
// type error, otherwise `tsc` fails on the unused directive. The positive cases
// MUST compile cleanly. Every binding is `_`-prefixed to satisfy eslint's
// `varsIgnorePattern` (`^_`).

import type { RecallFilter } from "./recall-filter.js";

// ── Negative cases (each MUST be a type error) ──────────────────────

// `$like` is a string-only operator; not valid on a date field.
// @ts-expect-error $like invalid on date field
const _negLikeOnDate: RecallFilter = { occurred_at: { $like: "x" } };

// `$gt` is not offered on string fields (ordering operators are date-only).
// @ts-expect-error $gt invalid on string field
const _negGtOnString: RecallFilter = { source_type: { $gt: "x" } };

// Unknown operator key inside a predicate.
// @ts-expect-error unknown operator key
const _negBogusOp: RecallFilter = { source_name: { $bogus: "x" } };

// Unknown top-level field (not a system field, not `metadata.*`).
// @ts-expect-error unknown field
const _negUnknownField: RecallFilter = { not_a_field: "x" };

// Bare value on a date field must be a date value, not a number.
// @ts-expect-error wrong bare type for date field
const _negWrongBareType: RecallFilter = { occurred_at: 123 };

// ── Positive cases (each MUST compile) ──────────────────────────────

// Bare-value shorthands.
const _posBareString: RecallFilter = { source_type: "connection" };
const _posBareDateString: RecallFilter = { occurred_at: "2026-01-01T00:00:00Z" };
const _posBareDateObj: RecallFilter = { occurred_at: new Date() };

// Operator objects.
const _posDatePredicate: RecallFilter = { created_at: { $gte: "2026-01-01", $lt: new Date() } };
const _posStringPredicate: RecallFilter = { title: { $like: "%report%", $exists: true } };
const _posStringIn: RecallFilter = { source_type: { $in: ["api", "connection"] } };

// Metadata conditions.
const _posMetaPredicate: RecallFilter = { "metadata.priority": { $gte: 5 } };
const _posMetaBare: RecallFilter = { "metadata.x": "y" };

// Nested logical composition.
const _posNested: RecallFilter = {
  $and: [
    { $or: [{ source_type: "api" }, { $not: { title: "x" } }] },
    { occurred_at: { $gte: new Date() } },
  ],
};
