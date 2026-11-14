import { sensitiveRequestGuard } from "../server/security";
import express from "express";
import crypto from "node:crypto";
import { promisify } from "node:util";
import { readUsers, saveUsers, recordActivity } from "./content-store";
import { activityEvent } from "./activity";
import {
  USER_ROLES,
  type AccountUser,
  type StoredUser,
  type UserRole,
} from "./user-types";
const scrypt = promisify(crypto.scrypt);
let pendingHashes = 0;
async function derive(password: string, salt: string, length: number) {
  if (pendingHashes >= 4) throw Error("Password verification capacity reached");
  pendingHashes++;
  try {
    return await scrypt(password, salt, length);
  } finally {
    pendingHashes--;
  }
}
const sessions = new Map<
  string,
  { user: AccountUser; until: number; version: number; signature?: string }
>();
const attempts = new Map<string, { count: number; until: number }>();
const normalize = (value: string) => value.trim().toLowerCase();
const digest = (value: string) =>
  crypto.createHash("sha256").update(value).digest();
const cookieName = (admin: boolean) => (admin ? "areva_admin" : "areva_user");
const token = (req: express.Request, admin: boolean) =>
  req.headers.cookie
    ?.split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(cookieName(admin) + "="))
    ?.slice(cookieName(admin).length + 1) || "";
function environmentUser(): { user: AccountUser; password: string } | null {
  const password =
    process.env.ADMIN_PASSWORD ||
    (process.env.NODE_ENV !== "production" &&
    process.env.ADMIN_TEST_LOGIN === "true"
      ? "ArevaTest2026!"
      : "");
  if (password.length < 12) return null;
  const username = (process.env.ADMIN_USERNAME || "admin").trim();
  return {
    password,
    user: {
      id: "environment-admin",
      username,
      email: "",
      name: "Website administrator",
      role: "admin",
      active: true,
      environment: true,
      createdAt: null,
      updatedAt: null,
    },
  };
}
function safe(user: StoredUser): AccountUser {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    name: user.name,
    role: user.role,
    active: user.active,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}
export function currentUser(
  req: express.Request,
  admin = true,
): AccountUser | null {
  const key = token(req, admin),
    session = sessions.get(key);
  if (!session || session.until <= Date.now()) {
    sessions.delete(key);
    return null;
  }
  if (session.user.environment) {
    const env = environmentUser();
    if (
      !env ||
      env.user.username !== session.user.username ||
      digest(env.password).toString("hex") !== session.signature
    ) {
      sessions.delete(key);
      return null;
    }
    return admin ? env.user : null;
  }
  const user = readUsers().find((user) => user.id === session.user.id);
  if (
    !user?.active ||
    user.passwordVersion !== session.version ||
    user.role !== session.user.role ||
    (admin ? user.role !== "admin" : user.role === "admin")
  ) {
    sessions.delete(key);
    return null;
  }
  return safe(user);
}
export const requireAdmin: express.RequestHandler = (req, res, next) => {
  if (!currentUser(req))
    return res.status(401).json({ error: "Please sign in as an admin." });
  next();
};
async function passwordHash(password: string) {
  const passwordSalt = crypto.randomBytes(16).toString("hex");
  const key = (await derive(password, passwordSalt, 64)) as Buffer;
  return { passwordSalt, passwordHash: key.toString("hex") };
}
const validPassword = (value: unknown): value is string =>
  typeof value === "string" && value.length >= 12 && value.length <= 128;
