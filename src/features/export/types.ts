export interface ExportOptions {
  outputDir?: string;
  includeToc: boolean;
}

export interface ExportResult {
  format: string;
  outputPath: string;
}

export interface BookExporter {
  export(bookId: string, options: ExportOptions): Promise<ExportResult>;
}
