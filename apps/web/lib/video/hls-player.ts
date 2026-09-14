export async function attachHlsPlayback(video: HTMLVideoElement, url: string): Promise<() => void> {
  if (video.canPlayType("application/vnd.apple.mpegurl")) {
    video.src = url;
    return () => {
      video.removeAttribute("src");
      video.load();
    };
  }
  const { default: Hls } = await import("hls.js");
  if (!Hls.isSupported()) {
    throw new Error("HLS playback is not supported in this browser");
  }
  const hls = new Hls({ enableWorker: true, lowLatencyMode: false });
  hls.loadSource(url);
  hls.attachMedia(video);
  return () => {
    hls.destroy();
  };
}
