// Small icons in the current text color. Most come from the Onyx set
// (public/icons, drawn through a CSS mask so they take any color); the few
// Onyx doesn't have stay as hand-drawn 24x24 strokes.

type P = { size?: number };

function Img({ name, size = 20 }: P & { name: string }) {
  return (
    <span
      className="icon icon-img"
      style={
        {
          width: size,
          height: size,
          "--icon": `url(/icons/${name}.png)`,
        } as React.CSSProperties
      }
      aria-hidden
    />
  );
}

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

export const ScreenIcon = (p: P) => <Img name="monitor" {...p} />;

export const GridIcon = (p: P) => (
  <Svg {...p}>
    <rect x="3.5" y="3.5" width="7" height="7" rx="1.8" />
    <rect x="13.5" y="3.5" width="7" height="7" rx="1.8" />
    <rect x="3.5" y="13.5" width="7" height="7" rx="1.8" />
    <rect x="13.5" y="13.5" width="7" height="7" rx="1.8" />
  </Svg>
);

export const CameraIcon = (p: P) => <Img name="filmadora" {...p} />;

export const StopIcon = (p: P) => (
  <Svg {...p}>
    <rect x="6" y="6" width="12" height="12" rx="2" />
  </Svg>
);

export const GearIcon = (p: P) => <Img name="configuracoes" {...p} />;

export const SendIcon = (p: P) => <Img name="enviar" {...p} />;

export const LinkIcon = (p: P) => <Img name="link" {...p} />;

export const CopyIcon = (p: P) => <Img name="copiar" {...p} />;

export const CheckIcon = (p: P) => <Img name="confirmar" {...p} />;

export const CloseIcon = (p: P) => <Img name="fechar" {...p} />;

export const ExpandIcon = (p: P) => (
  <Svg {...p}>
    <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
  </Svg>
);

export const SoundIcon = (p: P) => <Img name="volume-alto" {...p} />;

export const MuteIcon = (p: P) => <Img name="sem-som" {...p} />;

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

export const EyeIcon = (p: P) => <Img name="olho" {...p} />;

export const EyeOffIcon = (p: P) => (
  <Svg {...p}>
    <path d="M9.9 5.7A9.8 9.8 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a17 17 0 0 1-2.6 3.4M6.6 6.6C4 8.3 2.5 12 2.5 12S6 18.5 12 18.5a9.5 9.5 0 0 0 5.4-1.7" />
    <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2M3 3l18 18" />
  </Svg>
);

export const ChevronRightIcon = (p: P) => <Img name="chevron-direita" {...p} />;

export const ChevronLeftIcon = (p: P) => <Img name="chevron-esquerda" {...p} />;

export const ChevronUpIcon = (p: P) => <Img name="chevron-cima" {...p} />;

export const MicIcon = (p: P) => <Img name="microfone" {...p} />;

export const MicOffIcon = (p: P) => (
  <Svg {...p}>
    <path d="M15 9.5V5.5a3 3 0 0 0-5.7-1.3M9 9v1.5a3 3 0 0 0 4.6 2.5" />
    <path d="M18.5 11a6.5 6.5 0 0 1-.9 3.3M5.5 11a6.5 6.5 0 0 0 10 5.5M12 17.5v4M3 3l18 18" />
  </Svg>
);

export const HeadsetIcon = (p: P) => <Img name="fones-de-ouvido" {...p} />;

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

export const BellIcon = (p: P) => <Img name="sino" {...p} />;

export const LockIcon = (p: P) => <Img name="cadeado" {...p} />;

export const HomeIcon = (p: P) => <Img name="inicio" {...p} />;

export const TrashIcon = (p: P) => <Img name="lixeira" {...p} />;

export const LogOutIcon = (p: P) => <Img name="sair" {...p} />;

export const ArrowRightIcon = (p: P) => <Img name="seta-direita" {...p} />;

export const ArrowLeftIcon = (p: P) => <Img name="seta-esquerda" {...p} />;
export const NoteIcon = (p: P) => <Img name="nota" {...p} />;
export const FilmIcon = (p: P) => <Img name="filme" {...p} />;
export const BoltIcon = (p: P) => <Img name="raio" {...p} />;
export const PhotoIcon = (p: P) => <Img name="camera" {...p} />;
export const MailIcon = (p: P) => <Img name="envelope" {...p} />;
export const PhoneIcon = (p: P) => <Img name="celular" {...p} />;
export const UserIcon = (p: P) => <Img name="usuario" {...p} />;
export const PencilIcon = (p: P) => <Img name="lapis" {...p} />;
export const VerifiedIcon = (p: P) => <Img name="escudo-verificado" {...p} />;
export const ImageIcon = (p: P) => <Img name="imagem" {...p} />;
