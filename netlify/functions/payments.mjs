import { store, json } from "./_lib.mjs";

// Every payment received (newest first) plus the running total. Email/phone are never stored.
export default async () => {
  const s = store();
  const { blobs } = await s.list({ prefix: "ledger/" });
  const payments = (await Promise.all(blobs.map((b) => s.get(b.key, { type: "json" }))))
    .filter(Boolean)
    .sort((a, b) => new Date(b.paidAt) - new Date(a.paidAt));
  const total = payments.reduce((sum, p) => sum + p.amount, 0);
  return json({ total, count: payments.length, payments });
};
