// Hand-written OpenAPI 3.1 spec for the public shop stock API (served at /openapi.json).
export function openApiSpec(serverUrl: string) {
  const product = {
    type: "object",
    required: ["sku", "title", "category", "priceAgorot"],
    properties: {
      sku: { type: "string", maxLength: 64, pattern: "^[A-Za-z0-9._-]+$", example: "LEGO-60380" },
      title: { type: "string", maxLength: 120, example: "לגו סיטי – מרכז העיר" },
      description: { type: "string", maxLength: 1000 },
      category: { type: "string", enum: ["toys", "books", "lego", "sports", "art", "games", "other"] },
      priceAgorot: { type: "integer", minimum: 0, description: "Price in agorot, VAT included (₪149.90 = 14990)", example: 14990 },
      imageUrl: { type: ["string", "null"], format: "uri" },
      ageMin: { type: ["integer", "null"], minimum: 0, maximum: 18 },
      ageMax: { type: ["integer", "null"], minimum: 0, maximum: 18 },
      active: { type: "boolean", default: true },
      stock: { type: "integer", minimum: 0, description: "Optional; sets the stock level" },
    },
  };
  const error = {
    type: "object",
    properties: { error: { type: "object", properties: { code: { type: "string" }, message: { type: "string" }, details: {} } } },
  };
  const errors = {
    "400": { description: "Validation failed", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
    "401": { description: "Missing or invalid API key", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
    "403": { description: "Shop not approved", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
    "429": { description: "Rate limited (120 requests/minute)", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
  };
  const upsertResult = { type: "object", properties: { created: { type: "integer" }, updated: { type: "integer" } } };

  return {
    openapi: "3.1.0",
    info: {
      title: "Birthday Wish List — Shop Stock API",
      version: "1.0.0",
      description:
        "Push your products and stock levels so kids can add them to their birthday wish lists. Authenticate with the `X-Api-Key` header (create or rotate the key in the shop portal → API). Keys are shown once and stored hashed.\n\n**Webhooks (optional):** set a webhook URL in the portal to receive `order.created` and `order.status_changed` events. Each request carries `X-BWL-Signature: t=<unix>,v1=<hex>` where `v1 = HMAC_SHA256(webhookSecret, t + \".\" + rawBody)`.",
    },
    servers: [{ url: serverUrl }],
    security: [{ ApiKey: [] }],
    components: {
      securitySchemes: { ApiKey: { type: "apiKey", in: "header", name: "X-Api-Key" } },
      schemas: { Product: product, Error: error, UpsertResult: upsertResult },
    },
    paths: {
      "/api/shop/products": {
        get: {
          summary: "List your products",
          responses: { "200": { description: "Products with current stock" }, ...errors },
        },
        post: {
          summary: "Create or update products (matched by sku)",
          description: "Send one product, or up to 500 as `{ \"products\": [...] }`.",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  oneOf: [
                    { $ref: "#/components/schemas/Product" },
                    { type: "object", required: ["products"], properties: { products: { type: "array", maxItems: 500, items: { $ref: "#/components/schemas/Product" } } } },
                  ],
                },
              },
            },
          },
          responses: {
            "200": { description: "Updated", content: { "application/json": { schema: { $ref: "#/components/schemas/UpsertResult" } } } },
            "201": { description: "Created", content: { "application/json": { schema: { $ref: "#/components/schemas/UpsertResult" } } } },
            ...errors,
          },
        },
      },
      "/api/shop/products/{sku}": {
        put: {
          summary: "Create or replace one product by sku",
          parameters: [{ name: "sku", in: "path", required: true, schema: { type: "string" } }],
          requestBody: { required: true, content: { "application/json": { schema: { ...product, required: ["title", "category", "priceAgorot"] } } } },
          responses: { "200": { description: "Updated" }, "201": { description: "Created" }, ...errors },
        },
      },
      "/api/shop/stock/sync": {
        post: {
          summary: "Bulk stock sync",
          description: "Set stock levels for up to 1000 SKUs at once. Unknown SKUs are returned in `unknownSkus` and ignored.",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["items"],
                  properties: {
                    items: {
                      type: "array",
                      maxItems: 1000,
                      items: { type: "object", required: ["sku", "quantity"], properties: { sku: { type: "string" }, quantity: { type: "integer", minimum: 0 } } },
                    },
                  },
                },
              },
            },
          },
          responses: {
            "200": {
              description: "Synced",
              content: { "application/json": { schema: { type: "object", properties: { updated: { type: "integer" }, unknownSkus: { type: "array", items: { type: "string" } } } } } },
            },
            ...errors,
          },
        },
      },
    },
  };
}
