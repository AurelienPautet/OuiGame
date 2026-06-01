import { motion } from "motion/react";
import { TOAST_TYPES } from "../../contexts/ToastContext";
import { springs } from "../../lib/motion";
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

// Arcade colour per toast type — solid team colour + ink outline.
const TOAST_COLORS: Record<string, string> = {
  [TOAST_TYPES.CONNECTION]: "bg-green text-white",
  [TOAST_TYPES.DISCONNECTION]: "bg-red text-white",
  [TOAST_TYPES.BULLET]: "bg-purple text-white",
  [TOAST_TYPES.MINE]: "bg-orange text-ink",
  [TOAST_TYPES.INFO]: "bg-blue text-white",
  [TOAST_TYPES.ERROR]: "bg-red text-white",
  [TOAST_TYPES.SUCCESS]: "bg-green text-white",
};

interface ToastProps {
  type: string;
  title: string;
  text: string;
}

export const Toast = ({ type, title, text }: ToastProps) => {
  const Icon = TOAST_ICONS[type] || Info;
  const colorClass = TOAST_COLORS[type] || TOAST_COLORS[TOAST_TYPES.INFO];

  return (
    <motion.div
      role="alert"
      aria-live="polite"
      layout
      initial={{ opacity: 0, x: 60, scale: 0.85 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 60, scale: 0.85, transition: { duration: 0.22 } }}
      transition={springs.snappy}
      className={`w-full min-h-16 p-3 rounded-xl flex flex-col gap-1 border-[3px] border-ink shadow-arcade ${colorClass}`}
    >
      <div className="flex items-center gap-2">
        <Icon size={20} className="shrink-0" />
        <span className="text-sm font-bold">{title}</span>
      </div>
      <span className="text-xs ml-7 leading-tight">{text}</span>
    </motion.div>
  );
};
