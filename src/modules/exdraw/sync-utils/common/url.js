import { sanitizeUrl } from "@braintree/sanitize-url";
import { escapeDoubleQuotes } from "./utils";

export const normalizeLink = link => {
  link = link.trim();
  if (!link) {
    return link;
  }
  return sanitizeUrl(escapeDoubleQuotes(link));
};

export const isLocalLink = link => {
  return !!(link?.includes(location.origin) || link?.startsWith("/"));
};
