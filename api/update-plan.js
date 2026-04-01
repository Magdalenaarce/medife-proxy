const SHOPIFY_STORE = process.env.SHOPIFY_STORE;
const SHOPIFY_CLIENT_ID = process.env.SHOPIFY_CLIENT_ID;
const SHOPIFY_CLIENT_SECRET = process.env.SHOPIFY_CLIENT_SECRET;

let cachedToken = null;
let tokenExpiry = 0;

async function getAccessToken() {
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken;
  const res = await fetch('https://' + SHOPIFY_STORE + '/admin/oauth/access_token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: SHOPIFY_CLIENT_ID,
      client_secret: SHOPIFY_CLIENT_SECRET,
      grant_type: 'client_credentials'
    })
  });
  const data = await res.json();
  console.log('TOKEN:', JSON.stringify(data));
  cachedToken = data.access_token;
  tokenExpiry = Date.now() + (23 * 60 * 60 * 1000);
  return cachedToken;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://www.lens.com.ar');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  try {
    const { customerId, planId, planNombre, planHandle } = req.body;
    console.log('BODY:', JSON.stringify({ customerId, planId, planNombre, planHandle }));

    if (!customerId || !planId) {
      return res.status(400).json({ error: 'Faltan datos' });
    }

    const token = await getAccessToken();
    console.log('TOKEN OK:', !!token);

    const customerGid = 'gid://shopify/Customer/' + customerId;
    const shopifyUrl = 'https://' + SHOPIFY_STORE + '/admin/api/2025-01/graphql.json';
    const headers = {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': token
    };

    const metaRes = await fetch(shopifyUrl, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({
        query: `mutation metafieldsSet($metafields: [MetafieldsSetInput!]!) {
          metafieldsSet(metafields: $metafields) {
            metafields { key value }
            userErrors { field message }
          }
        }`,
        variables: {
          metafields: [
            { ownerId: customerGid, namespace: 'medife', key: 'plan', value: planNombre, type: 'single_line_text_field' },
            { ownerId: customerGid, namespace: 'medife', key: 'plan_2', value: planId, type: 'metaobject_reference' }
          ]
        }
      })
    });

    const metaData = await metaRes.json();
    console.log('META:', JSON.stringify(metaData));

    const tagsRes = await fetch(shopifyUrl, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({
        query: `mutation tagsAdd($id: ID!, $tags: [String!]!) {
          tagsAdd(id: $id, tags: $tags) {
            node { id }
            userErrors { field message }
          }
        }`,
        variables: { id: customerGid, tags: ['medife', planNombre, planHandle] }
      })
    });

    const tagsData = await tagsRes.json();
    console.log('TAGS:', JSON.stringify(tagsData));

    return res.status(200).json({ success: true });

  } catch (err) {
    console.log('ERROR:', err.message);
    return res.status(500).json({ error: err.message });
  }
};
