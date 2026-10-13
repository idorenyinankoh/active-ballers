import { store, weekId, json } from "./_lib.mjs";

export default async (req) => {
  const current = weekId();
  const week = new URL(req.url).searchParams.get("week") || current;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(week)) return json({ error: "bad week" }, 400);

  const s = store();
  const { blobs } = await s.list({ prefix: `${week}/` });
  const players = (
    await Promise.all(blobs.map((b) => s.get(b.key, { type: "json" })))
  )
    .filter(Boolean)
    .sort((a, b) => new Date(a.paidAt) - new Date(b.paidAt))
    .map(({ name, paidAt }) => ({ name, paidAt })); // never expose reference/email

  return json({ week, current, closed: week !== current, players });
};
