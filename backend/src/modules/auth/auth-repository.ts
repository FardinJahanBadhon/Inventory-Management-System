import { prisma } from "../../lib/prisma";

// Scoped to exactly what authentication needs: a username lookup that
// includes the password hash (for login) and an id lookup that never
// selects it (for session/profile reads). This lives in the auth module
// rather than a shared "users" repository because the Users module (full
// CRUD, listing, activation) doesn't exist until Phase 7 — see
// PROJECT_RULES.md for the note on why this is a deliberate, temporary
// scope rather than reaching ahead into that module's territory.

export function findUserByUsernameWithLocation(username: string) {
  return prisma.user.findUnique({
    where: { username },
    select: {
      id: true,
      username: true,
      name: true,
      passwordHash: true,
      isActive: true,
      location: {
        select: { id: true, name: true, category: true },
      },
    },
  });
}

export function findUserByIdWithLocation(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      username: true,
      name: true,
      isActive: true,
      location: {
        select: { id: true, name: true, category: true },
      },
    },
  });
}
