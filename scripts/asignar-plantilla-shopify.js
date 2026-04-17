/**
 * scripts/asignar-plantilla-shopify.js
 * Asigna la plantilla "medicion-pupilar" a todos los productos
 * de las colecciones especificadas.
 *
 * Variables de entorno requeridas:
 *   SHOPIFY_SHOP
 *   SHOPIFY_ACCESS_TOKEN
 */

const SHOP = process.env.SHOPIFY_SHOP || "a16f5d-dd.myshopify.com";
const ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;
const API_VERSION = "2025-10";
const TEMPLATE = "medicion-pupilar";

const COLLECTION_HANDLES = [
  "lentes-de-vista-unisex",
  "exchange-armani-vista",
];

if (!SHOP || !ACCESS_TOKEN) {
  console.error("❌ Faltan las variables de entorno SHOPIFY_SHOP o SHOPIFY_ACCESS_TOKEN");
  process.exit(1);
}

const BASE_URL = `https://${SHOP}/admin/api/${API_VERSION}`;
const GRAPHQL_URL = `${BASE_URL}/graphql.json`;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function request(path, method = "GET", body = null) {
  const opts = {
    method,
    headers: {
      "X-Shopify-Access-Token": ACCESS_TOKEN,
      "Content-Type": "application/json",
    },
  };

  if (body) {
    opts.body = JSON.stringify(body);
  }

  const res = await fetch(`${BASE_URL}${path}`, opts);
  const text = await res.text();

  if (!res.ok) {
    throw new Error(`HTTP ${res.status} en ${path}: ${text}`);
  }

  return text ? JSON.parse(text) : {};
}

async function graphqlRequest(query, variables = {}) {
  const res = await fetch(GRAPHQL_URL, {
    method: "POST",
    headers: {
      "X-Shopify-Access-Token": ACCESS_TOKEN,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, variables }),
  });

  const text = await res.text();
  let data;

  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`Respuesta no JSON de GraphQL: ${text}`);
  }

  if (!res.ok) {
    throw new Error(`GraphQL HTTP ${res.status}: ${text}`);
  }

  if (data.errors) {
    throw new Error(`GraphQL errors: ${JSON.stringify(data.errors)}`);
  }

  return data;
}

async function testAuth() {
  console.log("SHOP:", SHOP);
  console.log("TOKEN?", !!ACCESS_TOKEN);
  console.log("TOKEN PREFIX:", ACCESS_TOKEN?.slice(0, 8));
  console.log("TOKEN SUFFIX:", ACCESS_TOKEN?.slice(-6));

  const data = await graphqlRequest(`
    {
      shop {
        name
      }
    }
  `);

  const shopName = data?.data?.shop?.name;

  if (!shopName) {
    throw new Error(`Autenticación válida pero no se pudo leer shop.name. Respuesta: ${JSON.stringify(data)}`);
  }

  console.log(`✅ Auth OK. Tienda: ${shopName}`);
}

async function getCollectionIdByHandle(handle) {
  const query = `
    query GetCollectionByHandle($query: String!) {
      collections(first: 10, query: $query) {
        nodes {
          id
          title
          handle
        }
      }
    }
  `;

  const data = await graphqlRequest(query, {
    query: `handle:${handle}`,
  });

  const collections = data?.data?.collections?.nodes || [];
  const col = collections.find((c) => c.handle === handle) || collections[0];

  console.log("🔎 Resultado colecciones:", JSON.stringify(collections, null, 2));

  if (!col) {
    throw new Error(`Colección no encontrada con handle "${handle}"`);
  }

  console.log(`  ✔ Colección encontrada: "${col.title}" (Handle: ${col.handle}, ID: ${col.id})`);
  return col.id.split("/").pop();
}

async function getAllProductsInCollection(collectionId) {
  const data = await request(
    `/collections/${collectionId}/products.json?limit=250&fields=id,title,template_suffix`
  );

  return data.products || [];
}

async function updateProductTemplate(productId, productTitle) {
  await request(`/products/${productId}.json`, "PUT", {
    product: {
      id: productId,
      template_suffix: TEMPLATE,
    },
  });

  console.log(`    ✔ Actualizado: "${productTitle}"`);
}

async function main() {
  await testAuth();

  console.log(`\n🔧 Asignando plantilla "${TEMPLATE}"...\n`);

  let actualizados = 0;
  let omitidos = 0;

  for (const handle of COLLECTION_HANDLES) {
    console.log(`\n📂 Colección: "${handle}"`);

    const collectionId = await getCollectionIdByHandle(handle);
    const products = await getAllProductsInCollection(collectionId);

    console.log(`  → ${products.length} producto(s)`);

    for (const product of products) {
      if (product.template_suffix === TEMPLATE) {
        console.log(`    ⏭ Sin cambios: "${product.title}"`);
        omitidos++;
        continue;
      }

      await updateProductTemplate(product.id, product.title);
      actualizados++;
      await sleep(500);
    }
  }

  console.log(`\n✅ Listo. Actualizados: ${actualizados} | Sin cambios: ${omitidos}`);
}

main().catch((err) => {
  console.error("\n❌ Error:", err.message);
  process.exit(1);
});
