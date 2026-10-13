import { randomBytes } from "node:crypto";
import { weekId, json } from "./_lib.mjs";

// Email and phone are fixed; the name comes from the player and is echoed back in the webhook.
const CUSTOMER = { email: "idy.ankoh@flutterwavego.com", phonenumber: "07065299556" };
export const AMOUNT = process.env.AMOUNT || "3200.00";

export default async (req) => {
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  const key = process.env.FLW_SECRET_KEY;
  if (!key) return json({ error: "Payments are not configured" }, 500);

  let name = "";
  try { ({ name } = await req.json()); } catch {}
  name = String(name || "").trim().replace(/\s+/g, " ").slice(0, 40);
  if (name.length < 2) return json({ error: "Please enter your name" }, 400);

  const tx_ref = `AB-${weekId()}-${randomBytes(5).toString("hex")}`;
  const site = process.env.SITE_URL || req.headers.get("origin") || new URL(req.url).origin;

  const res = await fetch("https://api.ravepay.co/v3/payments", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      tx_ref,
      amount: AMOUNT,
      currency: "NGN",
      customer: { ...CUSTOMER, name },
      redirect_url: `${site}/?paid=1`,
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.status !== "success" || !body.data?.link) {
    console.error("Flutterwave error", res.status, JSON.stringify(body));
    return json({ error: "Could not start payment. Please try again." }, 502);
  }
  return json({ link: body.data.link });
};
