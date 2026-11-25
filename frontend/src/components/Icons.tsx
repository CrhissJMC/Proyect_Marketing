import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement> & { size?: number };

const base = (size = 22): SVGProps<SVGSVGElement> => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
});

export const IconSearch = ({ size, ...p }: P) => (<svg {...base(size)} {...p}><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></svg>);
export const IconUser = ({ size, ...p }: P) => (<svg {...base(size)} {...p}><circle cx="12" cy="8" r="4" /><path d="M4 21c1-4 4-6 8-6s7 2 8 6" /></svg>);
export const IconCart = ({ size = 30, ...p }: P) => (<svg {...base(size)} viewBox="0 0 32 32" strokeWidth={2} {...p}><path d="M3 5h4l3 15h15l3-10H9" /><circle cx="12" cy="26" r="2" /><circle cx="23" cy="26" r="2" /><path d="M14 10v6M18 10v6M22 10v6" /></svg>);
export const IconMenu = ({ size, ...p }: P) => (<svg {...base(size)} {...p}><path d="M4 7h16M4 12h16M4 17h16" /></svg>);
export const IconClose = ({ size, ...p }: P) => (<svg {...base(size)} {...p}><path d="M6 6l12 12M18 6L6 18" /></svg>);
export const IconPlus = ({ size = 18, ...p }: P) => (<svg {...base(size)} strokeWidth={2} {...p}><path d="M12 5v14M5 12h14" /></svg>);
export const IconArrow = ({ size = 18, ...p }: P) => (<svg {...base(size)} strokeWidth={2} {...p}><path d="M5 12h14M13 6l6 6-6 6" /></svg>);
export const IconCheck = ({ size = 18, ...p }: P) => (<svg {...base(size)} strokeWidth={2.2} {...p}><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>);
export const IconTrash = ({ size = 20, ...p }: P) => (<svg {...base(size)} {...p}><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" /></svg>);
export const IconTruck = ({ size = 20, ...p }: P) => (<svg {...base(size)} {...p}><path d="M3 7h11v9H3zM14 10h4l3 3v3h-7" /><circle cx="7" cy="18" r="1.6" /><circle cx="17" cy="18" r="1.6" /></svg>);
export const IconStore = ({ size = 20, ...p }: P) => (<svg {...base(size)} {...p}><path d="M4 10l2-5h12l2 5M4 10h16v10H4zM9 20v-5h6v5" /></svg>);
export const IconShield = ({ size = 20, ...p }: P) => (<svg {...base(size)} {...p}><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" /><path d="M9 12l2 2 4-4" /></svg>);
export const IconReturn = ({ size = 20, ...p }: P) => (<svg {...base(size)} {...p}><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5" /></svg>);
export const IconLock = ({ size = 18, ...p }: P) => (<svg {...base(size)} {...p}><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>);
export const IconClock = ({ size = 22, ...p }: P) => (<svg {...base(size)} {...p}><circle cx="12" cy="13" r="8" /><path d="M12 9v4l3 2M9 2h6" /></svg>);
export const IconInfo = ({ size = 22, ...p }: P) => (<svg {...base(size)} {...p}><circle cx="12" cy="12" r="9" /><path d="M12 8v5M12 16.5v.5" /></svg>);
export const IconX = ({ size = 22, ...p }: P) => (<svg {...base(size)} {...p}><circle cx="12" cy="12" r="9" /><path d="M15 9l-6 6M9 9l6 6" /></svg>);
export const IconDownload = ({ size = 18, ...p }: P) => (<svg {...base(size)} {...p}><path d="M12 4v11M7 10l5 5 5-5M5 20h14" /></svg>);
export const IconLeaf = ({ size = 20, ...p }: P) => (<svg {...base(size)} strokeWidth={1.6} {...p}><path d="M5 19c8 0 14-6 14-14-8 0-14 6-14 14z" /><path d="M5 19l7-7" /></svg>);
export const IconHands = ({ size = 20, ...p }: P) => (<svg {...base(size)} strokeWidth={1.6} {...p}><path d="M3 12l4-4 5 3 5-3 4 4" /><path d="M7 8v8l5 3 5-3V8" /></svg>);
export const IconMountain = ({ size = 20, ...p }: P) => (<svg {...base(size)} strokeWidth={1.6} {...p}><path d="M2 20l7-12 4 6 3-4 6 10z" /></svg>);
export const IconBean = ({ size = 20, ...p }: P) => (<svg {...base(size)} strokeWidth={1.6} {...p}><ellipse cx="12" cy="12" rx="6" ry="9" /><path d="M12 3c-2 4 2 8 0 18" /></svg>);
export const IconBook = ({ size = 34, ...p }: P) => (<svg width={size} height={(size * 26) / 34} viewBox="0 0 34 26" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinejoin="round" aria-hidden {...p}><path d="M17 6C12 2 6 2 2 4v18c4-2 10-2 15 2 5-4 11-4 15-2V4c-4-2-10-2-15 2z" /><path d="M17 6v18" /></svg>);
export const IconInstagram = ({ size = 24, ...p }: P) => (<svg {...base(size)} {...p}><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r="1" fill="currentColor" /></svg>);
export const IconFacebook = ({ size = 24, ...p }: P) => (<svg {...base(size)} {...p}><rect x="3" y="3" width="18" height="18" rx="4" /><path d="M15 8h-2a2 2 0 0 0-2 2v11M9 13h5" /></svg>);
export const IconTiktok = ({ size = 24, ...p }: P) => (<svg {...base(size)} {...p}><path d="M14 3v11a4 4 0 1 1-4-4" /><path d="M14 3c.5 2.5 2.5 4.5 5 5" /></svg>);
export const IconWhatsapp = ({ size = 22, ...p }: P) => (<svg {...base(size)} strokeWidth={1.7} {...p}><path d="M4 20l1.3-3.8A8 8 0 1 1 8 19z" /><path d="M9 9.5c.3 2 2.5 4.2 4.5 4.5l1-1.2 2 .8c-.3 1.2-1.3 2-2.5 1.8-3-.5-5.6-3.1-6-6-.2-1.2.6-2.2 1.8-2.5l.8 2z" /></svg>);

export function Logo({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden>
      <path d="M6 38 L18 18 L25 28 L31 20 L42 38 Z" stroke="#C9A27A" strokeWidth="2.2" strokeLinejoin="round" />
      <g className="steam">
        <path d="M22 13c-2-3 2-4 0-8" stroke="#F5EFE6" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M28 14c-2-3 2-4 0-8" stroke="#F5EFE6" strokeWidth="1.8" strokeLinecap="round" />
      </g>
    </svg>
  );
}
