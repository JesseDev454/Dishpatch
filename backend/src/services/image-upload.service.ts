import { v2 as cloudinary, UploadApiErrorResponse, UploadApiResponse } from "cloudinary";
import { env } from "../config/env";

type UploadItemImageInput = {
  buffer: Buffer;
  mimeType: string;
  restaurantId: number;
  itemId: number;
};

type UploadedImage = {
  secureUrl: string;
  publicId: string;
};

const isConfigured = (): boolean => {
  return Boolean(env.cloudinary.cloudName && env.cloudinary.apiKey && env.cloudinary.apiSecret);
};

export class ImageUploadService {
  constructor() {
    if (isConfigured()) {
      cloudinary.config({
        secure: true,
        cloud_name: env.cloudinary.cloudName,
        api_key: env.cloudinary.apiKey,
        api_secret: env.cloudinary.apiSecret
      });
    }
  }

  async uploadItemImage(input: UploadItemImageInput): Promise<UploadedImage> {
    if (!isConfigured()) {
      throw new Error("Cloudinary is not configured");
    }

    const folder = `dishpatch/${input.restaurantId}/items`;
    const publicId = `item-${input.itemId}-${Date.now()}`;

    const uploadResult = await new Promise<UploadApiResponse>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder,
          public_id: publicId,
          overwrite: true,
          resource_type: "image"
        },
        (error: UploadApiErrorResponse | undefined, result: UploadApiResponse | undefined) => {
          if (error) {
            reject(error);
            return;
          }

          if (!result) {
            reject(new Error("No upload result returned"));
            return;
          }

          resolve(result);
        }
      );

      stream.end(input.buffer);
    });

    return {
      secureUrl: uploadResult.secure_url,
      publicId: uploadResult.public_id
    };
  }
}
