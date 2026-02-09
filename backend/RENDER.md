# Deploy del backend en Render (SkyMap)

## Tipo de servicio
- **Web Service**
- Runtime: **Node**

## Comandos
- **Build Command:** `npm ci` (o `npm install` si no tienes package-lock)
- **Start Command:** `npm start`

## Endpoint de prueba
- `GET /api/health` → `{ "ok": true }`

## Variables de entorno mínimas
> Ajusta según tu frontend y tu flujo.

- `NODE_ENV=production`
- `PORT` (Render lo asigna automáticamente)
- `CORS_ORIGINS` (lista separada por comas)
  - Ejemplo: `http://localhost:3000,https://tu-front.vercel.app,https://tudominio.com`
- `FRONTEND_BASE_URL` (para redirects de Stripe Checkout)
  - Ejemplo: `https://tu-front.vercel.app`

## Stripe (cuando lo conectes)
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- (Opcional) `CURRENCY=mxn`
- (Opcional) `PRICE_S_CENTS`, `PRICE_M_CENTS`, `PRICE_L_CENTS`, `PRICE_XL_CENTS`
- (Opcional) `REQUIRE_PAYMENT=false` para permitir generar PDFs sin pagar en ambientes de prueba.

## Rutas Stripe
- `POST /api/create-checkout-session`
- `POST /api/stripe/webhook` (requiere el webhook secret)
- `GET /api/payment-status?session_id=...`
