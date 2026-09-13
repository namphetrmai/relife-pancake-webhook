# Relife Pancake Webhook

Authenticated Express service for Pancake order webhooks.

Set `BETA_LIFE_API_KEY` and `BETA_OIL_API_KEY` as hosting secrets. Pancake sends `Authorization: Bearer <matching key>` to `POST /api/pancake/orders/webhook`.

Health check: `GET /health`. The service returns 401 for missing or invalid keys and logs only event metadata.
