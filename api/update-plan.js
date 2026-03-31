// api/update-plan.js
const SHOPIFY_STORE = "tu-tienda.myshopify.com";
const SHOPIFY_TOKEN = process.env.SHOPIFY_ADMIN_TOKEN; // Admin API token
const NAMESPACE_PLAN = "medife"; // El namespace de tus metafields

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const { customerId, planId, planNombre, planHandle } = req.body;
  if (!customerId || !planId)
    return res.status(400).json({ error: "Faltan datos" });

  const customerGid = `gid://shopify/Customer/${customerId}`;

  // 1. Actualizar metafields (plan y plan_2)
  const metafieldsQuery = `
    mutation customerMetafieldsSet($metafields: [MetafieldsSetInput!]!) {
      metafieldsSet(metafields: $metafields) {
        metafields { key namespace value }
        userErrors { field message }
      }
    }
  `;

  const metafieldsVars = {
    metafields: [
      {
        ownerId: customerGid,
        namespace: NAMESPACE_PLAN,
        key: "plan",
        value: planNombre,
        type: "single_line_text_field",
      },
      {
        ownerId: customerGid,
        namespace: NAMESPACE_PLAN,
        key: "plan_2",
        value: planId, // GID del metaobjeto
        type: "metaobject_reference",
      },
    ],
  };

  // 2. Agregar tags al cliente
  const tagsQuery = `
    mutation tagsAdd($id: ID!, $tags: [String!]!) {
      tagsAdd(id: $id, tags: $tags) {
        node { id }
        userErrors { field message }
      }
    }
  `;

  const headers = {
    "Content-Type": "application/json",
    "X-Shopify-Access-Token": SHOPIFY_TOKEN,
  };

  const shopifyUrl = `https://${SHOPIFY_STORE}/admin/api/2024-10/graphql.json`;

  try {
    // Ejecutar ambas mutations en paralelo
    const [metaRes, tagsRes] = await Promise.all([
      fetch(shopifyUrl, {
        method: "POST",
        headers,
        body: JSON.stringify({
          query: metafieldsQuery,
          variables: metafieldsVars,
        }),
      }),
      fetch(shopifyUrl, {
        method: "POST",
        headers,
        body: JSON.stringify({
          query: tagsQuery,
          variables: {
            id: customerGid,
            tags: ["medife", planNombre, planHandle],
          },
        }),
      }),
    ]);

    const metaData = await metaRes.json();
    const tagsData = await tagsRes.json();

    const metaErrors = metaData?.data?.metafieldsSet?.userErrors || [];
    const tagsErrors = tagsData?.data?.tagsAdd?.userErrors || [];

    if (metaErrors.length > 0 || tagsErrors.length > 0) {
      console.error("Errores Shopify:", metaErrors, tagsErrors);
      return res.status(500).json({
        error: "Error al actualizar en Shopify",
        metaErrors,
        tagsErrors,
      });
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Error interno del servidor" });
  }
}
