"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { adminAccess } from "@/lib/admin/access";
import { returnToBot, setTicketStatus } from "@/lib/admin/queries";
import { getDb } from "@/lib/db";

// Server actions can be posted to from any path, so the proxy matcher alone
// doesn't cover them. Check the credentials again here.
async function requireAdmin() {
  const authorization = (await headers()).get("authorization");
  if (adminAccess(authorization) !== "granted") throw new Error("Not allowed");
}

const ticketForm = z.object({
  id: z.coerce.number().int().positive(),
  status: z.enum(["open", "closed"]),
});

export async function updateTicketStatus(formData: FormData) {
  await requireAdmin();
  const { id, status } = ticketForm.parse(Object.fromEntries(formData));
  await setTicketStatus(getDb(), id, status);
  revalidatePath("/admin", "layout");
}

export async function handBackToBot(formData: FormData) {
  await requireAdmin();
  const id = z.uuid().parse(formData.get("id"));
  await returnToBot(getDb(), id);
  revalidatePath("/admin", "layout");
}
