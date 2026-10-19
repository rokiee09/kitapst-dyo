import { invokeCommand } from "@/services/tauri/invoke";
import type { Asset } from "@/types/domain";

const dataUrlCache = new Map<string, string>();
const absPathCache = new Map<string, string>();

export const assetService = {
  import(sourcePath: string, assetType: "image" | "video" | "file"): Promise<Asset> {
    return invokeCommand<Asset>("import_asset", {
      payload: { sourcePath, assetType },
    });
  },
  list(assetType?: "image" | "video" | "file"): Promise<Asset[]> {
    return invokeCommand<Asset[]>("list_assets", { assetType: assetType ?? null });
  },
  async readDataUrl(relativePath: string): Promise<string> {
    const cached = dataUrlCache.get(relativePath);
    if (cached) return cached;
    const url = await invokeCommand<string>("read_asset_data_url", { relativePath });
    dataUrlCache.set(relativePath, url);
    return url;
  },
  async resolvePath(relativePath: string): Promise<string> {
    const cached = absPathCache.get(relativePath);
    if (cached) return cached;
    const abs = await invokeCommand<string>("resolve_asset_path", { relativePath });
    absPathCache.set(relativePath, abs);
    return abs;
  },
  remove(id: string): Promise<void> {
    return invokeCommand<void>("delete_asset", { id });
  },
  open(relativePath: string): Promise<void> {
    return invokeCommand<void>("open_asset", { relativePath });
  },
  clearCache() {
    dataUrlCache.clear();
    absPathCache.clear();
  },
};
