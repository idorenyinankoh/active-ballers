import { createHmac, timingSafeEqual } from "node:crypto";
import { store, weekId, json } from "./_lib.mjs";

const SECRET = process.env.WEBHOOK_SECRET;

// Optional: if the payment provider signs requests (HMAC-SHA512 of raw body, as Paystack does),
// set SIGNATURE_HEADER (e.g. "x-paystack-signature") and SIGNATURE_KEY.
function signatureOk(req, raw) {
  const header = process.env.SIGNATURE_HEADER;
  if (!header) return true;
  const got = req.headers.get(header) || "";
  const want = createHmac("sha512", process.env.SIGNATURE_KEY || "").update(raw).digest("hex");
  return got.length === want.length && timingSafeEqual(Buffer.from(got), Buffer.from(want));
}

// Map the provider's payload to our shape. ADJUST once the real payload is known.
function extract(body) {
  const d = body.data ?? body;
  const name =
    d.metadata?.player_name ?? d.customer?.name ??
    [d.customer?.first_name, d.customer?.last_name].filter(Boolean).join(" ") ??
    d.name;
  const reference = d.reference ?? d.tx_ref ?? d.id ?? body.reference;
  const paidAt = d.paid_at ?? d.paidAt ?? d.created_at ?? new Date().toISOString();
  const status = String(d.status ?? body.event ?? "success").toLowerCase();
  const ok = /success|paid|complete|charge\.success/.test(status);
  return { name: name?.trim(), reference: reference && String(reference), paidAt, ok };
}

export default async (req) => {
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  // Shared-secret check: webhook URL is /api/webhook?token=<WEBHOOK_SECRET>
  if (!SECRET || new URL(req.url).searchParams.get("token") !== SECRET)
    return json({ error: "unauthorized" }, 401);

  const raw = await req.text();
  if (!signatureOk(req, raw)) return json({ error: "bad signature" }, 401);

  let body;
  try { body = JSON.parse(raw); } catch { return json({ error: "bad json" }, 400); }

  const p = extract(body);
  if (!p.ok) return json({ ignored: "not a successful payment" });
  if (!p.name || !p.reference) {
    console.error("Unrecognised payload", raw);
    return json({ error: "missing name or reference" }, 422);
  }

  const paidAt = new Date(p.paidAt);
  const when = isNaN(paidAt) ? new Date() : paidAt;
  const key = `${weekId(when)}/${p.reference}`; // same reference twice = overwritten, so no duplicates
  await store().setJSON(key, { name: p.name, paidAt: when.toISOString(), reference: p.reference });
  return json({ ok: true });
};
