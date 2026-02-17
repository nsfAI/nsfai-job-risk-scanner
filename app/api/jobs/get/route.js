// app/api/jobs/get/route.js
import client from "../../../../lib/opensearch";

const INDEX = "jobs_v1";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return Response.json({ ok: false, error: "Missing id" }, { status: 400 });
  }

  try {
    const resp = await client.get({ index: INDEX, id });
    const src = resp?.body?._source ?? resp?._source;

    if (!src) {
      return Response.json({ ok: false, error: "Not found" }, { status: 404 });
    }

    return Response.json({ ok: true, id, job: src });
  } catch (err) {
    return Response.json(
      { ok: false, error: err?.message || "Lookup failed" },
      { status: 404 }
    );
  }
}
