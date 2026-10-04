/**
 * Dependency-free validators for API request bodies.
 * Login validators check structural validity only (right shape/type/
 * length) — they intentionally never reveal whether a given email
 * actually exists. Content validators (categories/topics/articles/
 * references, added in Phase 2 Module 1) follow the same convention:
 * return a string[] of errors, empty array = valid.
 */

import { ObjectId } from "mongodb";
import { isValidSlugFormat } from "./slug.js";
import {
  CATEGORY_TYPES,
  CATEGORY_STATUSES,
  TOPIC_STATUSES,
  ARTICLE_STATUSES,
  LANGUAGES,
  BLOCK_TYPES,
  ARTICLE_SECTIONS,
} from "./contentEnums.js";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** @returns {string[]} list of validation errors (empty = valid) */
export function validateLoginInput(body) {
  const errors = [];

  if (!body || typeof body !== "object") {
    return ["Request body must be a JSON object."];
  }

  const { email, password } = body;

  if (typeof email !== "string" || email.trim().length === 0) {
    errors.push("Email is required.");
  } else if (email.length > 254 || !EMAIL_RE.test(email.trim())) {
    errors.push("Email must be a valid email address.");
  }

  if (typeof password !== "string" || password.length === 0) {
    errors.push("Password is required.");
  } else if (password.length > 256) {
    errors.push("Password is too long.");
  }

  return errors;
}

