import { Children, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

type RevealProps = {
  children: ReactNode;
  className?: string;
  delay?: number;
  y?: number;
  x?: number;
  scale?: number;
  duration?: number;
};

export const Reveal = ({
  children,
  className,
  delay = 0,
  y = 18,
  x = 0,
  scale = 0.98,
  duration = 0.5
}: RevealProps) => {
  const reducedMotion = useReducedMotion() ?? false;

  if (reducedMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y, x, scale }}
      whileInView={{ opacity: 1, y: 0, x: 0, scale: 1 }}
      viewport={{ once: true, amount: 0.25 }}
      transition={{ duration, ease: "easeOut", delay }}
      className={className}
    >
      {children}
    </motion.div>
  );
};

type RevealStaggerProps = {
  children: ReactNode;
  className?: string;
  childClassName?: string;
  stagger?: number;
  delayChildren?: number;
  y?: number;
  scale?: number;
  duration?: number;
};

export const RevealStagger = ({
  children,
  className,
  childClassName,
  stagger = 0.1,
  delayChildren = 0,
  y = 18,
  scale = 0.98,
  duration = 0.5
}: RevealStaggerProps) => {
  const reducedMotion = useReducedMotion() ?? false;

  if (reducedMotion) {
    return <div className={className}>{children}</div>;
  }

  const nodes = Children.toArray(children);

  return (
    <motion.div
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount: 0.25 }}
      variants={{
        hidden: {},
        show: {
          transition: {
            staggerChildren: stagger,
            delayChildren
          }
        }
      }}
      className={className}
    >
      {nodes.map((child, index) => (
        <motion.div
          key={(typeof child === "object" && child && "key" in child && child.key) ? String(child.key) : `reveal-${index}`}
          variants={{
            hidden: { opacity: 0, y, scale },
            show: {
              opacity: 1,
              y: 0,
              scale: 1,
              transition: {
                duration,
                ease: "easeOut"
              }
            }
          }}
          className={childClassName}
        >
          {child}
        </motion.div>
      ))}
    </motion.div>
  );
};

type AnimatedListProps = {
  children: ReactNode;
  className?: string;
};

export const AnimatedList = ({ children, className }: AnimatedListProps) => {
  const reducedMotion = useReducedMotion() ?? false;
  if (reducedMotion) {
    return <div className={className}>{children}</div>;
  }

  return <div className={cn("space-y-2", className)}>{children}</div>;
};

type AnimatedListItemProps = {
  children: ReactNode;
  className?: string;
  itemKey: string | number;
};

export const AnimatedListItem = ({ children, className, itemKey }: AnimatedListItemProps) => {
  const reducedMotion = useReducedMotion() ?? false;
  if (reducedMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      key={itemKey}
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className={className}
    >
      {children}
    </motion.div>
  );
};

export { AnimatePresence, motion, useReducedMotion };
