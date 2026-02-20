export const convertNairaToKobo = (amount: string | number): number => {
  const numericAmount = typeof amount === "string" ? Number(amount) : amount;

  if (!Number.isFinite(numericAmount)) {
    throw new Error("Invalid monetary amount");
  }

  return Math.round(numericAmount * 100);
};
