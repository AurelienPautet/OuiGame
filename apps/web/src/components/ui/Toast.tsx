import { TOAST_TYPES } from "../../contexts/ToastContext";
import {
  Wifi,
  WifiOff,
  Crosshair,
  Bomb,
  Info,
  XCircle,
  CheckCircle,
  type LucideIcon,
} from "lucide-react";

// Icon mapping for toast types
const TOAST_ICONS: Record<string, LucideIcon> = {
  [TOAST_TYPES.CONNECTION]: Wifi,
  [TOAST_TYPES.DISCONNECTION]: WifiOff,
  [TOAST_TYPES.BULLET]: Crosshair,
  [TOAST_TYPES.MINE]: Bomb,
  [TOAST_TYPES.INFO]: Info,
  [TOAST_TYPES.ERROR]: XCircle,
  [TOAST_TYPES.SUCCESS]: CheckCircle,
};

// Color classes for each toast type
const TOAST_COLORS: Record<string, string> = {
  [TOAST_TYPES.CONNECTION]:
    "bg-success/90 border-success/50 text-success-content",
  [TOAST_TYPES.DISCONNECTION]: "bg-error/90 border-error/50 text-error-content",
  [TOAST_TYPES.BULLET]: "bg-pink-500/90 border-pink-500/50 text-white",
  [TOAST_TYPES.MINE]: "bg-warning/90 border-warning/50 text-warning-content",
  [TOAST_TYPES.INFO]: "bg-info/90 border-info/50 text-info-content",
  [TOAST_TYPES.ERROR]: "bg-error/90 border-error/50 text-error-content",
  [TOAST_TYPES.SUCCESS]: "bg-success/90 border-success/50 text-success-content",
};

interface ToastProps {
  type: string;
  title: string;
  text: string;
  exiting?: boolean;
}

export const Toast = ({ type, title, text, exiting }: ToastProps) => {
  const Icon = TOAST_ICONS[type] || Info;
  const colorClass = TOAST_COLORS[type] || TOAST_COLORS[TOAST_TYPES.INFO];

  return (
    <div
      role="alert"
      aria-live="polite"
      className={`w-full min-h-16 p-3 rounded-lg flex flex-col gap-1 backdrop-blur-md border shadow-lg ${colorClass} ${
        exiting
          ? "animate-[slideOutRight_0.5s_ease-in_forwards]"
          : "animate-[slideInRight_0.3s_ease-out_forwards]"
      }`}
    >
      <div className="flex items-center gap-2">
        <Icon size={20} className="shrink-0" />
        <span className="text-sm font-bold">{title}</span>
      </div>
      <span className="text-xs ml-7 leading-tight">{text}</span>
    </div>
  );
};
