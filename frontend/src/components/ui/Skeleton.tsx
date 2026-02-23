import { cn } from "../../lib/cn";

type SkeletonProps = {
  className?: string;
};

export const Skeleton = ({ className }: SkeletonProps) => {
  return <div className={cn("animate-pulse rounded-xl bg-slate-200/90", className)} />;
};
