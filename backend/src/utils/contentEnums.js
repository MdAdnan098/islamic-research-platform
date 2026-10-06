/**
 * Controlled vocabularies shared by the content data layer (categories,
 * topics, articles, references). Centralized here so every service and
 * validator references the same source of truth instead of duplicating
 * literal string lists.
 */

/** Category "type" — the platform's top-level research sections. */
export const CATEGORY_TYPES = ["aqeedah", "masail"];

export const CATEGORY_STATUSES = ["active", "archived"];
export const TOPIC_STATUSES = ["active", "archived"];
export const ARTICLE_STATUSES = ["draft", "published", "archived"];

/**
 * Extensible on purpose — add new codes here as the platform adds
 * languages, no other file needs to change.
 */
export const LANGUAGES = ["ur", "en", "hi", "ar"];

/**
 * Extensible on purpose — this module only validates that a block has
 * one of these types and a safe shape; it deliberately does not enforce
 * per-type field schemas yet (see article.service.js / validate.js).
 */
export const BLOCK_TYPES = ["heading", "text", "quote", "reference", "image", "scan", "pdf", "divider"];
