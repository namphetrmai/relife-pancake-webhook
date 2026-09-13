import express from "express";

const app = express();
app.use(express.json({ limit: "1mb" }));

const port = process.env.PORT || 3000;
const credentials = new Map([
  [process.env.BETA_LIFE_API_KEY, "BETA_LIFE"],
  [process.env.BETA_OIL_API_KEY, "BETA_OIL"]
]);
credentials.delete(undefined);

function authorized(req) {
  const header = req.get("authorization") || "";
  const match = header.match(/^Bearer\\s+(.+)$/i);
  return match && credentials.has(match[1]) ? credentials.get(match[1]) : null;
}

app.get("/", (_req, res) => res.json({ ok: true, service: "relife-pancake-webhook" }));
app.get("/health", (_req, res) => res.json({ ok: true }));

app.post("/api/pancake/orders/webhook", (req, res) => {
  const account = authorized(req);
  if (!account) return res.status(401).json({ ok: false, error: "Unauthorized" });

  const payload = req.body ?? {};
  console.log(JSON.stringify({
    receivedAt: new Date().toISOString(),
    account,
    event: payload.event ?? payload.type ?? "unknown",
    id: payload.id ?? payload.order_id ?? null
  }));

  return res.status(200).json({ ok: true, account, received: true });
});

app.use((_req, res) => res.status(404).json({ ok: false, error: "Not found" }));
app.listen(port, () => console.log(`Webhook listening on port ${port}`));
