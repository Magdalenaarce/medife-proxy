/**
 * scripts/asignar-plantilla-shopify.js
 * Asigna la plantilla "medicion-pupilar" a todos los productos
 * de las colecciones especificadas.
 *
 * Variables de entorno requeridas (definidas como GitHub Secrets):
 *   SHOPIFY_SHOP          → ej: mi-tienda.myshopify.com
 *   SHOPIFY_ACCESS_TOKEN  → ej: shpat_xxxxxxxxxxxx
 */

const SHOP = "a16f5d-dd.myshopify.com";
const ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;
const TEMPLATE = "medicion-pupilar";

const COLLECTION_HANDLES = [
  "lentes-de-vista-unisex",
];

console.log("SHOP:", SHOP);
console.log("TOKEN?", !!ACCESS_TOKEN);
console.log("TOKEN PREFIX:", ACCESS_TOKEN?.slice(0, 8));
console.log("TOKEN SUFFIX:", ACCESS_TOKEN?.slice(-6));
if (!SHOP || !ACCESS_TOKEN) {
  console.error("❌ Faltan las variables de entorno SHOPIFY_SHOP o SHOPIFY_ACCESS_TOKEN");
  process.exit(1);
}
const SHOP = "a16f5d-dd.myshopify.com";
const ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;

const res = await fetch(`https://${SHOP}/admin/api/2025-10/graphql.json`, {
  method: "POST",
  headers: {
    "X-Shopify-Access-Token": ACCESS_TOKEN,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    query: `{
      shop {
        name
      }
    }`,
  }),
});

console.log("STATUS:", res.status);
console.log(await res.text());
const BASE_URL = `https://${SHOP}/admin/api/2023-10`;

async function request(path, method = "GET", body = null) {
  const opts = {
    method,
    headers: {
      "X-Shopify-Access-Token": ACCESS_TOKEN,
      "Content-Type": "application/json",
    },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${BASE_URL}${path}`, opts);
  if (!res.ok) throw new Error(`HTTP ${res.status} en ${path}: ${await res.text()}`);
  return res.json();
}

async function getCollectionIdByHandle(handle) {
  const query = `
    query GetCollectionByHandle($query: String!) {
      collections(first: 1, query: $query) {
        nodes {
          id
          title
          handle
        }
      }
    }
  `;

  const res = await fetch(`https://${SHOP}/admin/api/2023-10/graphql.json`, {
    method: "POST",
    headers: {
      "X-Shopify-Access-Token": ACCESS_TOKEN,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query,
      variables: {
        query: `handle:${handle}`,
      },
    }),
  });

  const data = await res.json();

  if (data.errors) {
    throw new Error(`GraphQL errors: ${JSON.stringify(data.errors)}`);
  }

  const col = data?.data?.collections?.nodes?.[0];

  console.log(JSON.stringify(data, null, 2));

  if (!col) {
    throw new Error(`Colección no encontrada con handle "${handle}". Respuesta: ${JSON.stringify(data)}`);
  }

  console.log(`  ✔ Colección encontrada: "${col.title}" (ID: ${col.id})`);
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
    product: { id: productId, template_suffix: TEMPLATE },
  });
  console.log(`    ✔ Actualizado: "${productTitle}"`);
}

async function main() {
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
        console.log(`    ⏭  Sin cambios: "${product.title}"`);
        omitidos++;
        continue;
      }
      await updateProductTemplate(product.id, product.title);
      actualizados++;
      await new Promise((r) => setTimeout(r, 500));
    }
  }

  console.log(`\n✅ Listo. Actualizados: ${actualizados} | Sin cambios: ${omitidos}`);
}

main().catch((err) => {
  console.error("\n❌ Error:", err.message);
  process.exit(1);
});
