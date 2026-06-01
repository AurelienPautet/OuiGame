import { cn } from "../../../lib/cn";

interface IoTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {
  as?: "h1" | "h2" | "h3" | "div";
}

/** Big outlined arcade heading (white fill, dark text-outline stack). */
export function IoTitle({
  as: Tag = "h2",
  className,
  children,
  ...props
}: IoTitleProps) {
  return (
    <Tag className={cn("io-title font-display", className)} {...props}>
      {children}
    </Tag>
  );
}
