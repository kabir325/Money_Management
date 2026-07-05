import { Redis } from "@upstash/redis";
import {
  DEFAULT_DATA,
  FINANCE_DATA_KEY,
  normalizeFinanceData,
  withUpdatedTimestamp,
  type FinanceData,
} from "@/lib/finance";

let redisClient: Redis | null = null;

export function isFinanceStoreConfigured() {
  return Boolean(getRedisUrl() && getRedisToken());
}

export async function loadFinanceData() {
  if (!isFinanceStoreConfigured()) {
    return DEFAULT_DATA;
  }

  const redis = getRedisClient();
  const storedData = await redis.get<FinanceData>(FINANCE_DATA_KEY);

  return storedData ? normalizeFinanceData(storedData) : DEFAULT_DATA;
}

export async function saveFinanceData(data: FinanceData) {
  if (!isFinanceStoreConfigured()) {
    throw new Error(
      "Redis storage is not configured. Add KV/Upstash Redis environment variables.",
    );
  }

  const nextData = withUpdatedTimestamp(normalizeFinanceData(data));
  const redis = getRedisClient();
  await redis.set(FINANCE_DATA_KEY, nextData);

  return nextData;
}

function getRedisClient() {
  if (redisClient) {
    return redisClient;
  }

  const url = getRedisUrl();
  const token = getRedisToken();

  if (!url || !token) {
    throw new Error("Redis storage is not configured.");
  }

  redisClient = new Redis({ url, token });
  return redisClient;
}

function getRedisUrl() {
  return process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL ?? "";
}

function getRedisToken() {
  return process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN ?? "";
}
