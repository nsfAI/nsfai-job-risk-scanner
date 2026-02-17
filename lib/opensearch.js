import { Client } from "@opensearch-project/opensearch";

const client = new Client({
  node: "http://localhost:9200",
});

export default client;
