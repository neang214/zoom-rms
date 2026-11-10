import { v2 as cloudinary } from "cloudinary";

const MAX_IMAGE_URL_LENGTH = 255;

export function isCloudinaryConfigured() {
  if (process.env.CLOUDINARY_URL?.trim()) return true;
  return Boolean(
    process.env.CLOUDINARY_CLOUD_NAME?.trim() &&
      process.env.CLOUDINARY_API_KEY?.trim() &&
      process.env.CLOUDINARY_API_SECRET?.trim()
  );
}

function configureCloudinary() {
  if (!isCloudinaryConfigured()) {
    const err = new Error(
      "Cloudinary is not configured. Set CLOUDINARY_URL or CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET."
    );
    err.statusCode = 500;
    throw err;
  }

  if (process.env.CLOUDINARY_URL?.trim()) {
    cloudinary.config(true);
    cloudinary.config({ secure: true });
    return;
  }

  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME.trim(),
    api_key: process.env.CLOUDINARY_API_KEY.trim(),
    api_secret: process.env.CLOUDINARY_API_SECRET.trim(),
    secure: true,
  });
}

export function extractCloudinaryPublicId(imageUrl) {
  if (!imageUrl || typeof imageUrl !== "string") return null;

  let parsed;
  try {
    parsed = new URL(imageUrl.trim());
  } catch {
    return null;
  }

  if (!parsed.hostname.endsWith("cloudinary.com")) return null;

  const uploadMarker = "/upload/";
  const uploadIdx = parsed.pathname.indexOf(uploadMarker);
  if (uploadIdx === -1) return null;

  const afterUpload = parsed.pathname.slice(uploadIdx + uploadMarker.length);
  const parts = afterUpload.split("/").filter(Boolean);
  if (parts.length === 0) return null;

  const versionIndex = parts.findIndex((seg) => /^v\d+$/.test(seg));
  let idParts;
  if (versionIndex !== -1) {
    idParts = parts.slice(versionIndex + 1);
  } else {
    // Strip any delivery transformation segment when no version segment is present
    let startIdx = 0;
    while (startIdx < parts.length - 1 && (parts[startIdx].includes(",") || /^[a-z]{1,3}_/.test(parts[startIdx]))) {
      startIdx += 1;
    }
    idParts = parts.slice(startIdx);
  }

  if (idParts.length === 0) return null;
  const joined = idParts.join("/");
  return joined.replace(/\.[^./]+$/, "");
}

export async function uploadImageBuffer(buffer, { folder = "zoom-rms", publicId } = {}) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    const err = new Error("Empty image buffer");
    err.statusCode = 400;
    throw err;
  }

  configureCloudinary();

  const uploadOptions = {
    folder,
    resource_type: "image",
    overwrite: true,
    transformation: [{ width: 1200, height: 1200, crop: "limit" }],
    ...(publicId ? { public_id: publicId } : {}),
  };

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(uploadOptions, (error, result) => {
      if (error) return reject(error);
      if (!result?.secure_url) {
        return reject(new Error("Cloudinary upload did not return a secure_url"));
      }
      if (result.secure_url.length > MAX_IMAGE_URL_LENGTH) {
        return reject(new Error("Uploaded Cloudinary URL exceeds 255-character database limit"));
      }
      resolve(result);
    });
    stream.end(buffer);
  });
}

export async function deleteCloudinaryImage(imageUrl) {
  const publicId = extractCloudinaryPublicId(imageUrl);
  if (!publicId || !isCloudinaryConfigured()) return false;

  try {
    configureCloudinary();
    await cloudinary.uploader.destroy(publicId, {
      resource_type: "image",
      invalidate: true,
    });
    return true;
  } catch (error) {
    console.warn(`[Cloudinary] Failed to delete asset ${publicId}:`, error.message);
    return false;
  }
}

export async function handleEntityImageUpload({
  req,
  res,
  findExisting,
  updateImageUrl,
  folder,
  publicIdPrefix,
  entityKey,
  notFoundMessage,
}) {
  const parsedId = parseInt(req.params.id, 10);
  if (!Number.isInteger(parsedId) || parsedId <= 0) {
    return res.status(400).json({ message: "Invalid ID format" });
  }

  if (!req.file?.buffer) {
    return res.status(400).json({ message: "No image file provided" });
  }

  let uploadedResult = null;
  try {
    const existing = await findExisting(parsedId);
    if (!existing) {
      return res.status(404).json({ message: notFoundMessage });
    }

    const previousImageUrl = existing.image_url;
    const prefix = req.uploadPrefix || publicIdPrefix;
    uploadedResult = await uploadImageBuffer(req.file.buffer, {
      folder,
      publicId: `${prefix}-${parsedId}-${Date.now()}`,
    });

    const updated = await updateImageUrl(parsedId, uploadedResult.secure_url);

    if (previousImageUrl && previousImageUrl !== uploadedResult.secure_url) {
      await deleteCloudinaryImage(previousImageUrl);
    }

    return res.json({ image_url: uploadedResult.secure_url, [entityKey]: updated });
  } catch (error) {
    if (uploadedResult?.secure_url) {
      await deleteCloudinaryImage(uploadedResult.secure_url);
    }
    if (error.code === "P2025") {
      return res.status(404).json({ message: notFoundMessage });
    }
    if (error.statusCode) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    console.error(`[Cloudinary] ${publicIdPrefix} image upload error:`, error);
    return res.status(500).json({ message: error.message || "Failed to upload image" });
  }
}
