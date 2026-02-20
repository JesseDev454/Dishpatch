import { convertNairaToKobo } from "../../utils/money";

describe("convertNairaToKobo", () => {
  it("converts decimal string naira amount to kobo", () => {
    expect(convertNairaToKobo("6399.98")).toBe(639998);
  });

  it("converts numeric naira amount to kobo", () => {
    expect(convertNairaToKobo(2500)).toBe(250000);
  });

  it("rounds floating precision correctly", () => {
    expect(convertNairaToKobo("100.335")).toBe(10034);
  });

  it("throws for invalid values", () => {
    expect(() => convertNairaToKobo("not-a-number")).toThrow("Invalid monetary amount");
  });
});
