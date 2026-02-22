type AsyncJob = () => Promise<void>;

const pendingJobs = new Set<Promise<void>>();

export const enqueueAsyncJob = (job: AsyncJob): void => {
  setImmediate(() => {
    const runningJob = job()
      .catch((error) => {
        console.error("Background job failed", error);
      })
      .finally(() => {
        pendingJobs.delete(runningJob);
      });

    pendingJobs.add(runningJob);
  });
};

export const waitForAsyncJobs = async (): Promise<void> => {
  await new Promise<void>((resolve) => setImmediate(resolve));

  while (pendingJobs.size > 0) {
    await Promise.all(Array.from(pendingJobs));
  }
};
