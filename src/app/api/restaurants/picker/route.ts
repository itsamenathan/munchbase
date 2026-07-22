import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { getAddData } from "@/lib/data/add";

export async function GET(request: Request) {
  if (!(await currentUser())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const rawListId = Number(new URL(request.url).searchParams.get("list"));
  const listId = Number.isInteger(rawListId) && rawListId > 0 ? rawListId : null;
  return NextResponse.json(getAddData(listId));
}
