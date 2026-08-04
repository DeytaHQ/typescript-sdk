// Type-only module. Declares the structured filter surface used by `recall`
// and `ask` to narrow results by document system fields and metadata. There is
// no runtime code here — the SDK forwards `filter` to the API verbatim.
//
// Operator sets mirror the server's authoritative filter model (the string and
// date operator vocabularies). Update this module when that model changes;
// drift compiles here but fails with a 400 at runtime.

import type { TimeBound } from "./types.js";

/** A date-valued filter operand — same union as `TimeBound` (`Date | string`). */
export type FilterDateValue = TimeBound;

/** A scalar metadata operand. `null` matches an explicit null value. */
export type FilterScalar = string | number | boolean | null;

/**
 * Operators available on date-valued system fields (`occurred_at`,
 * `source_timestamp`, `created_at`). Comparisons order chronologically.
 * `$not` negates an enclosed predicate. `$exists` is intentionally not offered
 * on date fields.
 */
export interface DatePredicate {
  /** Equal to. */
  $eq?: FilterDateValue;
  /** Not equal to. */
  $ne?: FilterDateValue;
  /** Strictly after. */
  $gt?: FilterDateValue;
  /** At or after. */
  $gte?: FilterDateValue;
  /** Strictly before. */
  $lt?: FilterDateValue;
  /** At or before. */
  $lte?: FilterDateValue;
  /** Matches any of the listed values. */
  $in?: FilterDateValue[];
  /** Matches none of the listed values. */
  $nin?: FilterDateValue[];
  /** Negates the enclosed predicate for this field. */
  $not?: DatePredicate;
}

/**
 * Operators available on string-valued system fields (`source_name`,
 * `source_type`, `source_url`, `external_id`, `content_type`, `source`,
 * `title`). Ordering operators are not offered on strings; `$not` negates an
 * enclosed predicate.
 */
export interface StringPredicate {
  /** Equal to. */
  $eq?: string;
  /** Not equal to. */
  $ne?: string;
  /** Matches any of the listed values. */
  $in?: string[];
  /** Matches none of the listed values. */
  $nin?: string[];
  /** `true` requires the field to be present; `false` requires it absent. */
  $exists?: boolean;
  /** Negates the enclosed predicate for this field. */
  $not?: StringPredicate;
}

/**
 * Operators available on metadata entries addressed by `metadata.<key>`.
 * Metadata is permissive: values may be any scalar, and both equality and
 * range operators are accepted since the underlying value can be a string,
 * number, or boolean.
 */
export interface MetadataPredicate {
  /**
   * Equal to. Takes a scalar — to compare against a whole list, use the
   * bare-array form (`{ "metadata.tags": ["a", "b"] }`).
   */
  $eq?: FilterScalar;
  /**
   * Not equal to. Takes a scalar; negating whole-list equality at the field
   * level is not currently expressible.
   */
  $ne?: FilterScalar;
  /** Matches any of the listed values. */
  $in?: FilterScalar[];
  /** Matches none of the listed values. */
  $nin?: FilterScalar[];
  /** Strictly greater than. */
  $gt?: number | string;
  /** Greater than or equal to. */
  $gte?: number | string;
  /** Strictly less than. */
  $lt?: number | string;
  /** Less than or equal to. */
  $lte?: number | string;
  /** `true` requires the key to be present; `false` requires it absent. */
  $exists?: boolean;
}

/** A condition on a date field: a bare value (`$eq` shorthand) or a predicate. */
export type DateCondition = FilterDateValue | DatePredicate;

/** A condition on a string field: a bare value (`$eq` shorthand) or a predicate. */
export type StringCondition = string | StringPredicate;

/**
 * A condition on a metadata entry: a bare scalar (`$eq` shorthand), a bare
 * array, or a predicate. A bare array is compared as a single value — the
 * stored value must equal that array; it is neither a membership test nor a
 * contains-all test. Use `$in` to test the stored value against a set of
 * candidates. An empty array means the stored value must equal the empty
 * list; it is not a match-nothing filter. Whether the comparison is
 * order-sensitive follows the server's equality semantics.
 */
export type MetadataCondition = FilterScalar | FilterScalar[] | MetadataPredicate;

/**
 * The known system fields that can be filtered. Date fields accept
 * `DateCondition` (chronological operators); the rest accept `StringCondition`
 * (equality and set operators). A bare value is shorthand for `$eq`.
 */
export interface SystemFieldFilters {
  /** Domain event time the document describes. */
  occurred_at?: DateCondition;
  /** Upstream-reported source timestamp. */
  source_timestamp?: DateCondition;
  /** Server-side write time. */
  created_at?: DateCondition;
  /** Human-readable source name (the upstream provider). */
  source_name?: StringCondition;
  /** Transport class — `"connection"`, `"api"`, `"file"`, etc. */
  source_type?: StringCondition;
  /** Link-back URL to the original document. */
  source_url?: StringCondition;
  /** Stable external identifier from the upstream system. */
  external_id?: StringCondition;
  /** Content type of the document. */
  content_type?: StringCondition;
  /** Connector URI of the originating source. */
  source?: StringCondition;
  /** Document title. */
  title?: StringCondition;
}

/**
 * A terminal (leaf) filter — the non-logical variant of {@link RecallFilter}:
 * any combination of system-field conditions plus arbitrary `metadata.<key>`
 * conditions. Metadata keys are open-ended — any key prefixed with `metadata.`
 * is accepted with a `MetadataCondition` value.
 */
export type LeafFilter = SystemFieldFilters &
  Partial<Record<`metadata.${string}`, MetadataCondition>>;

/**
 * A logical composition of sub-filters. Use exactly one operator per object:
 * `$and`/`$or`/`$nor` take a list of filters; `$not` negates a single filter.
 */
export interface LogicalFilter {
  /** All listed filters must match. */
  $and?: RecallFilter[];
  /** At least one listed filter must match. */
  $or?: RecallFilter[];
  /**
   * Matches when none of the listed sub-filters match. Negating a bare-array
   * condition negates whole-list equality, so documents holding a subset of
   * those values still match.
   */
  $nor?: RecallFilter[];
  /**
   * The given filter must not match. Negating a bare-array condition negates
   * whole-list equality, so documents holding a subset of those values still
   * match.
   */
  $not?: RecallFilter;
}

/**
 * Structured filter for `recall` and `ask`, forwarded to the API verbatim.
 *
 * A filter is either a set of field conditions (a {@link LeafFilter}) or a
 * single logical operator (a {@link LogicalFilter}). Field values may be given
 * as a bare value — shorthand for `$eq` — or as an operator predicate; the
 * available operators depend on the field kind (date vs string), while
 * `metadata.*` entries accept a permissive predicate. A bare array on a
 * `metadata.*` entry is compared as a single value: the stored value must
 * equal that array, so it is neither a membership test nor a contains-all
 * test. Combine multiple filters with `$and`, `$or`, `$nor`, and `$not`.
 *
 * System-field, metadata, and logical keys may appear side by side in one
 * object; the server combines all sibling constraints with a logical AND.
 */
export type RecallFilter = LeafFilter | LogicalFilter;
