// lib/opensearch.js
import { Client } from "@opensearch-project/opensearch";

const node = process.env.OPENSEARCH_URL || "http://localhost:9200";

// Bonsai: keep creds OUT of the URL, pass via auth instead
const username = process.env.OPENSEARCH_USERNAME;
const password = process.env.OPENSEARCH_PASSWORD;

const client = new Client({
  node,
  ...(username && password
    ? {
        auth: { username, password },
        ssl: { rejectUnauthorized: true }, // Bonsai uses valid TLS
      }
    : {}),
});

export default client;
