export const USER_ROLES = {
  admin: "Admin",
  customer: "Customer",
  architect: "Architect",
  builder: "Builder",
} as const;
export type UserRole = keyof typeof USER_ROLES;
export interface AccountUser {
  id: string;
  username: string;
  email: string;
  name: string;
  role: UserRole;
  active: boolean;
  createdAt: string | null;
  updatedAt: string | null;
  environment?: boolean;
}
export interface StoredUser extends Omit<AccountUser, "environment"> {
  passwordHash: string;
  passwordSalt: string;
  passwordVersion: number;
}
