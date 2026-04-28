// Upload helpers for shop-scoped images on Lovable Cloud Storage.
import { supabase } from "@/integrations/supabase/client";

export type UploadBucket = "product-images" | "recipe-images" | "storefront-banners";

export async function uploadShopImage(
  bucket: UploadBucket,
  shopId: string,
  file: File,
): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("Selecione uma imagem");
  if (file.size > 4 * 1024 * 1024) throw new Error("Imagem maior que 4MB");
  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${shopId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type,
  });
  if (error) throw error;
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}
