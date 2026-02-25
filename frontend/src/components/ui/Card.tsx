import { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

type CardProps = HTMLAttributes<HTMLDivElement> & {
  title?: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
};

export const Card = ({ className, children, title, subtitle, action, ...props }: CardProps) => {
  return (
    <section className={cn("card-base rounded-2xl", className)} {...props}>
      {title || action ? (
        <header className="flex items-start justify-between gap-3 border-b px-6 py-5">
          <div>
            {title ? <h3 className="text-base font-semibold tracking-tight text-foreground sm:text-lg">{title}</h3> : null}
            {subtitle ? <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{subtitle}</p> : null}
          </div>
          {action ? <div>{action}</div> : null}
        </header>
      ) : null}
      <div className="p-6">{children}</div>
    </section>
  );
};
