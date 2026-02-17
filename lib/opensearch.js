import { Client } from "@opensearch-project/opensearch";

const OPENSEARCH_URL = process.env.OPENSEARCH_URL;

// Parse URL safely
const parsed = new URL(OPENSEARCH_URL);

const client = new Client({
  node: `${parsed.protocol}//${parsed.hostname}`,
  auth: {
    username: parsed.username,
    password: parsed.password,
  },
  ssl: {
    rejectUnauthorized: true,
  },
});

export default client;
