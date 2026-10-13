import { randomBytes } from "node:crypto";
import { weekId, json, PRICE_PER_WEEK, MAX_WEEKS } from "./_lib.mjs";

export default async (req) => {
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  const key = process.env.FLW_SECRET_KEY;
  if (!key) return json({ error: "Payments are not configured" }, 500);

  let input = {};
  try { input = await req.json(); } catch {}
  const name = String(input.name || "").trim().replace(/\s+/g, " ").slice(0, 40);
  const email = String(input.email || "").trim().slice(0, 100);
  const phone = String(input.phone || "").replace(/[\s-]/g, "").slice(0, 20);
  const weeks = Number(input.weeks);

  if (name.length < 2) return json({ error: "Please enter your name" }, 400);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ error: "Please enter a valid email" }, 400);
  if (!/^\+?\d{7,15}$/.test(phone)) return json({ error: "Please enter a valid phone number" }, 400);
  if (!Number.isInteger(weeks) || weeks < 1 || weeks > MAX_WEEKS) return json({ error: "Choose 1 to 4 weeks" }, 400);

  // The amount is always computed here, never taken from the browser.
  const amount = (weeks * PRICE_PER_WEEK).toFixed(2);
  // Number of weeks is encoded in tx_ref so the webhook knows how many weeks were bought.
  const tx_ref = `AB-${weekId()}-${weeks}w-${randomBytes(5).toString("hex")}`;
  const site = process.env.SITE_URL || req.headers.get("origin") || new URL(req.url).origin;

  const res = await fetch("https://api.ravepay.co/v3/payments", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      tx_ref,
      amount,
      currency: "NGN",
      customer: { email, phonenumber: phone, name },
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