/** Safely parses a request body as JSON, returning null on failure. */
export async function safeParseJson(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

/* -------------------------------------------------------------------- */
/* Content data layer validators (categories, topics, articles,          */
/* references) — Phase 2. Each validator returns an array of             */
/* { message, code } objects (empty = valid) so callers can surface a    */
/* stable, field-specific error code (INVALID_INPUT / INVALID_STATUS /   */
/* INVALID_LANGUAGE / INVALID_BLOCK / INVALID_RELATION) instead of one   */
/* generic code for every validation failure.                            */
/* -------------------------------------------------------------------- */

export function isNonEmptyString(value, maxLength = 500) {
  return typeof value === "string" && value.trim().length > 0 && value.length <= maxLength;
}

export function isValidObjectIdString(value) {
  return typeof value === "string" && ObjectId.isValid(value);
}

function isValidEnumValue(value, allowed) {
  return typeof value === "string" && allowed.includes(value);
}

function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function err(message, code = "INVALID_INPUT") {
  return { message, code };
}

/**
 * Validates block-level structure only: every block must be a plain
 * object with a recognized `type`, and must not carry prototype-pollution
 * keys. Per-type field schemas are intentionally not enforced yet (see
 * contentEnums.js) — this module is the data foundation, not a full CMS.
 */
export function validateBlocks(blocks) {
  const errors = [];

  if (!Array.isArray(blocks)) {
    return [err("blocks must be an array.", "INVALID_BLOCK")];
  }
  if (blocks.length > 500) {
    return [err("blocks exceeds the maximum of 500 per article.", "INVALID_BLOCK")];
  }

  blocks.forEach((block, index) => {
    if (block === null || typeof block !== "object" || Array.isArray(block)) {
      errors.push(err(`blocks[${index}] must be an object.`, "INVALID_BLOCK"));
      return;
    }
    if (
      Object.prototype.hasOwnProperty.call(block, "__proto__") ||
      Object.prototype.hasOwnProperty.call(block, "constructor") ||
      Object.prototype.hasOwnProperty.call(block, "prototype")
    ) {
      errors.push(err(`blocks[${index}] contains a disallowed key.`, "INVALID_BLOCK"));
      return;
    }
    if (!isValidEnumValue(block.type, BLOCK_TYPES)) {
      errors.push(err(`blocks[${index}].type must be one of: ${BLOCK_TYPES.join(", ")}.`, "INVALID_BLOCK"));
    }
  });

  return errors;
}

export function validateCategoryInput(data, { partial = false } = {}) {
  const errors = [];
  if (!data || typeof data !== "object") return [err("Request body must be a JSON object.")];

  if (!partial || data.name !== undefined) {
    if (!isNonEmptyString(data.name, 200)) errors.push(err("name is required (max 200 characters)."));
  }
  if (!partial || data.slug !== undefined) {
    if (!isValidSlugFormat(data.slug)) {
      errors.push(err("slug must be lowercase alphanumeric with single hyphens (e.g. 'core-beliefs')."));
    }
  }
  if (data.description !== undefined && data.description !== null) {
    if (typeof data.description !== "string" || data.description.length > 2000) {
      errors.push(err("description must be a string up to 2000 characters."));
    }
  }
  if (!partial || data.type !== undefined) {
    if (!isValidEnumValue(data.type, CATEGORY_TYPES)) {
      errors.push(err(`type must be one of: ${CATEGORY_TYPES.join(", ")}.`));
    }
  }
  if (data.status !== undefined && !isValidEnumValue(data.status, CATEGORY_STATUSES)) {
    errors.push(err(`status must be one of: ${CATEGORY_STATUSES.join(", ")}.`, "INVALID_STATUS"));
  }
  if (data.ordering !== undefined && !isFiniteNumber(data.ordering)) {
    errors.push(err("ordering must be a number."));
  }

  return errors;
}

export function validateTopicInput(data, { partial = false } = {}) {
  const errors = [];
  if (!data || typeof data !== "object") return [err("Request body must be a JSON object.")];

  if (!partial || data.categoryId !== undefined) {
    if (!isValidObjectIdString(data.categoryId)) errors.push(err("categoryId must be a valid id."));
  }
  if (!partial || data.title !== undefined) {
    if (!isNonEmptyString(data.title, 300)) errors.push(err("title is required (max 300 characters)."));
  }
  if (!partial || data.slug !== undefined) {
    if (!isValidSlugFormat(data.slug)) errors.push(err("slug must be lowercase alphanumeric with single hyphens."));
  }
  if (data.status !== undefined && !isValidEnumValue(data.status, TOPIC_STATUSES)) {
    errors.push(err(`status must be one of: ${TOPIC_STATUSES.join(", ")}.`, "INVALID_STATUS"));
  }
  if (data.ordering !== undefined && !isFiniteNumber(data.ordering)) {
    errors.push(err("ordering must be a number."));
  }

  for (const [k, max] of [["intro", 5000], ["coverKey", 500]]) {
    if (data[k] !== undefined && data[k] !== null && (typeof data[k] !== "string" || data[k].length > max)) {
      errors.push(err(`${k} must be a string up to ${max} characters.`));
    }
  }
  return errors;
}

export function validateArticleInput(data, { partial = false } = {}) {
  const errors = [];
  if (!data || typeof data !== "object") return [err("Request body must be a JSON object.")];

  if (!partial || data.categoryId !== undefined) {
    if (!isValidObjectIdString(data.categoryId)) errors.push(err("categoryId must be a valid id."));
  }
  if (data.topicId !== undefined && data.topicId !== null) {
    if (!isValidObjectIdString(data.topicId)) errors.push(err("topicId must be a valid id when provided."));
  }
  if (!partial || data.title !== undefined) {
    if (!isNonEmptyString(data.title, 300)) errors.push(err("title is required (max 300 characters)."));
  }
  if (!partial || data.slug !== undefined) {
    if (!isValidSlugFormat(data.slug)) errors.push(err("slug must be lowercase alphanumeric with single hyphens."));
  }
  if (data.titleTr !== undefined && data.titleTr !== null) {
    const t = data.titleTr;
    const ok = typeof t === "object" && !Array.isArray(t)
      && Object.entries(t).every(([k, v]) => ["en", "hi", "ur"].includes(k) && typeof v === "string" && v.length <= 300);
    if (!ok) errors.push(err("titleTr must be an object with en/hi/ur strings (max 300 characters each)."));
  }
  if (!partial || data.language !== undefined) {
    if (!isValidEnumValue(data.language, LANGUAGES)) {
      errors.push(err(`language must be one of: ${LANGUAGES.join(", ")}.`, "INVALID_LANGUAGE"));
    }
  }
  if (data.status !== undefined && !isValidEnumValue(data.status, ARTICLE_STATUSES)) {
    errors.push(err(`status must be one of: ${ARTICLE_STATUSES.join(", ")}.`, "INVALID_STATUS"));
  }
  if (!partial || data.authorId !== undefined) {
    if (!isValidObjectIdString(data.authorId)) errors.push(err("authorId must be a valid id."));
  }
  if (!partial || data.blocks !== undefined) {
    errors.push(...validateBlocks(data.blocks));
  }
  if (data.references !== undefined) {
    if (!Array.isArray(data.references) || data.references.some((r) => !isValidObjectIdString(r))) {
      errors.push(err("references must be an array of valid ids.", "INVALID_RELATION"));
    }
  }

  if (data.section !== undefined && data.section !== null && !ARTICLE_SECTIONS.includes(data.section)) {
    errors.push(err(`section must be one of: ${ARTICLE_SECTIONS.join(", ")}.`));
  }
  for (const [k, max] of [["excerpt", 1000], ["seoTitle", 200], ["seoDescription", 400], ["coverKey", 500]]) {
    if (data[k] !== undefined && data[k] !== null && (typeof data[k] !== "string" || data[k].length > max)) {
      errors.push(err(`${k} must be a string up to ${max} characters.`));
    }
  }
  return errors;
}

export function validateReferenceInput(data, { partial = false } = {}) {
  const errors = [];
  if (!data || typeof data !== "object") return [err("Request body must be a JSON object.")];

  if (!partial || data.book !== undefined) {
    if (!isNonEmptyString(data.book, 300)) errors.push(err("book is required (max 300 characters)."));
  }
  if (data.author !== undefined && data.author !== null) {
    if (typeof data.author !== "string" || data.author.length > 300) {
      errors.push(err("author must be a string up to 300 characters."));
    }
  }
  if (data.volume !== undefined && data.volume !== null) {
    if (typeof data.volume !== "string" || data.volume.length > 50) {
      errors.push(err("volume must be a string up to 50 characters."));
    }
  }
  if (data.page !== undefined && data.page !== null) {
    if (typeof data.page !== "string" || data.page.length > 50) {
      errors.push(err("page must be a string up to 50 characters."));
    }
  }
  if (data.referenceText !== undefined && data.referenceText !== null) {
    if (typeof data.referenceText !== "string" || data.referenceText.length > 5000) {
      errors.push(err("referenceText must be a string up to 5000 characters."));
    }
  }
  if (data.mediaKey !== undefined && data.mediaKey !== null) {
    if (typeof data.mediaKey !== "string" || data.mediaKey.length > 500) {
      errors.push(err("mediaKey must be a string up to 500 characters."));
    }
  }

  return errors;
}

/**
 * Validates a bulk reorder payload: { items: [{ id, ordering }, ...] }.
 * Used by category/topic reorder endpoints.
 */
export function validateReorderInput(data) {
  if (!data || typeof data !== "object" || !Array.isArray(data.items)) {
    return [err("Request body must include an items array.")];
  }
  if (data.items.length === 0) return [err("items must not be empty.")];
  if (data.items.length > 500) return [err("items exceeds the maximum of 500 per request.")];

  const errors = [];
  data.items.forEach((item, index) => {
    if (!item || typeof item !== "object") {
      errors.push(err(`items[${index}] must be an object.`));
      return;
    }
    if (!isValidObjectIdString(item.id)) errors.push(err(`items[${index}].id must be a valid id.`));
    if (!isFiniteNumber(item.ordering)) errors.push(err(`items[${index}].ordering must be a number.`));
  });

  return errors;
}
