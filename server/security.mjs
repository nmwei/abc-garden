import {
  randomBytes,
  scrypt as deriveKey,
  timingSafeEqual,
  createHash,
} from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(deriveKey);
class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.statusCode = 400;
  }
}

const parameters = { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 };
export const token = () => randomBytes(32).toString("base64url");
export const digest = (value) =>
  createHash("sha256").update(value).digest("hex");
export const DAY = 86400000;

export function phoneNumber(value) {
  if (typeof value !== "string" || !/^1[3-9]\d{9}$/.test(value))
    throw new ValidationError("请输入有效的中国大陆手机号");
  return value;
}

export function username(value) {
  if (
    typeof value !== "string" ||
    !/^[a-zA-Z][a-zA-Z0-9_]{2,23}$/.test(value)
  ) {
    throw new ValidationError(
      "用户名需为 3–24 位字母、数字或下划线，并以字母开头",
    );
  }
  return value;
}

export async function hashPassword(password) {
  if (
    typeof password !== "string" ||
    password.length < 8 ||
    password.length > 128
  ) {
    throw new ValidationError("密码长度需为 8–128 位");
  }
  const salt = randomBytes(16).toString("hex");
  const hash = await scrypt(password, salt, 64, parameters);
  return `scrypt-v1$${salt}$${hash.toString("hex")}`;
}

export async function verifyPassword(password, encoded) {
  if (typeof password !== "string" || password.length > 128) return false;
  const [version, salt, hash] = (encoded || "").split("$");
  if (
    version !== "scrypt-v1" ||
    !/^[a-f0-9]{32}$/.test(salt) ||
    !/^[a-f0-9]{128}$/.test(hash)
  )
    return false;
  const actual = await scrypt(password, salt, 64, parameters);
  return timingSafeEqual(actual, Buffer.from(hash, "hex"));
}
