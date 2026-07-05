import { getIsAuthenticated } from "@/lib/auth";
import {
  isFinanceStoreConfigured,
  loadFinanceData,
  saveFinanceData,
} from "@/lib/finance-store";
import { normalizeFinanceData } from "@/lib/finance";

export const dynamic = "force-dynamic";

export async function GET() {
  const authenticated = await getIsAuthenticated();
  if (!authenticated) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isFinanceStoreConfigured()) {
    return Response.json(
      {
        error:
          "Sync storage is not configured. Add KV_REST_API_URL and KV_REST_API_TOKEN or the Upstash equivalents.",
      },
      { status: 500 },
    );
  }

  const data = await loadFinanceData();
  return Response.json({ data });
}

export async function PUT(request: Request) {
  const authenticated = await getIsAuthenticated();
  if (!authenticated) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isFinanceStoreConfigured()) {
    return Response.json(
      {
        error:
          "Sync storage is not configured. Add KV_REST_API_URL and KV_REST_API_TOKEN or the Upstash equivalents.",
      },
      { status: 500 },
    );
  }

  const body = await request.json();
  const data = normalizeFinanceData(body?.data);
  const savedData = await saveFinanceData(data);

  return Response.json({ data: savedData });
}
