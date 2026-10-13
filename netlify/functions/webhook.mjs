import { store, weekId, addWeeks, json, PRICE_PER_WEEK, MAX_WEEKS } from "./_lib.mjs";

const SECRET = process.env.WEBHOOK_SECRET;

// Flutterwave sends the "secret hash" you set in the dashboard in the `verif-hash` header.
function hashOk(req) {
  const want = process.env.FLW_SECRET_HASH;
  return !want || req.headers.get("verif-hash") === want;
}

// Ask Flutterwave directly whether this payment really succeeded (defeats forged webhooks).
async function verified(tx_ref, minAmount) {
  const key = process.env.FLW_SECRET_KEY;
  if (!key) return true; // local testing without a key
  const res = await fetch(
    `https://api.ravepay.co/v3/transactions/verify_by_reference?tx_ref=${encodeURIComponent(tx_ref)}`,
    { headers: { Authorization: `Bearer ${key}` } },
  );
  const b = await res.json().catch(() => ({}));
  const d = b.data;
  return !!d && d.status === "successful" && d.tx_ref === tx_ref && d.currency === "NGN" && Number(d.amount) >= minAmount;
}

export default async (req) => {
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  if (!SECRET || new URL(req.url).searchParams.get("token") !== SECRET)
    return json({ error: "unauthorized" }, 401);
  if (!hashOk(req)) return json({ error: "bad hash" }, 401);

  let body;
  try { body = JSON.parse(await req.text()); } catch { return json({ error: "bad json" }, 400); }

  const d = body.data ?? body;
  const tx_ref = d.tx_ref && String(d.tx_ref);
  const status = String(d.status ?? "").toLowerCase();
  if (!tx_ref) return json({ ignored: "no tx_ref" });
  if (!/^(successful|success|completed)$/.test(status)) return json({ ignored: "not successful" });
  const weeks = Number(/-(\d)w-/.exec(tx_ref)?.[1] ?? 1);
  if (weeks < 1 || weeks > MAX_WEEKS) return json({ ignored: "bad tx_ref" });
  if (!(await verified(tx_ref, weeks * PRICE_PER_WEEK))) { console.error("Verification failed", tx_ref); return json({ error: "not verified" }, 422); }

  // Name as entered/confirmed by the payer at Flutterwave checkout.
  const name = String(d.customer?.name ?? "").trim().replace(/\s+/g, " ") || `Player (${tx_ref.slice(-6)})`;

  const t = new Date(d.created_at ?? Date.now());
  const paidAt = isNaN(t) ? new Date() : t;
  // One entry per week bought (this week + following weeks), all pointing at the real payment time.
  // Same tx_ref delivered twice just overwrites itself, so no duplicates.
  const paidWeek = weekId(paidAt);
  const s = store();
  const amount = Number(d.amount) || weeks * PRICE_PER_WEEK;
  await s.setJSON(`ledger/${tx_ref}`, { name, amount, weeks, startWeek: paidWeek, paidAt: paidAt.toISOString() });
  await Promise.all(Array.from({ length: weeks }, (_, i) =>
    s.setJSON(`${addWeeks(paidWeek, i)}/${tx_ref}`, {
      name, paidAt: paidAt.toISOString(), paidWeek, weeks, n: i + 1, reference: tx_ref,
    })));
  return json({ ok: true });
};
