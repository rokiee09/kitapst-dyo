import { invokeCommand } from "@/services/tauri/invoke";
import type { BookExporter, ExportOptions, ExportResult } from "@/features/export/types";

async function run(format: "html" | "epub" | "pdf", bookId: string, options: ExportOptions): Promise<ExportResult> {
  void bookId;
  const result = await invokeCommand<ExportResult>("export_book", {
    payload: { format, includeToc: options.includeToc },
  });
  return result;
}

export class HtmlExporter implements BookExporter {
  export(bookId: string, options: ExportOptions): Promise<ExportResult> {
    return run("html", bookId, options);
  }
}

export class EpubExporter implements BookExporter {
  export(bookId: string, options: ExportOptions): Promise<ExportResult> {
    return run("epub", bookId, options);
  }
}

export class PdfExporter implements BookExporter {
  export(bookId: string, options: ExportOptions): Promise<ExportResult> {
    return run("pdf", bookId, options);
  }
}
