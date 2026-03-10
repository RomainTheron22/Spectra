import { NextResponse } from "next/server";
import { getAuthzFromRequest } from "../../../../lib/authz";

export async function GET(request) {
  const authz = await getAuthzFromRequest(request);
  return NextResponse.json(authz, { status: 200 });
}
