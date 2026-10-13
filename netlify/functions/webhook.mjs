import { store, weekId, json } from "./_lib.mjs";

const SECRET = process.env.WEBHOOK_SECRET;
const MIN_AMOUNT = Number(process.env.AMOUNT || 3200);

// Flutterwave sends the "secret hash" you set in the dashboard in the `verif-hash` header.
function hashOk(req) {
  const want = process.env.FLW_SECRET_HASH;
  return !want || req.headers.get("verif-hash") === want;
}

// Ask Flutterwave directly whether this payment really succeeded (defeats forged webhooks).
async function verified(tx_ref) {
  const key = process.env.FLW_SECRET_KEY;
  if (!key) return true; // local testing without a key
  const res = await fetch(
    `https://api.ravepay.co/v3/transactions/verify_by_reference?tx_ref=${encodeURIComponent(tx_ref)}`,
    { headers: { Authorization: `Bearer ${key}` } },
  );
  const b = await res.json().catch(() => ({}));
  const d = b.data;
  return !!d && d.status === "successful" && d.tx_ref === tx_ref && d.currency === "NGN" && Number(d.amount) >= MIN_AMOUNT;
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
  if (!(await verified(tx_ref))) { console.error("Verification failed", tx_ref); return json({ error: "not verified" }, 422); }

  // Name as entered/confirmed by the payer at Flutterwave checkout.
  const name = String(d.customer?.name ?? "").trim().replace(/\s+/g, " ") || `Player (${tx_ref.slice(-6)})`;

  const t = new Date(d.created_at ?? Date.now());
  const paidAt = isNaN(t) ? new Date() : t;
  // Same tx_ref delivered twice just overwrites itself, so no duplicates.
  await store().setJSON(`${weekId(paidAt)}/${tx_ref}`, { name, paidAt: paidAt.toISOString(), reference: tx_ref });
  return json({ ok: true });
};
