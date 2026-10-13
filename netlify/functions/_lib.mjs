import { getStore } from "@netlify/blobs";

// Weeks run Saturday 00:00 -> Friday 23:59:59 in this timezone offset.
// Africa/Lagos is UTC+1 with no daylight saving.
const TZ_OFFSET_HOURS = Number(process.env.TZ_OFFSET_HOURS ?? 1);
const HOUR = 3600 * 1000;

export const store = () => getStore({ name: "payments", consistency: "strong" });

// Returns the Saturday (YYYY-MM-DD, local time) that starts the week containing `date`.
export function weekId(date = new Date()) {
  const local = new Date(date.getTime() + TZ_OFFSET_HOURS * HOUR);
  const sinceSaturday = (local.getUTCDay() + 1) % 7; // Sat=0, Sun=1 ... Fri=6
  local.setUTCDate(local.getUTCDate() - sinceSaturday);
  return local.toISOString().slice(0, 10);
}

export const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });

export const PRICE_PER_WEEK = Number(process.env.PRICE_PER_WEEK || 10); // naira
export const MAX_WEEKS = 4;

// Saturday (YYYY-MM-DD) that is `n` weeks after the given week id.
export function addWeeks(id, n) {
  const d = new Date(id + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + 7 * n);
  return d.toISOString().slice(0, 10);
}
