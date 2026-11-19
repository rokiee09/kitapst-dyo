use crate::models::Book;
use serde_json::Value;

#[derive(Debug, Clone)]
pub struct BookExtras {
    pub cover_theme: String,
    pub bleed_mm: f64,
    pub front_matter_locked: bool,
    pub text_styles_css: String,
}

pub fn parse_book_extras(book: &Book) -> BookExtras {
    let raw: Value = serde_json::from_str(&book.book_extras_json).unwrap_or(Value::Null);
    let cover_theme = raw
        .get("coverTheme")
        .and_then(|v| v.as_str())
        .unwrap_or("classic")
        .to_string();
    let bleed_mm = raw
        .get("bleedMm")
        .and_then(|v| v.as_f64())
        .unwrap_or(3.0)
        .clamp(0.0, 10.0);
    let front_matter_locked = raw
        .get("frontMatterLocked")
        .and_then(|v| v.as_bool())
        .unwrap_or(true);
    let text_styles_css = text_styles_to_css(raw.get("textStyles"));
    BookExtras {
        cover_theme,
        bleed_mm,
        front_matter_locked,
        text_styles_css,
    }
}

pub fn front_matter_locked(book: &Book) -> bool {
    parse_book_extras(book).front_matter_locked
}

pub fn to_roman(mut n: i64) -> String {
    if n <= 0 {
        return n.to_string();
    }
    let map: [(i64, &str); 13] = [
        (1000, "m"),
        (900, "cm"),
        (500, "d"),
        (400, "cd"),
        (100, "c"),
        (90, "xc"),
        (50, "l"),
        (40, "xl"),
        (10, "x"),
        (9, "ix"),
        (5, "v"),
        (4, "iv"),
        (1, "i"),
    ];
    let mut out = String::new();
    for (value, glyph) in map {
        while n >= value {
            out.push_str(glyph);
            n -= value;
        }
    }
    out
}

fn text_styles_to_css(styles: Option<&Value>) -> String {
    let Some(styles) = styles else {
        return String::new();
    };
    let mut rules = Vec::new();
    for (id, sel) in [
        (
            "body",
            r#".sheet [data-block-kind="paragraph"], .sheet [data-text-style="body"]"#,
        ),
        (
            "h1",
            r#".sheet [data-heading-size="1"], .sheet h1, .sheet [data-text-style="h1"]"#,
        ),
        (
            "h2",
            r#".sheet [data-heading-size="2"], .sheet h2, .sheet [data-text-style="h2"]"#,
        ),
        (
            "h3",
            r#".sheet [data-heading-size="3"], .sheet h3, .sheet [data-text-style="h3"]"#,
        ),
        (
            "quote",
            r#".sheet [data-block-kind="quote"], .sheet blockquote, .sheet [data-text-style="quote"]"#,
        ),
        (
            "caption",
            r#".sheet .media-cap, .sheet [data-text-style="caption"]"#,
        ),
    ] {
        let Some(style) = styles.get(id) else {
            continue;
        };
        let font = style
            .get("fontFamily")
            .and_then(|v| v.as_str())
            .unwrap_or("Segoe UI");
        let size = style
            .get("fontSizePx")
            .and_then(|v| v.as_f64())
            .unwrap_or(15.0);
        let lh = style
            .get("lineHeight")
            .and_then(|v| v.as_f64())
            .unwrap_or(1.35);
        let weight = style
            .get("fontWeight")
            .and_then(|v| v.as_u64())
            .unwrap_or(400);
        let font_style = style
            .get("fontStyle")
            .and_then(|v| v.as_str())
            .unwrap_or("normal");
        let color = style
            .get("color")
            .and_then(|v| v.as_str())
            .unwrap_or("#152033");
        let mt = style
            .get("marginTopPx")
            .and_then(|v| v.as_f64())
            .unwrap_or(0.0);
        let mb = style
            .get("marginBottomPx")
            .and_then(|v| v.as_f64())
            .unwrap_or(8.0);
        let align = style
            .get("align")
            .and_then(|v| v.as_str())
            .map(|a| format!(";text-align:{a}"))
            .unwrap_or_default();
        let font_css = if font.contains(' ') {
            format!("\"{font}\",sans-serif")
        } else {
            format!("{font},sans-serif")
        };
        rules.push(format!(
            "{sel}{{font-family:{font_css};font-size:{size}px;line-height:{lh};font-weight:{weight};font-style:{font_style};color:{color};margin-top:{mt}px;margin-bottom:{mb}px{align}}}"
        ));
    }
    rules.join("\n")
}

pub fn cover_theme_css(theme: &str) -> String {
    match theme {
        "dark" => {
            ".sheet.cover,.cover.sheet{background:#0f172a;color:#f8fafc}.cover .title,.cover h1{color:#f8fafc}.cover .author,.cover .subtitle{color:#cbd5e1}".into()
        }
        "paper" => {
            ".sheet.cover,.cover.sheet{background:#f3e9d7;color:#3b2f22}.cover .title,.cover h1{color:#2c2118;font-family:Georgia,serif}".into()
        }
        "bold" => {
            ".sheet.cover,.cover.sheet{background:#1d4ed8;color:#fff}.cover .title,.cover h1{color:#fff;font-weight:800;letter-spacing:.02em}.cover .author{color:#dbeafe}".into()
        }
        _ => {
            ".sheet.cover,.cover.sheet{background:linear-gradient(160deg,#f8fafc,#e2e8f0);color:#152033}".into()
        }
    }
}

pub fn print_bleed_css(bleed_mm: f64, width_mm: f64, height_mm: f64) -> String {
    let mark = 8.0_f64;
    let bleed = bleed_mm.max(0.0);
    let total_w = width_mm + bleed * 2.0;
    let total_h = height_mm + bleed * 2.0;
    format!(
        r#"@page{{size:{total_w}mm {total_h}mm;margin:0}}
html,body{{width:{total_w}mm;height:auto;background:#fff}}
.sheet{{position:relative;width:{width_mm}mm;height:{height_mm}mm;margin:{bleed}mm;box-sizing:border-box;overflow:hidden;page-break-after:always;break-after:page}}
.sheet:last-child{{page-break-after:auto;break-after:auto}}
.crop-marks{{position:absolute;inset:0;pointer-events:none;z-index:50}}
.crop-marks::before,.crop-marks::after{{content:"";position:absolute;background:#111}}
.crop-tl-h,.crop-tr-h,.crop-bl-h,.crop-br-h,.crop-tl-v,.crop-tr-v,.crop-bl-v,.crop-br-v{{position:absolute;background:#111}}
.crop-tl-h{{top:-{bleed}mm;left:0;width:{mark}mm;height:0.2mm}}
.crop-tl-v{{top:0;left:-{bleed}mm;width:0.2mm;height:{mark}mm}}
.crop-tr-h{{top:-{bleed}mm;right:0;width:{mark}mm;height:0.2mm}}
.crop-tr-v{{top:0;right:-{bleed}mm;width:0.2mm;height:{mark}mm}}
.crop-bl-h{{bottom:-{bleed}mm;left:0;width:{mark}mm;height:0.2mm}}
.crop-bl-v{{bottom:0;left:-{bleed}mm;width:0.2mm;height:{mark}mm}}
.crop-br-h{{bottom:-{bleed}mm;right:0;width:{mark}mm;height:0.2mm}}
.crop-br-v{{bottom:0;right:-{bleed}mm;width:0.2mm;height:{mark}mm}}"#
    )
}
