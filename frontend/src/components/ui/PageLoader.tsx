type PageLoaderProps = {
  message?: string;
};

export const PageLoader = ({ message = "Loading..." }: PageLoaderProps) => {
  return (
    <div className="grid min-h-screen place-items-center px-4">
      <div className="w-full max-w-md rounded-2xl border bg-card/95 p-6 shadow-card backdrop-blur">
        <p className="inline-flex items-center gap-2 text-sm font-medium text-foreground">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary/20 border-t-primary" />
          {message}
        </p>
      </div>
    </div>
  );
};
