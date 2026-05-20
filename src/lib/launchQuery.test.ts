import { describe, expect, it } from "vitest";
import { parseLaunchIntent } from "./launchQuery";

describe("parseLaunchIntent", () => {
  it("parses episode", () => {
    expect(parseLaunchIntent("?episode=47")).toEqual({ kind: "episode", seriesIndex: 47 });
  });

  it("parses season including pilot", () => {
    expect(parseLaunchIntent("?season=0")).toEqual({ kind: "season", seasonIndex: 0 });
    expect(parseLaunchIntent("?season=4")).toEqual({ kind: "season", seasonIndex: 4 });
  });

  it("parses screen", () => {
    expect(parseLaunchIntent("?screen=trust")).toEqual({ kind: "screen", screen: "trust" });
  });

  it("rejects invalid values", () => {
    expect(parseLaunchIntent("?episode=0")).toBeNull();
    expect(parseLaunchIntent("?season=99")).toBeNull();
  });
});
