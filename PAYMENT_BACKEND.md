# Payment And Referral Backend Contract

GitHub Pages only hosts the public site. Payments, merchant signing keys, order state, referral rewards, and traffic events must run on a separate server or serverless service.

## Required endpoints

`POST /orders`

Accepts `{ planId, paymentMethod, referrer }` from the site. Validate the plan price server-side, create an unpaid order, then return a provider-hosted payment URL or QR-code payload. `paymentMethod` is `wechat` or `alipay`.

`POST /payments/wechat/notify`

Verify the WeChat Pay signature and order amount, then mark the order paid. Never trust browser return URLs as payment proof.

`POST /payments/alipay/notify`

Verify the Alipay signature and order amount, then mark the order paid.

`GET /entitlements`

Returns the logged-in customer's official AI credits and member expiry date.

## Referral rules

- New customer: `¥0.50` off the first paid order.
- Referrer: one official AI credit only after the payment callback is verified.
- Cap rewards per account and per device/IP; reject self-referrals.
- Store an immutable referral attribution record on order creation.

## Analytics

Record anonymous daily activity, page events, plan selection, order creation, payment success, and referral conversion. Expose DAU, conversion rate, revenue, and referral success rate only in an authenticated admin dashboard.

## Deployment options

Cloudflare Workers + D1/KV is a good fit with GitHub Pages. Supabase Edge Functions + Postgres is another option. Store WeChat Pay certificates, Alipay application private keys, database credentials, and webhook secrets only as server-side environment secrets.
