import { NextResponse } from "next/server";
import { userOrThrow } from "@/server/auth/session";
import { errorResponse } from "@/server/http/errors";
import { exportAccountData } from "@/server/services/account";

export async function GET() {
  try {
    const user = await userOrThrow();
    const data = await exportAccountData(user);
    return new NextResponse(JSON.stringify(data, null, 2), {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "content-disposition": `attachment; filename="relicario-dados-${new Date().toISOString().slice(0, 10)}.json"`,
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
