import { Audio } from 'expo-av';

let sound: Audio.Sound | null = null;

/** Play Polly (or mock) TTS from a translate `audio_ready` presigned URL. */
export async function playTranslateTts(url: string): Promise<void> {
  if (!url) return;
  try {
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
    });
    if (sound) {
      await sound.unloadAsync().catch(() => undefined);
      sound = null;
    }
    const created = await Audio.Sound.createAsync(
      { uri: url },
      { shouldPlay: true, volume: 1 },
    );
    sound = created.sound;
    sound.setOnPlaybackStatusUpdate((status) => {
      if (!status.isLoaded) return;
      if (status.didJustFinish) {
        void sound?.unloadAsync().catch(() => undefined);
        sound = null;
      }
    });
  } catch {
    // TTS playback is best-effort — captions still show.
  }
}

export async function stopTranslateTts(): Promise<void> {
  if (!sound) return;
  try {
    await sound.stopAsync();
    await sound.unloadAsync();
  } catch {
    // ignore
  }
  sound = null;
}
