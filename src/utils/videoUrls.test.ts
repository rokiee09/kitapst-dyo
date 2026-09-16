import { describe, expect, it } from "vitest";
import { vimeoVideoId, youtubeVideoId } from "@/utils/videoUrls";

describe("youtubeVideoId", () => {
  it("watch ve kısa linkleri çözer", () => {
    expect(youtubeVideoId("https://www.youtube.com/watch?v=dQw4w9wgGcQ")).toBe("dQw4w9wgGcQ");
    expect(youtubeVideoId("https://youtu.be/dQw4w9wgGcQ")).toBe("dQw4w9wgGcQ");
  });
});

describe("vimeoVideoId", () => {
  it("sayısal kimliği çıkarır", () => {
    expect(vimeoVideoId("https://vimeo.com/123456789")).toBe("123456789");
  });
});
