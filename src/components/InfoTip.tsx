import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Info } from "lucide-react";
export default function InfoTip({
  label,
  content,
}: {
  label: string;
  content: string;
}) {
  const id = useId(),
    button = useRef<HTMLButtonElement>(null),
    panel = useRef<HTMLDivElement>(null);
  const [pinned, setPinned] = useState(false),
    [hover, setHover] = useState(false),
    [focus, setFocus] = useState(false),
    [dismissed, setDismissed] = useState(false);
  const [position, setPosition] = useState({ left: 12, top: 12, width: 300 });
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const open = !dismissed && (pinned || hover || focus);
  const enter = () => {
    clearTimeout(timer.current);
    setHover(true);
    setDismissed(false);
  };
  const leave = () => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setHover(false), 160);
  };
  useEffect(() => () => clearTimeout(timer.current), []);
  useEffect(() => {
    if (!open) return;
    const close = () => {
      setPinned(false);
      setDismissed(true);
    };
    const pointer = (e: PointerEvent) => {
      if (
        !button.current?.contains(e.target as Node) &&
        !panel.current?.contains(e.target as Node)
      )
        close();
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
      }
    };
    document.addEventListener("pointerdown", pointer);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("pointerdown", pointer);
      document.removeEventListener("keydown", key);
    };
  }, [open]);
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const rect = button.current?.getBoundingClientRect();
      if (!rect) return;
      const viewportWidth = document.documentElement.clientWidth;
      const viewportHeight = document.documentElement.clientHeight;
      const width = Math.min(320, viewportWidth - 24),
        height = panel.current?.getBoundingClientRect().height ?? 120;
      const below = rect.bottom + 8;
      setPosition({
        width,
        left: Math.max(12, Math.min(rect.left, viewportWidth - width - 12)),
        top: Math.max(
          12,
          Math.min(
            below + height <= viewportHeight - 12
              ? below
              : rect.top - height - 8,
            viewportHeight - height - 12,
          ),
        ),
      });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, content]);
  return (
    <span
      className="info-tip-anchor"
      onPointerEnter={enter}
      onPointerLeave={leave}
    >
      <button
        ref={button}
        className="info-tip-trigger"
        type="button"
        aria-label={`About ${label}`}
        aria-expanded={open}
        aria-describedby={open ? id : undefined}
        onFocus={() => {
          setFocus(true);
          setDismissed(false);
        }}
        onBlur={() => {
          setFocus(false);
          setPinned(false);
        }}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setPinned(!pinned);
          setDismissed(pinned);
        }}
      >
        <Info size={14} aria-hidden="true" />
      </button>
      {open &&
        createPortal(
          <div
            ref={panel}
            id={id}
            role="tooltip"
            className="info-tip-panel"
            style={position}
            onPointerEnter={enter}
            onPointerLeave={leave}
          >
            <strong>{label}</strong>
            <p>{content}</p>
          </div>,
          document.body,
        )}
    </span>
  );
}
