import express from "express";
import https from "https";

const app = express();
app.use(express.json({ limit: "1mb" }));

const port = process.env.PORT || 3000;
const erpEndpoint = process.env.ERP_ENDPOINT || "erp-relife-production.up.railway.app";

const credentials = new Map([
  [process.env.BETA_LIFE_API_KEY, "BETA_LIFE"],
  [process.env.BETA_OIL_API_KEY, "BETA_OIL"]
]);
credentials.delete(undefined);

function authorized(req) {
  const header = req.get("authorization") || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match && credentials.has(match[1]) ? credentials.get(match[1]) : null;
}

async function forwardToERP(account, payload) {
  return new Promise((resolve) => {
    const data = JSON.stringify({
      source: "pancake",
      account,
      timestamp: new Date().toISOString(),
      payload
    });

    const options = {
      hostname: erpEndpoint,
      port: 443,
      path: "/webhook/pancake",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(data)
      },
      timeout: 5000
    };

    const req = https.request(options, (res) => {
      let body = "";
      res.on("data", (chunk) => body += chunk);
      res.on("end", () => resolve({ ok: res.statusCode === 200, status: res.statusCode }));
    });

    req.on("error", (err) => {
      console.error("ERP forward error:", err.message);
      resolve({ ok: false, error: err.message });
    });

    req.on("timeout", () => {
      req.destroy();
      resolve({ ok: false, error: "timeout" });
    });

    req.write(data);
    req.end();
  });
}

app.get("/", (_req, res) => res.json({ ok: true, service: "relife-pancake-webhook" }));
app.get("/health", (_req, res) => res.json({ ok: true }));

app.post("/api/pancake/orders/webhook", async (req, res) => {
  const account = authorized(req);
  if (!account) return res.status(401).json({ ok: false, error: "Unauthorized" });

  const payload = req.body ?? {};
  const eventType = payload.event ?? payload.type ?? "unknown";
  const orderId = payload.id ?? payload.order_id ?? null;

  const logEntry = {
    receivedAt: new Date().toISOString(),
    account,
    event: eventType,
    id: orderId,
    amount: payload.total ?? payload.amount ?? 0
  };

  console.log(JSON.stringify(logEntry));

  // Forward to ERP asynchronously
  forwardToERP(account, payload).catch((err) => {
    console.error("Failed to forward webhook to ERP:", err);
  });

  return res.status(200).json({ ok: true, account, received: true });
});

app.use((_req, res) => res.status(404).json({ ok: false, error: "Not found" }));
app.listen(port, () => console.log(`Webhook listening on port ${port}`));
