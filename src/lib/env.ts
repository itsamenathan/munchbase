import { z } from "zod";
import { logger } from "./logger";

const schema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  DATABASE_PATH: z.string().default("./data/munchbase.db"),
  APP_ORIGIN: z.string().default("http://localhost:3000"),
  PHOTO_MAX_SIZE_MB: z.coerce.number().positive().default(10),
  ALLOWED_DEV_ORIGINS: z.string().optional(),
  OSM_USER_AGENT: z.string().optional(),
  NEXT_PUBLIC_TILE_URL: z.string().optional(),
});

export type Env = z.infer<typeof schema>;

function validate(): Env {
  const result = schema.safeParse(process.env);
  if (!result.success) {
    logger.error("Environment variable validation failed", {
      issues: result.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
    });
    return schema.parse({});
  }
  const env = result.data;
  if (env.NODE_ENV === "production") {
    const origin = env.APP_ORIGIN;
    if (origin.includes("localhost") || origin.includes("127.0.0.1")) {
      logger.warn("APP_ORIGIN is set to a local address in production — update it to your public domain", {
        APP_ORIGIN: origin,
      });
    }
  }
  return env;
}

export const env = validate();
