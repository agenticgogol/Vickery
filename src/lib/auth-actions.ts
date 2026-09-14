"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { prisma } from "./prisma";
import { createSession, destroySession } from "./session";

function rolePath(role: string) {
  return role === "owner" ? "/owner" : role === "advertiser" ? "/advertiser" : "/admin";
}

export async function login(formData: FormData) {
  const userId = String(formData.get("userId") ?? "");
  const password = String(formData.get("password") ?? "");
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !(await bcrypt.compare(password, user.passwordHash)))
    throw new Error("Invalid demo account or password.");
  await createSession(user.id, user.role);
  redirect(rolePath(user.role));
}

export async function logout() {
  await destroySession();
  redirect("/login");
}
