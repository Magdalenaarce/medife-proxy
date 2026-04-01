/**
 * scripts/asignar-plantilla-shopify.js
 * Asigna la plantilla "medicion-pupilar" a todos los productos
 * de las colecciones especificadas.
 *
 * Variables de entorno requeridas (definidas como GitHub Secrets):
 *   SHOPIFY_SHOP          → ej: mi-tienda.myshopify.com
 *   SHOPIFY_ACCESS_TOKEN  → ej: shpat_xxxxxxxxxxxx
 */

const SHOP = "a16f5d-dd.myshopify.com";;
const ACCESS_TOKEN = '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';
const TEMPLATE = "medicion-pupilar";

const COLLECTION_HANDLES = [
  "obra-social-a",
  "obrea-social-b",
  "obra-social-c",
];

if (!SHOP || !ACCESS_TOKEN) {
  console.error("❌ Faltan las variables de entorno SHOPIFY_SHOP o SHOPIFY_ACCESS_TOKEN");
  process.exit(1);
}

const BASE_URL = `//${SHOP}/admin/api/2023-10`;

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
  const data = await request(`/collections.json?handle=${handle}`);
  const col = data.collections?.[0];
  if (!col) throw new Error(`Colección no encontrada: "${handle}"`);
  console.log(`  ✔ Colección encontrada: "${col.title}" (ID: ${col.id})`);
  return col.id;
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
      await new Promise((r) => setTimeout(r, 500)); // respeta rate limit
    }
  }

  console.log(`\n✅ Listo. Actualizados: ${actualizados} | Sin cambios: ${omitidos}`);
}

main().catch((err) => {
  console.error("\n❌ Error:", err.message);
  process.exit(1);
});
