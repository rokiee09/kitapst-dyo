import { toast } from "sonner";
import { tr } from "@/i18n/tr";
import { Button } from "@/components/ui/button";
import { exportService, folderService, projectService } from "@/services";

const FORMATS = [
  { id: "epub", title: tr.export.epub, enabled: true, note: "Gerçek EPUB 3 dosyası üretir." },
  { id: "pdf", title: tr.export.pdf, enabled: true, note: "Edge/Chrome varsa sayfa PDF’i; yoksa metin PDF üretir." },
  { id: "html", title: tr.export.html, enabled: true, note: "Tek sayfalık HTML kitap üretir." },
  { id: "zip", title: tr.export.zip, enabled: true, note: "Proje yedeğini ZIP olarak oluşturur." },
  { id: "mobile", title: tr.export.mobile, enabled: true, note: tr.export.mobileHint },
] as const;

export function ExportView() {
  return (
    <div className="h-full overflow-auto bg-[#0d1524] p-8">
      <h1 className="mb-2 text-xl font-semibold">{tr.export.title}</h1>
      <p className="mb-6 text-sm text-[#8aa0bd]">
        Çıktılar proje klasöründeki `exports` dizinine yazılır.
      </p>
      <div className="grid max-w-5xl grid-cols-3 gap-4">
        {FORMATS.map((format) => (
          <div key={format.id} className="rounded-lg border border-[#1c2a44] bg-[#070b14] p-5">
            <div className="text-lg font-semibold">{format.title}</div>
            <p className="mt-2 min-h-12 text-sm text-[#8aa0bd]">{format.note}</p>
            <Button
              className="mt-4"
              disabled={!format.enabled}
              variant={format.enabled ? "default" : "secondary"}
              onClick={() => {
                if (format.id === "zip") {
                  void projectService
                    .createBackup()
                    .then((path) => toast.success(`Yedek oluşturuldu: ${path}`))
                    .catch((error: unknown) =>
                      toast.error(error instanceof Error ? error.message : "Yedek oluşturulamadı."),
                    );
                  return;
                }
                if (format.id === "html" || format.id === "epub" || format.id === "pdf" || format.id === "mobile") {
                  void exportService
                    .run(format.id)
                    .then((result) => {
                      toast.success(`Oluşturuldu: ${result.outputPath}`);
                      void folderService.open(format.id === "mobile" ? "mobile" : format.id);
                    })
                    .catch((error: unknown) =>
                      toast.error(error instanceof Error ? error.message : "Dışa aktarma başarısız."),
                    );
                }
              }}
            >
              {format.enabled ? "Oluştur" : tr.export.comingSoon}
            </Button>
          </div>
        ))}
      </div>
      <Button className="mt-6" variant="secondary" onClick={() => void folderService.open("exports")}>
        Dışa aktarma klasörünü aç
      </Button>
    </div>
  );
}
