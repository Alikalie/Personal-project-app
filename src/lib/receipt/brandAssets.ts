const iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#2ecc71"/><stop offset="1" stop-color="#0b7d35"/></linearGradient></defs>
<rect width="128" height="128" rx="26" fill="url(#g)"/>
<path d="M25 42h78v57a5 5 0 0 1-5 5H30a5 5 0 0 1-5-5z" fill="#dcf4e4"/>
<path d="M22 30h84v19a15 15 0 0 1-28 7 15 15 0 0 1-28 0 15 15 0 0 1-28-7z" fill="#fff"/>
<path d="M50 30h28v23a14 14 0 0 1-28 0z" fill="#0072c6"/>
<rect x="34" y="67" width="22" height="37" rx="4" fill="#0b7d35"/>
<circle cx="50" cy="85" r="2" fill="#fff"/>
<rect x="65" y="79" width="9" height="16" rx="2" fill="#16a34a"/>
<rect x="78" y="72" width="9" height="23" rx="2" fill="#16a34a"/>
<rect x="91" y="64" width="9" height="31" rx="2" fill="#0072c6"/>
</svg>`;

const wordmarkSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 166 48">
<text x="0" y="37" font-family="Arial,sans-serif" font-size="36" font-weight="800" letter-spacing="-2" fill="#0b2545">Mi</text>
<text x="39" y="37" font-family="Arial,sans-serif" font-size="36" font-weight="800" letter-spacing="-2" fill="#16a34a">Shop</text>
</svg>`;

const svgDataUri = (svg: string) => `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;

export const MISHOP_ICON_DATA_URI = svgDataUri(iconSvg);
export const MISHOP_WORDMARK_DATA_URI = svgDataUri(wordmarkSvg);
