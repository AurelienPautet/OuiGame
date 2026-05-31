import type { ReactNode } from "react";
import { Topbar } from "./Topbar";
import { ModalRenderer } from "../modals/ModalRenderer";
import { ToastContainer } from "../ui";

interface MenuLayoutProps {
  children: ReactNode;
  /** Constrain + pad the content column. Disable for full-bleed screens. */
  contained?: boolean;
}

/**
 * Shell for the (responsive, scrollable) menu screens — Home, Level Select,
 * Rankings. Graph-paper field + sticky Topbar + the shared overlay/toast layer.
 * Gameplay and the editors do NOT use this (they render in the scaled stage).
 */
export const MenuLayout = ({ children, contained = true }: MenuLayoutProps) => {
  return (
    <div className="graph-paper min-h-screen relative flex flex-col">
      <Topbar />
      {contained ? (
        <main className="w-full max-w-[1280px] mx-auto px-5 pb-16 flex-1">
          {children}
        </main>
      ) : (
        <main className="flex-1">{children}</main>
      )}
      <ModalRenderer />
      <ToastContainer />
    </div>
  );
};
