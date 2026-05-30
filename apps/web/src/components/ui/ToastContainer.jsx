import { useToast } from "../../contexts/ToastContext";
import { Toast } from "./Toast";

export const ToastContainer = () => {
  const { toasts } = useToast();

  return (
    <div
      className="pointer-events-none select-none absolute right-0 bottom-0 h-full w-70 flex flex-col-reverse p-4 gap-2 z-50"
      style={{
        maskImage:
          "linear-gradient(to bottom, rgba(0,0,0,0) 0%, rgba(0,0,0,0) 10%, rgba(0,0,0,1) 30%)",
        WebkitMaskImage:
          "linear-gradient(to bottom, rgba(0,0,0,0) 0%, rgba(0,0,0,0) 10%, rgba(0,0,0,1) 30%)",
      }}
    >
      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          type={toast.type}
          title={toast.title}
          text={toast.text}
          exiting={toast.exiting}
        />
      ))}
    </div>
  );
};