function login(admin: boolean): express.RequestHandler {
  return async (req, res) => {
    try {
      const identifier =
        typeof req.body.username === "string"
          ? normalize(req.body.username)
          : typeof req.body.email === "string"
            ? normalize(req.body.email)
            : admin
              ? "admin"
              : "";
      const password = req.body.password;
      const env = environmentUser();
      if (
        admin &&
        !env &&
        !readUsers().some((u) => u.active && u.role === "admin")
      )
        return res.status(503).json({
          error:
            "Set ADMIN_PASSWORD on the server to at least 12 characters, then restart to enable administration.",
        });
      const key = req.ip || "local",
        now = Date.now();
      for (const [ip, attempt] of attempts)
        if (attempt.until <= now) attempts.delete(ip);
      if (!attempts.has(key) && attempts.size >= 4096) {
        res.setHeader("Retry-After", "900");
        return res
          .status(429)
          .json({ error: "Sign-in is busy. Please try again later." });
      }
      const attempted = attempts.get(key);
      if (attempted && attempted.until > now && attempted.count >= 8) {
        res.setHeader(
          "Retry-After",
          String(Math.ceil((attempted.until - now) / 1000)),
        );
        return res
          .status(429)
          .json({ error: "Too many attempts. Try again in 15 minutes." });
      }
      attempts.set(key, {
        count: attempted && attempted.until > now ? attempted.count + 1 : 1,
        until:
          attempted && attempted.until > now ? attempted.until : now + 900000,
      });
      let user: AccountUser | null = null,
        version = 0;
      if (
        identifier &&
        identifier.length <= 160 &&
        typeof password === "string" &&
        (password.length <= 128 ||
          (admin &&
            env &&
            identifier === normalize(env.user.username) &&
            password.length === env.password.length))
      ) {
        if (
          admin &&
          env &&
          identifier === normalize(env.user.username) &&
          crypto.timingSafeEqual(digest(password), digest(env.password))
        )
          user = env.user;
        else {
          const stored = readUsers().find(
            (u) =>
              normalize(u.username) === identifier ||
              (u.email && normalize(u.email) === identifier),
          );
          // Derive a key for unknown names too; never return hashes or salts to the client.
          const candidate = (await derive(
            password,
            stored?.passwordSalt || "areva-unknown-user-salt",
            64,
          )) as Buffer;
          if (
            stored?.active &&
            crypto.timingSafeEqual(
              candidate,
              Buffer.from(stored.passwordHash, "hex"),
            ) &&
            (admin ? stored.role === "admin" : stored.role !== "admin") &&
            (!req.body.role || req.body.role === stored.role)
          ) {
            user = safe(stored);
            version = stored.passwordVersion;
          }
        }
      }
      if (!user) {
        return res
          .status(401)
          .json({ error: "Incorrect username, password or account type." });
      }
      attempts.delete(key);
      for (const [id, session] of sessions)
        if (session.until < Date.now()) sessions.delete(id);
      if (sessions.size >= 2000) {
        res.setHeader("Retry-After", "60");
        return res
          .status(503)
          .json({ error: "Sign-in is busy. Please try again shortly." });
      }
      // Bound active sessions for each identity without changing other users' sessions.
      const ownSessions = [...sessions].filter(
        ([, session]) => session.user.id === user.id,
      );
      while (ownSessions.length >= 5) sessions.delete(ownSessions.shift()![0]);
      if (admin)
        recordActivity(
          activityEvent(user.username, "signed_in", "account", "Signed in"),
        );
      sessions.delete(token(req, admin));
      const sessionToken = crypto.randomBytes(32).toString("hex");
      sessions.set(sessionToken, {
        user,
        version,
        until: Date.now() + 8 * 3600000,
        ...(user.environment
          ? { signature: digest(env!.password).toString("hex") }
          : {}),
      });
      res
        .cookie(cookieName(admin), sessionToken, {
          httpOnly: true,
          sameSite: "strict",
          secure: req.secure,
          maxAge: 8 * 3600000,
          path: "/",
        })
        .json({ success: true, user });
    } catch {
      res.status(500).json({
        error: "Sign-in is temporarily unavailable. Please try again.",
      });
    }
  };
}
export const adminLogin = login(true);
export const adminLogout: express.RequestHandler = (req, res) => {
  const user = currentUser(req);
  if (user)
    recordActivity(
      activityEvent(user.username, "signed_out", "account", "Signed out"),
    );
  sessions.delete(token(req, true));
  res.clearCookie("areva_admin", { path: "/" }).json({ success: true });
};
export const publicAccountRouter = express.Router();
publicAccountRouter.use(sensitiveRequestGuard);
publicAccountRouter.post("/login", login(false));
publicAccountRouter.get("/session", (req, res) => {
  const user = currentUser(req, false);
  if (!user) return res.status(401).json({ error: "Please sign in." });
  res.json({ authenticated: true, user });
});
publicAccountRouter.post("/logout", (req, res) => {
  sessions.delete(token(req, false));
  res.clearCookie("areva_user", { path: "/" }).json({ success: true });
});

