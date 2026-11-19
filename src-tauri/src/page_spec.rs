use crate::models::Book;

pub const CSS_DPI: f64 = 96.0;
pub const MM_PER_INCH: f64 = 25.4;
pub const MM_TO_PX: f64 = CSS_DPI / MM_PER_INCH;

#[derive(Debug, Clone, Copy)]
pub struct PageMarginsMm {
    pub top: f64,
    pub right: f64,
    pub bottom: f64,
    pub left: f64,
}

#[derive(Debug, Clone)]
pub struct PageSpec {
    pub preset: String,
    pub width_mm: f64,
    pub height_mm: f64,
    pub margins: PageMarginsMm,
}

#[derive(Debug, Clone, Copy)]
pub struct PagePixels {
    pub width: f64,
    pub height: f64,
    pub padding_top: f64,
    pub padding_right: f64,
    pub padding_bottom: f64,
    pub padding_left: f64,
}

pub fn classic_page() -> PageSpec {
    PageSpec {
        preset: "classic".into(),
        width_mm: px_to_mm(760.0),
        height_mm: px_to_mm(920.0),
        margins: PageMarginsMm {
            top: px_to_mm(56.0),
            right: px_to_mm(64.0),
            bottom: px_to_mm(96.0),
            left: px_to_mm(64.0),
        },
    }
}

pub fn preset_defaults(preset: &str) -> PageSpec {
    match preset {
        "a4" => PageSpec {
            preset: "a4".into(),
            width_mm: 210.0,
            height_mm: 297.0,
            margins: PageMarginsMm {
                top: 20.0,
                right: 20.0,
                bottom: 24.0,
                left: 20.0,
            },
        },
        "a5" => PageSpec {
            preset: "a5".into(),
            width_mm: 148.0,
            height_mm: 210.0,
            margins: PageMarginsMm {
                top: 16.0,
                right: 16.0,
                bottom: 20.0,
                left: 16.0,
            },
        },
        "book1724" => PageSpec {
            preset: "book1724".into(),
            width_mm: 170.0,
            height_mm: 240.0,
            margins: PageMarginsMm {
                top: 18.0,
                right: 18.0,
                bottom: 22.0,
                left: 18.0,
            },
        },
        "custom" => classic_page(),
        _ => classic_page(),
    }
}

pub fn resolve_page_spec(book: &Book) -> PageSpec {
    let defaults = preset_defaults(&book.page_size_preset);
    PageSpec {
        preset: book.page_size_preset.clone(),
        width_mm: clamp(
            if book.page_width_mm > 0.0 {
                book.page_width_mm
            } else {
                defaults.width_mm
            },
            80.0,
            400.0,
        ),
        height_mm: clamp(
            if book.page_height_mm > 0.0 {
                book.page_height_mm
            } else {
                defaults.height_mm
            },
            80.0,
            500.0,
        ),
        margins: PageMarginsMm {
            top: clamp(book.margin_top_mm.max(0.0), 0.0, 80.0),
            right: clamp(book.margin_right_mm.max(0.0), 0.0, 80.0),
            bottom: clamp(book.margin_bottom_mm.max(0.0), 0.0, 80.0),
            left: clamp(book.margin_left_mm.max(0.0), 0.0, 80.0),
        },
    }
}

pub fn page_pixels(spec: &PageSpec) -> PagePixels {
    PagePixels {
        width: round_px(spec.width_mm),
        height: round_px(spec.height_mm),
        padding_top: round_px(spec.margins.top),
        padding_right: round_px(spec.margins.right),
        padding_bottom: round_px(spec.margins.bottom),
        padding_left: round_px(spec.margins.left),
    }
}

pub fn build_sheet_css(spec: &PageSpec, paged: bool) -> String {
    let px = page_pixels(spec);
    let pad = format!(
        "{}px {}px {}px {}px",
        fmt(px.padding_top),
        fmt(px.padding_right),
        fmt(px.padding_bottom),
        fmt(px.padding_left)
    );
    let page_num_bottom = (px.padding_bottom * 0.35).max(8.0);
    if paged {
        format!(
            ":root{{--ks-page-preset:{}}}\
@page{{size:{}mm {}mm;margin:0}}\
html,body{{margin:0;padding:0;width:{}px;height:{}px;background:#fff;color:#152033;-webkit-print-color-adjust:exact;print-color-adjust:exact}}\
.sheet{{width:{}px;height:{}px;max-height:{}px;box-sizing:border-box;padding:{pad};overflow:hidden;page-break-after:always;page-break-inside:avoid;break-after:page;break-inside:avoid;position:relative}}\
.sheet:last-child{{page-break-after:auto;break-after:auto}}\
.page-num{{position:absolute;bottom:{}px;left:{}px;right:{}px;font-size:12px;letter-spacing:.08em;opacity:.7}}",
            spec.preset,
            fmt(spec.width_mm),
            fmt(spec.height_mm),
            fmt(px.width),
            fmt(px.height),
            fmt(px.width),
            fmt(px.height),
            fmt(px.height),
            fmt(page_num_bottom),
            fmt(px.padding_left),
            fmt(px.padding_right),
        )
    } else {
        format!(
            ":root{{--ks-page-preset:{}}}\
.sheet{{position:relative;width:{}px;min-height:{}px;margin:24px auto;padding:{pad};box-sizing:border-box;background:#fff;box-shadow:0 12px 36px rgba(15,23,42,.18);overflow:hidden}}\
.page-num{{position:absolute;bottom:{}px;left:{}px;right:{}px;font-size:12px;letter-spacing:.08em;opacity:.7}}",
            spec.preset,
            fmt(px.width),
            fmt(px.height),
            fmt(page_num_bottom),
            fmt(px.padding_left),
            fmt(px.padding_right),
        )
    }
}

fn px_to_mm(px: f64) -> f64 {
    px / MM_TO_PX
}

fn round_px(mm: f64) -> f64 {
    (mm * MM_TO_PX * 1000.0).round() / 1000.0
}

fn clamp(value: f64, min: f64, max: f64) -> f64 {
    value.max(min).min(max)
}

fn fmt(value: f64) -> String {
    let rounded = (value * 1000.0).round() / 1000.0;
    if (rounded - rounded.round()).abs() < f64::EPSILON {
        format!("{}", rounded as i64)
    } else {
        format!("{rounded}")
    }
}
