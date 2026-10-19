export const BOOK_PAGE_STRUCTURES = [
  {
    id: "builtin-kapak",
    title: "Kapak",
    hint: "Görsel, kitap adı ve yazar",
  },
  {
    id: "builtin-onsoz",
    title: "Önsöz",
    hint: "Yazarın ön sözü",
  },
  {
    id: "builtin-icindekiler",
    title: "İçindekiler",
    hint: "Bölüm listesi sayfası",
  },
  {
    id: "builtin-giris",
    title: "Giriş",
    hint: "Kitaba giriş metni",
  },
] as const;

export type BookPageStructureId = (typeof BOOK_PAGE_STRUCTURES)[number]["id"];
