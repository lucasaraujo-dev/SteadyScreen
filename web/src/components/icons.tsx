// Small stroke icons (24x24, currentColor).

type P = { size?: number };

function Svg({ size = 20, children }: P & { children: React.ReactNode }) {
  return (
    <svg
      className="icon"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {children}
    </svg>
  );
}

export const ScreenIcon = (p: P) => (
  <Svg {...p}>
    <rect x="2.5" y="3.5" width="19" height="13" rx="2.5" />
    <path d="M8 20.5h8M12 16.5v4" />
  </Svg>
);

export const GridIcon = (p: P) => (
  <Svg {...p}>
    <rect x="3.5" y="3.5" width="7" height="7" rx="1.8" />
    <rect x="13.5" y="3.5" width="7" height="7" rx="1.8" />
    <rect x="3.5" y="13.5" width="7" height="7" rx="1.8" />
    <rect x="13.5" y="13.5" width="7" height="7" rx="1.8" />
  </Svg>
);

export const CameraIcon = (p: P) => (
  <Svg {...p}>
    <rect x="2.5" y="6" width="13" height="12" rx="2.5" />
    <path d="m15.5 10.5 6-3.5v10l-6-3.5" />
  </Svg>
);

export const StopIcon = (p: P) => (
  <Svg {...p}>
    <rect x="6" y="6" width="12" height="12" rx="2" />
  </Svg>
);

export const GearIcon = (p: P) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
  </Svg>
);

export const SendIcon = (p: P) => (
  <Svg {...p}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </Svg>
);

export const LinkIcon = (p: P) => (
  <Svg {...p}>
    <path d="M10 14a4.5 4.5 0 0 0 6.4 0l3.2-3.2a4.5 4.5 0 0 0-6.4-6.4L12 5.6" />
    <path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3.2 3.2a4.5 4.5 0 0 0 6.4 6.4l1.2-1.2" />
  </Svg>
);

export const CopyIcon = (p: P) => (
  <Svg {...p}>
    <rect x="8" y="8" width="12" height="12" rx="2.5" />
    <path d="M16 8V6.5A2.5 2.5 0 0 0 13.5 4h-7A2.5 2.5 0 0 0 4 6.5v7A2.5 2.5 0 0 0 6.5 16H8" />
  </Svg>
);

export const CheckIcon = (p: P) => (
  <Svg {...p}>
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </Svg>
);

export const CloseIcon = (p: P) => (
  <Svg {...p}>
    <path d="M6 6l12 12M18 6 6 18" />
  </Svg>
);

export const ExpandIcon = (p: P) => (
  <Svg {...p}>
    <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
  </Svg>
);

export const SoundIcon = (p: P) => (
  <Svg {...p}>
    <path d="M11 5 6 9H3v6h3l5 4V5Z" />
    <path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" />
  </Svg>
);

export const MuteIcon = (p: P) => (
  <Svg {...p}>
    <path d="M11 5 6 9H3v6h3l5 4V5Z" />
    <path d="m16 9 5 6M21 9l-5 6" />
  </Svg>
);

export const ShrinkIcon = (p: P) => (
  <Svg {...p}>
    <path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" />
  </Svg>
);

export const PipIcon = (p: P) => (
  <Svg {...p}>
    <rect x="2.5" y="4" width="19" height="16" rx="2.5" />
    <rect x="12" y="12" width="7" height="5" rx="1" />
  </Svg>
);

export const EyeIcon = (p: P) => (
  <Svg {...p}>
    <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
    <circle cx="12" cy="12" r="3" />
  </Svg>
);

export const EyeOffIcon = (p: P) => (
  <Svg {...p}>
    <path d="M9.9 5.7A9.8 9.8 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a17 17 0 0 1-2.6 3.4M6.6 6.6C4 8.3 2.5 12 2.5 12S6 18.5 12 18.5a9.5 9.5 0 0 0 5.4-1.7" />
    <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2M3 3l18 18" />
  </Svg>
);

export const ChevronRightIcon = (p: P) => (
  <Svg {...p}>
    <path d="m9 6 6 6-6 6" />
  </Svg>
);

export const ChevronLeftIcon = (p: P) => (
  <Svg {...p}>
    <path d="m15 6-6 6 6 6" />
  </Svg>
);

export const ChevronUpIcon = (p: P) => (
  <Svg {...p}>
    <path d="m6 15 6-6 6 6" />
  </Svg>
);

export const MicIcon = (p: P) => (
  <Svg {...p}>
    <rect x="9" y="2.5" width="6" height="11" rx="3" />
    <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5v4" />
  </Svg>
);

export const MicOffIcon = (p: P) => (
  <Svg {...p}>
    <path d="M15 9.5V5.5a3 3 0 0 0-5.7-1.3M9 9v1.5a3 3 0 0 0 4.6 2.5" />
    <path d="M18.5 11a6.5 6.5 0 0 1-.9 3.3M5.5 11a6.5 6.5 0 0 0 10 5.5M12 17.5v4M3 3l18 18" />
  </Svg>
);

export const HeadsetIcon = (p: P) => (
  <Svg {...p}>
    <path d="M3.5 18v-5a8.5 8.5 0 0 1 17 0v5" />
    <path d="M20.5 15v3a2.5 2.5 0 0 1-2.5 2.5h-1V13h1a2.5 2.5 0 0 1 2.5 2.5M3.5 15v3A2.5 2.5 0 0 0 6 20.5h1V13H6a2.5 2.5 0 0 0-2.5 2.5" />
  </Svg>
);

export const HeadsetOffIcon = (p: P) => (
  <Svg {...p}>
    <path d="M3.5 18v-5a8.5 8.5 0 0 1 13.6-6.8M20.1 9.6c.3.8.4 1.6.4 2.4v5" />
    <path d="M20.5 15v3a2.5 2.5 0 0 1-2.5 2.5h-1V17M3.5 15v3A2.5 2.5 0 0 0 6 20.5h1V13H6a2.5 2.5 0 0 0-2.5 2.5M3 3l18 18" />
  </Svg>
);

export const ScreenStopIcon = (p: P) => (
  <Svg {...p}>
    <rect x="2.5" y="3.5" width="19" height="13" rx="2.5" />
    <path d="M8 20.5h8M12 16.5v4M9.5 7.5l5 5M14.5 7.5l-5 5" />
  </Svg>
);

export const PhoneOffIcon = (p: P) => (
  <Svg {...p}>
    <path d="M3.4 13.6c-.8-.8-.8-2 .1-2.7C5.8 9 8.8 8 12 8s6.2 1 8.5 2.9c.9.7.9 1.9.1 2.7l-1.5 1.5c-.6.6-1.5.7-2.2.2l-1.6-1.2a1.5 1.5 0 0 1-.6-1.3v-1.6a12 12 0 0 0-5.4 0v1.6c0 .5-.2 1-.6 1.3l-1.6 1.2c-.7.5-1.6.4-2.2-.2Z" />
  </Svg>
);

export const WindowIcon = (p: P) => (
  <Svg {...p}>
    <rect x="3" y="4" width="18" height="16" rx="2.5" />
    <path d="M3 9h18M6.5 6.5h.01M9 6.5h.01" />
  </Svg>
);

export const TabIcon = (p: P) => (
  <Svg {...p}>
    <path d="M3 8.5V18a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8.5a2 2 0 0 0-2-2h-7L10.5 4H5a2 2 0 0 0-2 2v2.5h18" />
  </Svg>
);