export const usersRouter = express.Router();
usersRouter.use(requireAdmin);
usersRouter.get("/", (_req, res) =>
  res.json({
    users: [
      ...(environmentUser() ? [environmentUser()!.user] : []),
      ...readUsers().map(safe),
    ],
  }),
);
usersRouter.post("/", async (req, res) => {
  try {
    const { username, email = "", name, role, password } = req.body;
    if (
      typeof username !== "string" ||
      !/^[a-z0-9][a-z0-9._@+-]{2,79}$/i.test(username.trim()) ||
      typeof name !== "string" ||
      !name.trim() ||
      name.length > 100 ||
      typeof email !== "string" ||
      email.length > 160 ||
      (email !== "" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) ||
      !Object.hasOwn(USER_ROLES, role) ||
      !validPassword(password)
    )
      return res.status(400).json({
        error:
          "Enter a name, a valid username (3–80 characters), role and password of 12–128 characters. Email is optional.",
      });
    const normalized = normalize(username),
      mail = normalize(email);
    const all = readUsers(),
      reserved = normalize(process.env.ADMIN_USERNAME || "admin");
    const identifiers = [normalized, ...(mail ? [mail] : [])];
    const conflict = () =>
      identifiers.includes(reserved) ||
      readUsers().some(
        (u) =>
          identifiers.includes(normalize(u.username)) ||
          (u.email && identifiers.includes(normalize(u.email))),
      );
    if (all.length >= 200)
      return res.status(400).json({ error: "Keep up to 200 created users." });
    if (conflict())
      return res
        .status(409)
        .json({ error: "That username or email is already in use." });
    const hashed = await passwordHash(password);
    // Recheck after asynchronous hashing so simultaneous creations cannot collide.
    if (conflict())
      return res
        .status(409)
        .json({ error: "That username or email is already in use." });
    const current = readUsers();
    if (current.length >= 200)
      return res.status(400).json({ error: "Keep up to 200 created users." });
    const actor = currentUser(req);
    if (!actor)
      return res.status(401).json({ error: "Please sign in as an admin." });
    const now = new Date().toISOString();
    const user: StoredUser = {
      id: crypto.randomUUID(),
      username: normalized,
      email: mail,
      name: name.trim(),
      role: role as UserRole,
      active: true,
      createdAt: now,
      updatedAt: now,
      passwordVersion: 1,
      ...hashed,
    };
    saveUsers(
      [...current, user],
      [
        activityEvent(
          actor.username,
          "created",
          "users",
          `${user.name} (${USER_ROLES[user.role]})`,
          { entityId: user.id, fields: ["username", "role"] },
        ),
      ],
    );
    res.status(201).json({ user: safe(user) });
  } catch {
    res
      .status(500)
      .json({ error: "The user could not be created. Please try again." });
  }
});
usersRouter.patch("/:id", async (req, res) => {
  try {
    if (
      Object.keys(req.body).some(
        (key) => !["active", "password"].includes(key),
      ) ||
      Object.keys(req.body).length === 0 ||
      (req.body.active !== undefined && typeof req.body.active !== "boolean") ||
      (req.body.password !== undefined && !validPassword(req.body.password))
    )
      return res.status(400).json({
        error:
          "Choose an active status or a new password of 12–128 characters.",
      });
    const hashed =
      req.body.password !== undefined
        ? await passwordHash(req.body.password)
        : null;
    const actor = currentUser(req);
    if (!actor)
      return res.status(401).json({ error: "Please sign in as an admin." });
    const users = readUsers(),
      index = users.findIndex((u) => u.id === req.params.id);
    if (index < 0)
      return res.status(404).json({
        error:
          "User not found. Environment-admin credentials are managed on the server.",
      });
    const user = users[index];
    if (req.body.active === false && user.id === actor.id)
      return res
        .status(400)
        .json({ error: "You cannot disable your own account." });
    if (
      req.body.active === false &&
      user.role === "admin" &&
      !environmentUser() &&
      users.filter((u) => u.active && u.role === "admin").length <= 1
    )
      return res.status(400).json({ error: "Keep at least one active admin." });
    const fields: string[] = [];
    if (req.body.active !== undefined && req.body.active !== user.active) {
      user.active = req.body.active;
      fields.push("active");
    }
    if (hashed) {
      Object.assign(user, hashed);
      fields.push("password");
    }
    if (fields.length) {
      user.passwordVersion++;
      user.updatedAt = new Date().toISOString();
      saveUsers(users, [
        activityEvent(actor.username, "updated", "users", user.name, {
          entityId: user.id,
          fields,
        }),
      ]);
    }
    res.json({ user: safe(user) });
  } catch {
    res
      .status(500)
      .json({ error: "The user could not be updated. Please try again." });
  }
});
