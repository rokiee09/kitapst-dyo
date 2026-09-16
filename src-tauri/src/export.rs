use crate::database;
use crate::error::AppError;
use crate::filesystem;
use crate::models::{Book, Chapter, ContentBlock};
use crate::state::AppState;
use serde::{Deserialize, Serialize};
use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::process::Command;
use zip::write::SimpleFileOptions;
use zip::CompressionMethod;
use zip::ZipWriter;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RunExportPayload {
    pub format: String,
    pub include_toc: Option<bool>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RunExportResult {
    pub format: String,
    pub output_path: String,
}

#[tauri::command]
pub fn export_book(
    state: tauri::State<AppState>,
    payload: RunExportPayload,
) -> Result<RunExportResult, AppError> {
    let format = payload.format.trim().to_lowercase();
    let include_toc = payload.include_toc.unwrap_or(true);
    let conn = state.db()?;
    let book = database::get_book(&conn)?;
    let chapters = database::list_chapters(&conn, &book.id)?;
    let ordered = ordered_chapters(&chapters);
    let mut rendered = Vec::new();
    for chapter in &ordered {
        let blocks = database::list_blocks(&conn, &chapter.id)?;
        rendered.push(RenderedChapter {
            chapter: (*chapter).clone(),
            blocks,
        });
    }
    drop(conn);

    let root = state.project_root()?;
    filesystem::ensure_project_layout(&root)?;
    let slug = ascii_slug(&book.title);
    let stamp = chrono::Utc::now().format("%Y%m%d-%H%M%S");

    let output_path = match format.as_str() {
        "html" => export_html(&root, &book, &rendered, include_toc, &slug, &stamp)?,
        "epub" => export_epub(&root, &book, &rendered, include_toc, &slug, &stamp)?,
        "pdf" => export_pdf(&root, &book, &rendered, include_toc, &slug, &stamp)?,
        "mobile" => export_mobile(&root, &book, &rendered, include_toc, &slug, &stamp)?,
        other => {
            return Err(AppError::user(
                "Desteklenmeyen dışa aktarma biçimi.",
                format!("format={other}"),
            ))
        }
    };

    Ok(RunExportResult {
        format,
        output_path: output_path.to_string_lossy().to_string(),
    })
}

struct RenderedChapter {
    chapter: Chapter,
    blocks: Vec<ContentBlock>,
}

fn ordered_chapters(chapters: &[Chapter]) -> Vec<Chapter> {
    fn walk(items: &[Chapter], parent: Option<&str>, out: &mut Vec<Chapter>) {
        let mut kids: Vec<&Chapter> = items
            .iter()
            .filter(|chapter| chapter.parent_id.as_deref() == parent)
            .collect();
        kids.sort_by_key(|chapter| chapter.order);
        for kid in kids {
            out.push(kid.clone());
            walk(items, Some(&kid.id), out);
        }
    }
    let mut out = Vec::new();
    walk(chapters, None, &mut out);
    if out.is_empty() {
        let mut rest = chapters.to_vec();
        rest.sort_by_key(|chapter| chapter.order);
        return rest;
    }
    out
}

fn export_html(
    root: &Path,
    book: &Book,
    chapters: &[RenderedChapter],
    include_toc: bool,
    slug: &str,
    stamp: &impl std::fmt::Display,
) -> Result<PathBuf, AppError> {
    let dir = root.join("exports").join("html").join(format!("{slug}-{stamp}"));
    fs::create_dir_all(dir.join("images"))?;
    let html = build_html(root, book, chapters, include_toc, &dir, "")?;
    let path = dir.join("index.html");
    fs::write(&path, html)?;
    Ok(path)
}

fn export_epub(
    root: &Path,
    book: &Book,
    chapters: &[RenderedChapter],
    include_toc: bool,
    slug: &str,
    stamp: &impl std::fmt::Display,
) -> Result<PathBuf, AppError> {
    let path = root
        .join("exports")
        .join("epub")
        .join(format!("{slug}-{stamp}.epub"));
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }
    let file = fs::File::create(&path)?;
    let mut zip = ZipWriter::new(file);
    let stored = SimpleFileOptions::default().compression_method(CompressionMethod::Stored);
    let deflated = SimpleFileOptions::default().compression_method(CompressionMethod::Deflated);

    zip.start_file("mimetype", stored)?;
    zip.write_all(b"application/epub+zip")?;

    zip.start_file("META-INF/container.xml", deflated)?;
    zip.write_all(
        br#"<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="EPUB/package.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>"#,
    )?;

    zip.start_file("EPUB/css/book.css", deflated)?;
    zip.write_all(EPUB_CSS.as_bytes())?;

    let mut manifest = String::from(
        r#"<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
<item id="css" href="css/book.css" media-type="text/css"/>"#,
    );
    let mut spine = String::new();
    let mut nav_items = String::new();
    let mut image_counter = 0usize;

    for (index, chapter) in chapters.iter().enumerate() {
        let mut xhtml = format!(
            r#"<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="tr">
<head><title>{}</title><link rel="stylesheet" href="css/book.css"/></head>
<body id="chapter-{}">
<h1>{}</h1>
"#,
            escape_xml(&chapter_heading(&chapter.chapter)),
            chapter.chapter.id,
            escape_xml(&chapter_heading(&chapter.chapter)),
        );
        let mut caption_counts = CaptionCounts::default();
        for block in &chapter.blocks {
            let (html, images) = render_block_html(root, block, None, &mut image_counter, &mut caption_counts)?;
            for (filename, bytes, media) in images {
                zip.start_file(format!("EPUB/images/{filename}"), deflated)?;
                zip.write_all(&bytes)?;
                manifest.push_str(&format!(
                    r#"<item id="img{}" href="images/{filename}" media-type="{media}"/>"#,
                    filename.replace('.', "-")
                ));
            }
            xhtml.push_str(&html);
        }
        xhtml.push_str(&page_number_html(book, index));
        xhtml.push_str("</body></html>");
        let href = format!("chapter-{index}.xhtml");
        zip.start_file(format!("EPUB/{href}"), deflated)?;
        zip.write_all(xhtml.as_bytes())?;
        manifest.push_str(&format!(
            r#"<item id="ch{index}" href="{href}" media-type="application/xhtml+xml"/>"#
        ));
        spine.push_str(&format!(r#"<itemref idref="ch{index}"/>"#));
        nav_items.push_str(&format!(
            r#"<li><a href="{href}">{}</a></li>"#,
            escape_xml(&chapter_heading(&chapter.chapter))
        ));
    }

    let nav = format!(
        r#"<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="tr">
<head><title>İçindekiler</title></head>
<body>
<nav epub:type="toc"><ol>{}</ol></nav>
</body></html>"#,
        if include_toc { nav_items } else { String::new() }
    );
    zip.start_file("EPUB/nav.xhtml", deflated)?;
    zip.write_all(nav.as_bytes())?;

    let opf = format!(
        r#"<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" unique-identifier="bookid" version="3.0" xml:lang="tr">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="bookid">urn:uuid:{}</dc:identifier>
    <dc:title>{}</dc:title>
    <dc:language>{}</dc:language>
    <dc:creator>{}</dc:creator>
    <meta property="dcterms:modified">{}</meta>
  </metadata>
  <manifest>{}</manifest>
  <spine>{}</spine>
</package>"#,
        book.id,
        escape_xml(&book.title),
        escape_xml(&book.language),
        escape_xml(book.author.as_deref().unwrap_or("")),
        chrono::Utc::now().format("%Y-%m-%dT%H:%M:%SZ"),
        manifest,
        spine
    );
    zip.start_file("EPUB/package.opf", deflated)?;
    zip.write_all(opf.as_bytes())?;
    zip.finish()?;
    Ok(path)
}

fn export_pdf(
    root: &Path,
    book: &Book,
    chapters: &[RenderedChapter],
    include_toc: bool,
    slug: &str,
    stamp: &impl std::fmt::Display,
) -> Result<PathBuf, AppError> {
    let html_path = export_html(root, book, chapters, include_toc, slug, stamp)?;
    let pdf_path = root
        .join("exports")
        .join("pdf")
        .join(format!("{slug}-{stamp}.pdf"));
    fs::create_dir_all(pdf_path.parent().unwrap_or(root))?;
    if print_html_to_pdf(&html_path, &pdf_path) {
        return Ok(pdf_path);
    }
    write_plain_pdf(&pdf_path, book, chapters)?;
    Ok(pdf_path)
}

fn print_html_to_pdf(html_path: &Path, pdf_path: &Path) -> bool {
    let browsers = [
        r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
        r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
        r"C:\Program Files\Google\Chrome\Application\chrome.exe",
        r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
    ];
    let Ok(html_url) = html_path.canonicalize() else {
        return false;
    };
    let html_url = format!("file:///{}", html_url.to_string_lossy().replace('\\', "/"));
    let pdf_arg = format!("--print-to-pdf={}", pdf_path.display());
    for browser in browsers {
        if !Path::new(browser).is_file() {
            continue;
        }
        let mut cmd = Command::new(browser);
        cmd.args([
            "--headless=new",
            "--disable-gpu",
            "--no-pdf-header-footer",
            "--virtual-time-budget=15000",
            &pdf_arg,
            &html_url,
        ]);
        #[cfg(windows)]
        {
            use std::os::windows::process::CommandExt;
            cmd.creation_flags(0x08000000);
        }
        if cmd.status().map(|status| status.success()).unwrap_or(false) && pdf_path.is_file() {
            return true;
        }
    }
    false
}

fn export_mobile(
    root: &Path,
    book: &Book,
    chapters: &[RenderedChapter],
    include_toc: bool,
    slug: &str,
    stamp: &impl std::fmt::Display,
) -> Result<PathBuf, AppError> {
    let dir = root
        .join("exports")
        .join("mobile")
        .join(format!("{slug}-{stamp}"));
    fs::create_dir_all(dir.join("images"))?;
    let html = build_html(root, book, chapters, include_toc, &dir, MOBILE_CSS)?;
    fs::write(dir.join("index.html"), html)?;
    let zip_path = root
        .join("exports")
        .join("mobile")
        .join(format!("{slug}-{stamp}.zip"));
    zip_folder(&dir, &zip_path)?;
    Ok(zip_path)
}

fn zip_folder(dir: &Path, zip_path: &Path) -> Result<(), AppError> {
    if let Some(parent) = zip_path.parent() {
        fs::create_dir_all(parent)?;
    }
    let file = fs::File::create(zip_path)?;
    let mut zip = ZipWriter::new(file);
    let options = SimpleFileOptions::default().compression_method(CompressionMethod::Deflated);
    add_folder_to_zip(&mut zip, dir, dir, options)?;
    zip.finish()?;
    Ok(())
}

fn add_folder_to_zip(
    zip: &mut ZipWriter<fs::File>,
    root: &Path,
    current: &Path,
    options: SimpleFileOptions,
) -> Result<(), AppError> {
    for entry in fs::read_dir(current)? {
        let entry = entry?;
        let path = entry.path();
        let relative = path
            .strip_prefix(root)
            .unwrap_or(&path)
            .to_string_lossy()
            .replace('\\', "/");
        if path.is_dir() {
            add_folder_to_zip(zip, root, &path, options)?;
        } else if path.is_file() {
            zip.start_file(relative, options)?;
            zip.write_all(&fs::read(&path)?)?;
        }
    }
    Ok(())
}

fn write_plain_pdf(
    path: &Path,
    book: &Book,
    chapters: &[RenderedChapter],
) -> Result<(), AppError> {
    let mut body = String::new();
    body.push_str(&book.title);
    body.push('\n');
    if let Some(subtitle) = &book.subtitle {
        body.push_str(subtitle);
        body.push('\n');
    }
    if let Some(author) = &book.author {
        body.push_str(author);
        body.push('\n');
    }
    body.push('\n');
    for chapter in chapters {
        body.push_str(&chapter_heading(&chapter.chapter));
        body.push('\n');
        for block in &chapter.blocks {
            let text = extract_plain(&block.data);
            if !text.trim().is_empty() {
                body.push_str(&text);
                body.push('\n');
            }
        }
        body.push('\n');
    }
    let latin = latinize(&body);
    let wrapped = wrap_pdf_lines(&latin, 88);
    let pages: Vec<Vec<String>> = if wrapped.is_empty() {
        vec![vec![" ".to_string()]]
    } else {
        wrapped.chunks(48).map(|chunk| chunk.to_vec()).collect()
    };

    let page_count = pages.len();
    let font_id = 3;
    let mut kids = String::new();
    for index in 0..page_count {
        let page_id = 4 + index * 2;
        if index > 0 {
            kids.push(' ');
        }
        kids.push_str(&format!("{page_id} 0 R"));
    }

    let mut body_objects: Vec<Vec<u8>> = vec![
        b"<< /Type /Catalog /Pages 2 0 R >>".to_vec(),
        format!("<< /Type /Pages /Kids [{kids}] /Count {page_count} >>").into_bytes(),
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>".to_vec(),
    ];
    for page in &pages {
        let mut stream = String::from("BT\n/F1 11 Tf\n72 720 Td\n");
        for (line_index, line) in page.iter().enumerate() {
            if line_index > 0 {
                stream.push_str("0 -15 Td\n");
            }
            stream.push_str(&format!("({}) Tj\n", pdf_escape(line)));
        }
        stream.push_str("ET\n");
        let content = format!(
            "<< /Length {} >>\nstream\n{}endstream",
            stream.as_bytes().len(),
            stream
        );
        let content_id = body_objects.len() + 2;
        let page_obj = format!(
            "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents {content_id} 0 R /Resources << /Font << /F1 {font_id} 0 R >> >> >>"
        );
        body_objects.push(page_obj.into_bytes());
        body_objects.push(content.into_bytes());
    }

    let mut pdf: Vec<u8> = b"%PDF-1.4\n".to_vec();
    let mut offsets = Vec::new();
    for (index, object) in body_objects.iter().enumerate() {
        offsets.push(pdf.len());
        pdf.extend_from_slice(format!("{} 0 obj\n", index + 1).as_bytes());
        pdf.extend_from_slice(object);
        pdf.extend_from_slice(b"\nendobj\n");
    }
    let xref = pdf.len();
    pdf.extend_from_slice(format!("xref\n0 {}\n", body_objects.len() + 1).as_bytes());
    pdf.extend_from_slice(b"0000000000 65535 f \n");
    for offset in offsets {
        pdf.extend_from_slice(format!("{offset:010} 00000 n \n").as_bytes());
    }
    pdf.extend_from_slice(
        format!(
            "trailer\n<< /Size {} /Root 1 0 R >>\nstartxref\n{}\n%%EOF\n",
            body_objects.len() + 1,
            xref
        )
        .as_bytes(),
    );
    fs::write(path, pdf)?;
    Ok(())
}

fn extract_plain(value: &serde_json::Value) -> String {
    match value {
        serde_json::Value::String(text) => text.clone(),
        serde_json::Value::Array(items) => items
            .iter()
            .map(extract_plain)
            .filter(|item| !item.is_empty())
            .collect::<Vec<_>>()
            .join(" "),
        serde_json::Value::Object(map) => {
            if let Some(text) = map.get("text").and_then(|item| item.as_str()) {
                return text.to_string();
            }
            map.values()
                .map(extract_plain)
                .filter(|item| !item.is_empty())
                .collect::<Vec<_>>()
                .join(" ")
        }
        _ => String::new(),
    }
}

fn latinize(input: &str) -> String {
    input
        .chars()
        .map(|ch| match ch {
            'ş' | 'Ş' => 's',
            'ğ' | 'Ğ' => 'g',
            'ü' | 'Ü' => 'u',
            'ö' | 'Ö' => 'o',
            'ç' | 'Ç' => 'c',
            'ı' | 'İ' => 'i',
            'â' => 'a',
            'î' => 'i',
            'û' => 'u',
            c if c.is_ascii() => c,
            _ => '?',
        })
        .collect()
}

fn wrap_pdf_lines(text: &str, width: usize) -> Vec<String> {
    let mut lines = Vec::new();
    for paragraph in text.split('\n') {
        if paragraph.is_empty() {
            lines.push(String::new());
            continue;
        }
        let mut current = String::new();
        for word in paragraph.split_whitespace() {
            if current.is_empty() {
                current.push_str(word);
            } else if current.len() + 1 + word.len() <= width {
                current.push(' ');
                current.push_str(word);
            } else {
                lines.push(current);
                current = word.to_string();
            }
        }
        if !current.is_empty() {
            lines.push(current);
        }
    }
    lines
}

fn pdf_escape(value: &str) -> String {
    value
        .replace('\\', "\\\\")
        .replace('(', "\\(")
        .replace(')', "\\)")
}

fn build_html(
    root: &Path,
    book: &Book,
    chapters: &[RenderedChapter],
    include_toc: bool,
    out_dir: &Path,
    extra_css: &str,
) -> Result<String, AppError> {
    let mut body = String::new();
    if include_toc {
        body.push_str("<nav class=\"toc\"><h2>İçindekiler</h2><ol>");
        for chapter in chapters {
            body.push_str(&format!(
                "<li><a href=\"#chapter-{}\">{}</a></li>",
                chapter.chapter.id,
                escape_html(&chapter_heading(&chapter.chapter))
            ));
        }
        body.push_str("</ol></nav>");
    }
    for (index, chapter) in chapters.iter().enumerate() {
        body.push_str(&format!(
            "<section id=\"chapter-{}\" style=\"position:relative;min-height:720px\">",
            chapter.chapter.id
        ));
        body.push_str(&format!(
            "<h1>{}</h1>",
            escape_html(&chapter_heading(&chapter.chapter))
        ));
        let mut caption_counts = CaptionCounts::default();
        for block in &chapter.blocks {
            let mut unused = 0usize;
            let (html, _) = render_block_html(root, block, Some(out_dir), &mut unused, &mut caption_counts)?;
            body.push_str(&html);
        }
        body.push_str(&page_number_html(book, index));
        body.push_str("</section>");
    }
    let theme_css = format!(
        "body{{background:{};color:{};font-family:{}}}section{{position:relative;min-height:720px}}",
        escape_html(&book.page_color),
        escape_html(&book.ink_color),
        escape_html(&book.font_family)
    );
    Ok(format!(
        r#"<!doctype html>
<html lang="tr">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>{}</title>
<style>{}{}{}</style>
</head>
<body>
<header>
  <p class="kicker">Kitap Stüdyosu</p>
  <h1 class="title">{}</h1>
  {}
  {}
</header>
{}
</body>
</html>"#,
        escape_html(&book.title),
        HTML_CSS,
        theme_css,
        extra_css,
        escape_html(&book.title),
        book.subtitle
            .as_deref()
            .map(|value| format!("<p class=\"subtitle\">{}</p>", escape_html(value)))
            .unwrap_or_default(),
        book.author
            .as_deref()
            .map(|value| format!("<p class=\"author\">{}</p>", escape_html(value)))
            .unwrap_or_default(),
        body
    ))
}

fn chapter_heading(chapter: &Chapter) -> String {
    match &chapter.number {
        Some(number) if !number.is_empty() => format!("{number} {}", chapter.title),
        _ => chapter.title.clone(),
    }
}

fn page_number_html(book: &Book, index: usize) -> String {
    if !book.page_numbers {
        return String::new();
    }
    let number = book.page_number_start + index as i64;
    let align = match book.page_number_align.as_str() {
        "left" => "left",
        "right" => "right",
        _ => "center",
    };
    format!(r#"<div class="page-num" style="text-align:{align}">{number}</div>"#)
}

fn render_block_html(
    root: &Path,
    block: &ContentBlock,
    out_dir: Option<&Path>,
    image_counter: &mut usize,
    captions: &mut CaptionCounts,
) -> Result<(String, Vec<(String, Vec<u8>, String)>), AppError> {
    let mut images = Vec::new();
    let html = match block.block_type.as_str() {
        "heading" | "paragraph" | "quote" | "orderedList" | "unorderedList" | "infoBox"
        | "warningBox" | "code" => {
            let inner = render_tiptap(block.data.get("content").unwrap_or(&block.data));
            match block.block_type.as_str() {
                "infoBox" => format!(
                    "<aside class=\"info\"><strong>{}</strong>{}</aside>",
                    escape_html(block.data.get("title").and_then(|v| v.as_str()).unwrap_or("ÖNEMLİ")),
                    inner
                ),
                "warningBox" => format!(
                    "<aside class=\"warn\"><strong>{}</strong>{}</aside>",
                    escape_html(block.data.get("title").and_then(|v| v.as_str()).unwrap_or("UYARI")),
                    inner
                ),
                "quote" => format!("<blockquote>{inner}</blockquote>"),
                "code" => format!(
                    "<pre><code>{}</code></pre>",
                    escape_html(block.data.get("code").and_then(|v| v.as_str()).unwrap_or(""))
                ),
                _ => inner,
            }
        }
        "image" => {
            captions.image += 1;
            let n = captions.image;
            if let Some(rel) = block.data.get("relativePath").and_then(|v| v.as_str()) {
                if let Some((bytes, ext, original_name)) = read_image(root, rel)? {
                    *image_counter += 1;
                    let filename = format!("img-{image_counter}.{ext}", image_counter = *image_counter);
                    let media = match ext.as_str() {
                        "png" => "image/png",
                        "webp" => "image/webp",
                        "svg" => "image/svg+xml",
                        _ => "image/jpeg",
                    };
                    if let Some(dir) = out_dir {
                        fs::create_dir_all(dir.join("images"))?;
                        let dest_name = if original_name.is_empty() {
                            filename.clone()
                        } else {
                            original_name
                        };
                        fs::write(dir.join("images").join(&dest_name), &bytes)?;
                        let alt = block.data.get("alt").and_then(|v| v.as_str()).unwrap_or("");
                        let figure = image_figure_open(&block.data);
                        format!(
                            r#"{figure}<img src="images/{}" alt="{}" style="width:100%;height:auto"/>{}</figure>"#,
                            dest_name,
                            escape_html(alt),
                            caption_html(&block.data, "image", n)
                        )
                    } else {
                        images.push((filename.clone(), bytes, media.to_string()));
                        let alt = block.data.get("alt").and_then(|v| v.as_str()).unwrap_or("");
                        let figure = image_figure_open(&block.data);
                        format!(
                            r#"{figure}<img src="images/{filename}" alt="{}" style="width:100%;height:auto"/>{}</figure>"#,
                            escape_html(alt),
                            caption_html(&block.data, "image", n)
                        )
                    }
                } else {
                    String::new()
                }
            } else {
                String::new()
            }
        }
        "video" => {
            captions.video += 1;
            render_video_html(block, captions.video)?
        }
        "qr" => {
            captions.qr += 1;
            render_qr_html(block, out_dir, image_counter, &mut images, captions.qr)?
        }
        "table" => render_table(&block.data),
        "file" => {
            let name = block
                .data
                .get("filename")
                .and_then(|v| v.as_str())
                .unwrap_or("Dosya");
            format!("<p>Ek dosya: {}</p>", escape_html(name))
        }
        "divider" => "<hr/>".to_string(),
        "pageBreak" => r#"<div class="page-break"></div>"#.to_string(),
        _ => render_tiptap(block.data.get("content").unwrap_or(&serde_json::Value::Null)),
    };
    Ok((wrap_block_style(block, html), images))
}

fn wrap_block_style(block: &ContentBlock, inner: String) -> String {
    if inner.is_empty() {
        return inner;
    }
    let style = &block.style;
    let placement = style
        .get("placement")
        .and_then(|value| value.as_str())
        .unwrap_or("flow");
    let mut css = String::new();
    if let Some(color) = style.get("color").and_then(|value| value.as_str()) {
        css.push_str(&format!("color:{};", escape_html(color)));
    }
    if let Some(background) = style.get("background").and_then(|value| value.as_str()) {
        css.push_str(&format!("background:{};", escape_html(background)));
    }
    if let Some(family) = style.get("fontFamily").and_then(|value| value.as_str()) {
        css.push_str(&format!("font-family:{};", escape_html(family)));
    }
    if let Some(size) = style.get("fontSize").and_then(|value| value.as_f64()) {
        css.push_str(&format!("font-size:{size}px;"));
    }
    if placement == "free" {
        let x = style.get("x").and_then(|value| value.as_f64()).unwrap_or(6.0);
        let y = style.get("y").and_then(|value| value.as_f64()).unwrap_or(8.0);
        let width = style
            .get("width")
            .and_then(|value| value.as_f64())
            .unwrap_or(88.0);
        css.push_str(&format!(
            "position:absolute;left:{x}%;top:{y}%;width:{width}%;box-sizing:border-box;"
        ));
        return format!(r#"<div class="textbox" style="{css}">{inner}</div>"#);
    }
    if css.is_empty() {
        inner
    } else {
        format!(r#"<div style="{css}">{inner}</div>"#)
    }
}

#[derive(Default)]
struct CaptionCounts {
    image: usize,
    video: usize,
    qr: usize,
}

fn render_video_html(block: &ContentBlock, index: usize) -> Result<String, AppError> {
    let title = block
        .data
        .get("title")
        .and_then(|value| value.as_str())
        .unwrap_or("Video");
    let url = block
        .data
        .get("url")
        .and_then(|value| value.as_str())
        .unwrap_or("")
        .trim();
    let mut html = format!(
        r#"<div class="video-block"><p><strong>{}</strong></p>"#,
        escape_html(title)
    );
    if !url.is_empty() {
        html.push_str(&format!(
            r#"<p><a href="{}">{}</a></p>"#,
            escape_html(url),
            escape_html(url)
        ));
    }
    html.push_str(&caption_html(&block.data, "video", index));
    html.push_str("</div>");
    Ok(html)
}

fn render_qr_html(
    block: &ContentBlock,
    out_dir: Option<&Path>,
    image_counter: &mut usize,
    images: &mut Vec<(String, Vec<u8>, String)>,
    index: usize,
) -> Result<String, AppError> {
    let target = block
        .data
        .get("target")
        .and_then(|item| item.as_str())
        .unwrap_or("");
    let payload = if target == "chapter" {
        block
            .data
            .get("chapterId")
            .and_then(|item| item.as_str())
            .filter(|id| !id.is_empty())
            .map(|id| format!("#chapter-{id}"))
            .unwrap_or_default()
    } else {
        block
            .data
            .get("value")
            .and_then(|item| item.as_str())
            .unwrap_or("")
            .trim()
            .to_string()
    };
    let caption = media_caption_text(&block.data, "qr", index);
    if payload.is_empty() {
        return Ok(String::new());
    }
    if (target == "video" || target == "url") && !is_http_url(&payload) && !payload.starts_with('#') {
        return Ok(format!("<p>{}</p>", escape_html(&payload)));
    }
    qr_figure(&payload, caption.as_deref(), out_dir, image_counter, images)
}

fn qr_figure(
    payload: &str,
    caption: Option<&str>,
    out_dir: Option<&Path>,
    image_counter: &mut usize,
    images: &mut Vec<(String, Vec<u8>, String)>,
) -> Result<String, AppError> {
    let Some(svg) = make_qr_svg(payload) else {
        return Ok(format!("<p>QR: {}</p>", escape_html(payload)));
    };
    *image_counter += 1;
    let filename = format!("qr-{}.svg", *image_counter);
    if let Some(dir) = out_dir {
        fs::create_dir_all(dir.join("images"))?;
        fs::write(dir.join("images").join(&filename), &svg)?;
    } else {
        images.push((filename.clone(), svg, "image/svg+xml".into()));
    }
    let alt = caption.unwrap_or("QR kod");
    let cap = caption
        .map(|value| format!(r#"<figcaption class="media-cap">{}</figcaption>"#, escape_html(value)))
        .unwrap_or_default();
    Ok(format!(
        r#"<figure class="qr"><img src="images/{filename}" alt="{}"/>{cap}</figure>"#,
        escape_html(alt),
    ))
}

fn make_qr_svg(value: &str) -> Option<Vec<u8>> {
    let code = qrcode::QrCode::new(value.as_bytes()).ok()?;
    let svg = code
        .render::<qrcode::render::svg::Color>()
        .min_dimensions(180, 180)
        .build();
    Some(svg.into_bytes())
}

fn is_http_url(value: &str) -> bool {
    let lower = value.trim().to_ascii_lowercase();
    (lower.starts_with("https://") || lower.starts_with("http://"))
        && !lower.starts_with("javascript:")
        && !lower.starts_with("data:")
        && !lower.starts_with("file:")
}

fn image_figure_open(data: &serde_json::Value) -> String {
    let width = data
        .get("width")
        .and_then(|value| value.as_f64())
        .unwrap_or(100.0)
        .clamp(8.0, 100.0);
    let align = data.get("align").and_then(|value| value.as_str()).unwrap_or("center");
    let margin = match align {
        "left" => "margin-left:0;margin-right:auto;",
        "right" => "margin-left:auto;margin-right:0;",
        _ => "margin-left:auto;margin-right:auto;",
    };
    format!(r#"<figure style="width:{width}%;{margin}">"#)
}

fn caption_html(data: &serde_json::Value, kind: &str, index: usize) -> String {
    media_caption_text(data, kind, index)
        .map(|value| format!(r#"<figcaption class="media-cap">{}</figcaption>"#, escape_html(&value)))
        .unwrap_or_default()
}

fn media_caption_text(data: &serde_json::Value, kind: &str, index: usize) -> Option<String> {
    let visible = data
        .get("captionVisible")
        .and_then(|value| value.as_bool())
        .unwrap_or(true);
    if !visible {
        return None;
    }
    let custom = data
        .get("captionCustom")
        .and_then(|value| value.as_bool())
        .unwrap_or(false);
    let note = data
        .get("caption")
        .and_then(|value| value.as_str())
        .unwrap_or("")
        .trim();
    if custom {
        return if note.is_empty() { None } else { Some(note.to_string()) };
    }
    let label = match kind {
        "image" => "Resim",
        "video" => "Video",
        _ => "QR",
    };
    let extra = if !note.is_empty() {
        note.to_string()
    } else if kind == "qr" {
        match data.get("target").and_then(|value| value.as_str()).unwrap_or("") {
            "video" => "Videoyu izlemek için tarayın".to_string(),
            "chapter" => "Bu bölüme gitmek için tarayın".to_string(),
            "text" => "QR kod".to_string(),
            _ => "Bağlantı için tarayın".to_string(),
        }
    } else {
        String::new()
    };
    if extra.is_empty() {
        Some(format!("{label} {index}."))
    } else {
        Some(format!("{label} {index}: {extra}"))
    }
}

fn read_image(root: &Path, relative: &str) -> Result<Option<(Vec<u8>, String, String)>, AppError> {
    let source = filesystem::safe_child_path(root, relative)?;
    if !source.is_file() {
        return Ok(None);
    }
    let bytes = fs::read(&source)?;
    let ext = source
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or("jpg")
        .to_ascii_lowercase();
    let name = source
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or("image.jpg")
        .to_string();
    Ok(Some((bytes, ext, name)))
}

fn render_table(data: &serde_json::Value) -> String {
    let rows = data
        .get("rows")
        .and_then(|v| v.as_array())
        .cloned()
        .unwrap_or_default();
    let mut html = String::from("<table>");
    if let Some(caption) = data.get("caption").and_then(|v| v.as_str()).filter(|v| !v.is_empty()) {
        html.push_str(&format!("<caption>{}</caption>", escape_html(caption)));
    }
    for (index, row) in rows.iter().enumerate() {
        html.push_str("<tr>");
        let cells = row.as_array().cloned().unwrap_or_default();
        for cell in cells {
            let text = cell.as_str().unwrap_or("");
            if index == 0 {
                html.push_str(&format!("<th>{}</th>", escape_html(text)));
            } else {
                html.push_str(&format!("<td>{}</td>", escape_html(text)));
            }
        }
        html.push_str("</tr>");
    }
    html.push_str("</table>");
    html
}

fn render_tiptap(node: &serde_json::Value) -> String {
    let Some(obj) = node.as_object() else {
        return String::new();
    };
    let kind = obj.get("type").and_then(|v| v.as_str()).unwrap_or("");
    if kind == "text" {
        let mut text = escape_html(obj.get("text").and_then(|v| v.as_str()).unwrap_or(""));
        if let Some(marks) = obj.get("marks").and_then(|v| v.as_array()) {
            for mark in marks {
                match mark.get("type").and_then(|v| v.as_str()).unwrap_or("") {
                    "bold" => text = format!("<strong>{text}</strong>"),
                    "italic" => text = format!("<em>{text}</em>"),
                    "underline" => text = format!("<u>{text}</u>"),
                    "textStyle" => {
                        let mut styled = text.clone();
                        if let Some(attrs) = mark.get("attrs") {
                            if let Some(color) = attrs.get("color").and_then(|v| v.as_str()) {
                                styled = format!(r#"<span style="color:{}">{styled}</span>"#, escape_html(color));
                            }
                            if let Some(size) = attrs.get("fontSize").and_then(|v| v.as_str()) {
                                styled = format!(r#"<span style="font-size:{}">{styled}</span>"#, escape_html(size));
                            }
                            if let Some(family) = attrs.get("fontFamily").and_then(|v| v.as_str()) {
                                styled = format!(r#"<span style="font-family:{}">{styled}</span>"#, escape_html(family));
                            }
                        }
                        text = styled;
                    }
                    "link" => {
                        let href = mark
                            .get("attrs")
                            .and_then(|v| v.get("href"))
                            .and_then(|v| v.as_str())
                            .unwrap_or("#");
                        text = format!(r#"<a href="{}">{text}</a>"#, escape_html(href));
                    }
                    _ => {}
                }
            }
        }
        return text;
    }
    let children = obj
        .get("content")
        .and_then(|v| v.as_array())
        .map(|items| items.iter().map(render_tiptap).collect::<String>())
        .unwrap_or_default();
    match kind {
        "doc" => children,
        "paragraph" => format!("<p>{children}</p>"),
        "heading" => {
            let level = obj
                .get("attrs")
                .and_then(|v| v.get("level"))
                .and_then(|v| v.as_u64())
                .unwrap_or(2)
                .clamp(1, 3);
            format!("<h{level}>{children}</h{level}>")
        }
        "blockquote" => format!("<blockquote>{children}</blockquote>"),
        "bulletList" => format!("<ul>{children}</ul>"),
        "orderedList" => format!("<ol>{children}</ol>"),
        "listItem" => format!("<li>{children}</li>"),
        "codeBlock" => format!("<pre><code>{children}</code></pre>"),
        "hardBreak" => "<br/>".to_string(),
        "horizontalRule" => "<hr/>".to_string(),
        _ => children,
    }
}

fn ascii_slug(name: &str) -> String {
    let cleaned = filesystem::sanitize_filename(name);
    let mapped: String = cleaned
        .chars()
        .map(|ch| match ch {
            'ı' | 'I' | 'İ' | 'i' => 'i',
            'ş' | 'Ş' => 's',
            'ğ' | 'Ğ' => 'g',
            'ü' | 'Ü' => 'u',
            'ö' | 'Ö' => 'o',
            'ç' | 'Ç' => 'c',
            c if c.is_ascii_alphanumeric() => c.to_ascii_lowercase(),
            _ => '-',
        })
        .collect();
    let collapsed = mapped
        .split('-')
        .filter(|part| !part.is_empty())
        .collect::<Vec<_>>()
        .join("-");
    if collapsed.is_empty() {
        "kitap".to_string()
    } else {
        collapsed
    }
}

fn escape_html(value: &str) -> String {
    value
        .replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
}

fn escape_xml(value: &str) -> String {
    escape_html(value).replace('\'', "&apos;")
}

const HTML_CSS: &str = r#"
body{font-family:Segoe UI,system-ui,sans-serif;max-width:820px;margin:32px auto;padding:0 24px 64px;color:#152033;line-height:1.65}
.title{font-size:36px;margin:0}
.subtitle,.author,.kicker{color:#5b6578}
.toc{background:#f8fafc;padding:16px 24px;border-radius:12px}
section{margin:48px 0}
.page-num{position:absolute;bottom:18px;left:24px;right:24px;font-size:12px;letter-spacing:.08em;opacity:.7}
img{max-width:100%;height:auto;border-radius:12px}
figure.qr{display:flex;flex-direction:column;align-items:center;margin:16px 0;text-align:center}
figure.qr img{width:180px;height:180px;border-radius:8px;background:#fff;padding:8px;box-sizing:border-box}
figure.qr figcaption,.media-cap{font-size:11px;color:#6b6478;margin-top:6px;text-align:center;line-height:1.35}
.video-block{margin:16px 0}
table{border-collapse:collapse;width:100%}
th,td{border:1px solid #dbe4ef;padding:8px;text-align:left}
ul{list-style:disc;padding-left:1.4em}
ol{list-style:decimal;padding-left:1.4em}
.info{background:#fffbeb;border:1px solid #fde68a;padding:12px 16px;border-radius:12px}
.warn{background:#fff7ed;border:1px solid #fdba74;padding:12px 16px;border-radius:12px}
.page-break{break-after:page;border-top:1px dashed #cbd5e1;margin:24px 0}
pre{background:#0f172a;color:#e2e8f0;padding:12px;border-radius:8px;overflow:auto}
@media print{body{margin:0;max-width:none}}
"#;

const MOBILE_CSS: &str = r#"
html{font-size:18px}
body{max-width:720px;margin:0 auto;padding:20px 16px 80px;line-height:1.7}
.title{font-size:28px}
h1{font-size:1.45rem}
a,button{min-height:44px}
img{width:100%;height:auto}
figure.qr img{width:180px;height:180px;max-width:180px}
table{font-size:0.95rem;display:block;overflow-x:auto}
.toc{position:sticky;top:0}
"#;

const EPUB_CSS: &str = "body{font-family:serif;line-height:1.5;position:relative}img{max-width:100%}figure.qr{text-align:center;margin:16px 0}figure.qr img{width:160px;height:160px}.media-cap{font-size:11px;color:#555;text-align:center;margin-top:6px}.page-num{margin-top:32px;font-size:12px;text-align:center;opacity:.7}ul{list-style:disc;padding-left:1.4em}ol{list-style:decimal;padding-left:1.4em}table{border-collapse:collapse;width:100%}th,td{border:1px solid #999;padding:6px}";
