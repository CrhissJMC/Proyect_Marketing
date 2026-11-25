import type { CSSProperties } from "react";
import type { ArtKind } from "../lib/art";

interface Props {
  kind: ArtKind;
  label?: string;
  labelBg?: string;
  bg?: string;
  radius?: number;
  steam?: boolean;
  style?: CSSProperties;
  title?: string;
}

/** Ilustraciones vectoriales de los productos APU (provisionales hasta tener fotos). */
export function ProductArt({ kind, label = "CLASSIC", labelBg = "#5C3A24", bg = "transparent", radius = 0, steam = true, style, title }: Props) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: bg,
        borderRadius: radius,
        overflow: "hidden",
        fontFamily: "var(--serif)",
        ...style,
      }}
    >
      {kind === "cup" && (
        <svg viewBox="0 0 200 220" role="img" aria-label={title ?? "Vaso de café APU"} style={{ width: "82%", height: "88%" }}>
          <ellipse cx="100" cy="206" rx="48" ry="7" fill="#2B1A12" opacity=".12" />
          {steam && (
            <g className="steam" stroke="#B07A4F" strokeWidth="3" strokeLinecap="round" fill="none">
              <path d="M86 30c-6-8 6-12 0-22" /><path d="M100 26c-6-8 6-12 0-22" /><path d="M114 30c-6-8 6-12 0-22" />
            </g>
          )}
          <rect x="66" y="40" width="68" height="12" rx="5" fill="#2B1A12" />
          <path d="M54 62 Q54 52 64 52 L136 52 Q146 52 146 62 L146 70 L54 70 Z" fill="#3B2418" />
          <path d="M60 70 L140 70 L128 202 L72 202 Z" fill="#FBF7F1" />
          <path d="M60 70 L72 202 L80 202 L70 70 Z" fill="#EFE4D6" />
          <path d="M64 108 L136 108 L131 160 L69 160 Z" fill="#B07A4F" />
          <path d="M86 146 L96 128 L101 136 L106 130 L116 146 Z" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinejoin="round" />
          <text x="100" y="125" textAnchor="middle" fill="#FFFFFF" fontSize="13" fontWeight="800" letterSpacing="3">APU</text>
        </svg>
      )}

      {kind === "mug" && (
        <svg viewBox="0 0 200 200" role="img" aria-label={title ?? "Taza de café"} style={{ width: "82%", height: "82%" }}>
          {steam && (
            <g className="steam" stroke="#B07A4F" strokeWidth="3" strokeLinecap="round" fill="none">
              <path d="M88 64c-6-8 6-12 0-22" /><path d="M104 60c-6-8 6-12 0-22" />
            </g>
          )}
          <ellipse cx="96" cy="164" rx="74" ry="15" fill="#FFFFFF" stroke="#E2D2BE" strokeWidth="2" />
          <ellipse cx="96" cy="162" rx="44" ry="7" fill="#EFE4D6" />
          <path d="M144 98 Q176 96 172 122 Q168 146 138 142" fill="none" stroke="#FFFFFF" strokeWidth="10" strokeLinecap="round" />
          <path d="M144 98 Q176 96 172 122 Q168 146 138 142" fill="none" stroke="#E2D2BE" strokeWidth="2" />
          <path d="M46 86 L146 86 L138 146 Q135 160 120 160 L72 160 Q57 160 54 146 Z" fill="#FFFFFF" stroke="#E2D2BE" strokeWidth="2" />
          <ellipse cx="96" cy="86" rx="50" ry="11" fill="#7A4E30" />
          <path d="M96 94c-10-6-14-12-8-14 3-1 6 1 8 4 2-3 5-5 8-4 6 2 2 8-8 14z" fill="#F5EFE6" />
        </svg>
      )}

      {kind === "frappe" && (
        <svg viewBox="0 0 200 220" role="img" aria-label={title ?? "Bebida fría de café"} style={{ width: "82%", height: "88%" }}>
          <ellipse cx="100" cy="206" rx="44" ry="7" fill="#2B1A12" opacity=".12" />
          <path d="M112 8 L104 66" stroke="#B84E17" strokeWidth="7" strokeLinecap="round" />
          <path d="M58 70 Q58 34 100 34 Q142 34 142 70 Z" fill="#FFFFFF" stroke="#E2D2BE" strokeWidth="2" />
          <circle cx="84" cy="58" r="14" fill="#FFFBF6" /><circle cx="104" cy="50" r="16" fill="#FFFBF6" /><circle cx="120" cy="60" r="12" fill="#FFFBF6" />
          <path d="M84 50c6 4 14 4 22-2" stroke="#7A4E30" strokeWidth="3" fill="none" strokeLinecap="round" />
          <rect x="54" y="68" width="92" height="8" rx="3" fill="#E2D2BE" />
          <path d="M60 76 L140 76 L128 202 L72 202 Z" fill="#D2AE8A" />
          <path d="M60 76 L140 76 L137 106 L63 106 Z" fill="#E3C7A8" />
          <path d="M68 150 L132 150 L130 170 L70 170 Z" fill="#FFFFFF" opacity=".85" />
          <text x="100" y="165" textAnchor="middle" fill="#3B2418" fontSize="12" fontWeight="800" letterSpacing="3">APU</text>
        </svg>
      )}

      {kind === "bag" && (
        <svg viewBox="0 0 200 220" role="img" aria-label={title ?? `Bolsa de café APU ${label}`} style={{ width: "80%", height: "88%" }}>
          <ellipse cx="100" cy="208" rx="56" ry="7" fill="#2B1A12" opacity=".12" />
          <path d="M58 22 L142 22 L146 50 L54 50 Z" fill="#B88F66" />
          <path d="M58 22 L142 22 L141 28 L59 28 Z" fill="#A47D57" />
          <path d="M54 50 L146 50 L156 204 L44 204 Z" fill="#CDA67D" />
          <path d="M54 50 L64 50 L56 204 L44 204 Z" fill="#BE966C" />
          <rect x="68" y="84" width="64" height="88" rx="4" fill={labelBg} />
          <path d="M86 112 L96 96 L102 104 L106 99 L116 112 Z" fill="none" stroke="#F5EFE6" strokeWidth="1.8" strokeLinejoin="round" />
          <text x="100" y="132" textAnchor="middle" fill="#FFFFFF" fontSize="18" fontWeight="800" letterSpacing="4">APU</text>
          <text x="100" y="148" textAnchor="middle" fill="#F5EFE6" fontSize="8.5" fontFamily="Jost, sans-serif" letterSpacing="2">{label}</text>
          <text x="100" y="164" textAnchor="middle" fill="#E8D9C5" fontSize="7.5" fontFamily="Jost, sans-serif">250 g · Jaén</text>
          <circle cx="100" cy="66" r="5" fill="none" stroke="#A47D57" strokeWidth="2" />
        </svg>
      )}

      {kind === "cake" && (
        <svg viewBox="0 0 200 200" role="img" aria-label={title ?? "Postre"} style={{ width: "82%", height: "82%" }}>
          <ellipse cx="100" cy="160" rx="80" ry="16" fill="#FFFFFF" stroke="#E2D2BE" strokeWidth="2" />
          <path d="M38 120 L150 92 L162 112 L162 150 L38 156 Z" fill="#5A3422" />
          <path d="M38 120 L162 112 L162 150 L38 156 Z" fill="#6E4129" />
          <path d="M38 132 L162 124" stroke="#F5EFE6" strokeWidth="5" />
          <path d="M38 144 L162 137" stroke="#3B2418" strokeWidth="4" />
          <path d="M38 120 L150 92 L162 112 Z" fill="#3B2418" />
          <path d="M38 120 Q44 110 50 118 Q56 108 64 116" fill="none" stroke="#3B2418" strokeWidth="5" strokeLinecap="round" />
          <circle cx="138" cy="96" r="7" fill="#B84E17" />
        </svg>
      )}

      {kind === "empanada" && (
        <svg viewBox="0 0 200 200" role="img" aria-label={title ?? "Salado horneado"} style={{ width: "82%", height: "82%" }}>
          <ellipse cx="100" cy="150" rx="80" ry="16" fill="#FFFFFF" stroke="#E2D2BE" strokeWidth="2" />
          <path d="M36 140 Q40 70 100 64 Q160 70 164 140 Z" fill="#D9A15F" />
          <path d="M36 140 Q100 152 164 140" fill="none" stroke="#B77E3E" strokeWidth="10" strokeLinecap="round" strokeDasharray="2 12" />
          <path d="M70 100 Q100 88 130 100" fill="none" stroke="#E9BF85" strokeWidth="5" strokeLinecap="round" />
        </svg>
      )}

      {kind === "kit" && (
        <svg viewBox="0 0 220 200" role="img" aria-label={title ?? "Kit regalo APU"} style={{ width: "86%", height: "82%" }}>
          <ellipse cx="110" cy="182" rx="90" ry="9" fill="#2B1A12" opacity=".12" />
          <path d="M30 30 L96 30 L99 50 L27 50 Z" fill="#B88F66" />
          <path d="M27 50 L99 50 L106 178 L20 178 Z" fill="#CDA67D" />
          <rect x="40" y="80" width="46" height="64" rx="3" fill="#5C3A24" />
          <text x="63" y="112" textAnchor="middle" fill="#FFFFFF" fontSize="14" fontWeight="800" letterSpacing="3">APU</text>
          <text x="63" y="126" textAnchor="middle" fill="#F5EFE6" fontSize="7" fontFamily="Jost, sans-serif" letterSpacing="1.5">CLASSIC</text>
          <path d="M182 112 Q204 112 202 130 Q200 148 178 146" fill="none" stroke="#FFFFFF" strokeWidth="8" strokeLinecap="round" />
          <path d="M182 112 Q204 112 202 130 Q200 148 178 146" fill="none" stroke="#E2D2BE" strokeWidth="2" />
          <path d="M118 100 L186 100 L180 166 Q178 178 166 178 L138 178 Q126 178 124 166 Z" fill="#FFFFFF" stroke="#E2D2BE" strokeWidth="2" />
          <text x="152" y="146" textAnchor="middle" fill="#B84E17" fontSize="13" fontWeight="800" letterSpacing="2">APU</text>
        </svg>
      )}
    </div>
  );
}
