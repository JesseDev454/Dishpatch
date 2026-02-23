type PageLoaderProps = {
  message?: string;
};

export const PageLoader = ({ message = "Loading..." }: PageLoaderProps) => {
  return (
    <div className="grid min-h-screen place-items-center px-4">
      <div className="card-base w-full max-w-md p-6">
        <p className="inline-flex items-center gap-2 text-sm font-medium text-slate-700">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-brand-200 border-t-brand-500" />
          {message}
        </p>
      </div>
    </div>
  );
};
