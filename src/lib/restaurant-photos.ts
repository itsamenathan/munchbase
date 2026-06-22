import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const ALLOWED_MIME_TYPES = new Map([
  ["image/jpeg", ".jpg"],
  ["image/png", ".png"],
  ["image/webp", ".webp"],
]);

export function getMaxPhotoUploadBytes() {
  const mb = Number(process.env.PHOTO_MAX_SIZE_MB ?? 10);
  return (Number.isFinite(mb) && mb > 0 ? mb : 10) * 1024 * 1024;
}

export function getPhotoStorageRoot() {
  const databasePath = process.env.DATABASE_PATH ?? "./data/munchbase.db";
  return path.join(path.dirname(databasePath), "uploads");
}

export function getPhotoMediaUrl(storageKey: string) {
  return `/media/${storageKey.split("/").map((segment) => encodeURIComponent(segment)).join("/")}`;
}

export function assertPhotoUpload(file: File | null | undefined) {
  if (!file || !file.size) throw new Error("Choose an image to upload.");
  const maxBytes = getMaxPhotoUploadBytes();
  const maxMb = Math.round(maxBytes / (1024 * 1024));
  if (file.size > maxBytes) throw new Error(`Photos must be ${maxMb} MB or smaller.`);
  const extension = ALLOWED_MIME_TYPES.get(file.type);
  if (!extension) throw new Error("Only JPEG, PNG, and WebP images are supported.");
  return extension;
}

export async function saveRestaurantPhotoFiles(restaurantId: number, file: File) {
  const originalExtension = assertPhotoUpload(file);
  const uploadId = crypto.randomUUID();
  const baseDir = path.posix.join("restaurants", String(restaurantId));
  const originalStorageKey = path.posix.join(baseDir, `${uploadId}-original${originalExtension}`);
  const storageKey = path.posix.join(baseDir, `${uploadId}-gallery.webp`);
  const thumbnailStorageKey = path.posix.join(baseDir, `${uploadId}-thumb.webp`);

  const originalPath = resolvePhotoStoragePath(originalStorageKey);
  const imagePath = resolvePhotoStoragePath(storageKey);
  const thumbnailPath = resolvePhotoStoragePath(thumbnailStorageKey);
  await fs.mkdir(path.dirname(originalPath), { recursive: true });

  const bytes = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(originalPath, bytes);

  try {
    await sharp(bytes)
      .rotate()
      .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 84 })
      .toFile(imagePath);
    await sharp(bytes)
      .rotate()
      .resize({ width: 420, height: 420, fit: "cover", position: "centre" })
      .webp({ quality: 78 })
      .toFile(thumbnailPath);
  } catch (error) {
    await deletePhotoFiles([originalStorageKey, storageKey, thumbnailStorageKey]);
    throw error;
  }

  return { storageKey, originalStorageKey, thumbnailStorageKey };
}

export async function deletePhotoFiles(storageKeys: string[]) {
  await Promise.all(
    storageKeys.map(async (storageKey) => {
      try {
        await fs.unlink(resolvePhotoStoragePath(storageKey));
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      }
    }),
  );
}

export async function cleanupPhotoDirectory(restaurantId: number) {
  const directory = resolvePhotoStoragePath(path.posix.join("restaurants", String(restaurantId)));
  await fs.rm(directory, { recursive: true, force: true });
}

export function resolvePhotoStoragePath(storageKey: string) {
  const normalized = path.posix.normalize(storageKey);
  if (normalized.startsWith("../") || normalized.includes("/../") || normalized === "..") {
    throw new Error("Invalid media path.");
  }
  const root = path.resolve(getPhotoStorageRoot());
  const absolute = path.resolve(root, normalized);
  if (!absolute.startsWith(root)) throw new Error("Invalid media path.");
  return absolute;
}

export function mediaTypeForStorageKey(storageKey: string) {
  const extension = path.extname(storageKey).toLowerCase();
  switch (extension) {
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".png":
      return "image/png";
    case ".webp":
      return "image/webp";
    default:
      return "application/octet-stream";
  }
}
