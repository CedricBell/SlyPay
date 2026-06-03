import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

export type SessionContext = {
  authId: string;
  email: string;
  appUser: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    role: UserRole;
    isActive: boolean;
    createdAt: Date;
  };
};

export async function getSessionAppUser(): Promise<SessionContext | null> {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user?.id || !user.email) return null;

  let appUser = await prisma.user.findUnique({ where: { id: user.id } });
  if (!appUser) {
    const seedAdmin = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
    const role =
      seedAdmin && user.email.toLowerCase() === seedAdmin
        ? UserRole.ADMIN
        : UserRole.USER;
    appUser = await prisma.user.create({
      data: {
        id: user.id,
        email: user.email.toLowerCase(),
        role,
        isActive: true,
      },
    });
  }

  if (!appUser.isActive) return null;

  const authEmail = user.email.toLowerCase();
  if (appUser.email !== authEmail) {
    appUser = await prisma.user.update({
      where: { id: user.id },
      data: { email: authEmail },
    });
  }

  return {
    authId: user.id,
    email: appUser.email,
    appUser: {
      id: appUser.id,
      email: appUser.email,
      firstName: appUser.firstName,
      lastName: appUser.lastName,
      role: appUser.role,
      isActive: appUser.isActive,
      createdAt: appUser.createdAt,
    },
  };
}
