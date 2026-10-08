import { useEffect } from "react";
import { useAuth, useGame } from "../hooks";
import { getNotificationSoundPreference, useNotificationPreference } from "../hooks/useNotificationPreference";
import { RoundStatus } from "../types";

const IDLE_NOTIFY_MS = 45_000;
const IDLE_AUDIO_MS = 60_000;
// Drop your file at apps/web/public/idle.mp3
const IDLE_AUDIO_URL = `${import.meta.env.BASE_URL}idle.mp3`;

let audioContext: AudioContext | undefined;

const playChime = () => {
  try {
    audioContext ??= new AudioContext();
    const ctx = audioContext;
    void ctx.resume();
    [660, 880].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const start = ctx.currentTime + i * 0.18;
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.2, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.3);
      osc.connect(gain).connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.3);
    });
  } catch {
    // Audio is best-effort.
  }
};

const notify = (title: string, body: string, tag: string) => {
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
  new Notification(title, { body, tag, silent: true });
  if (getNotificationSoundPreference()) playChime();
};

// Renders nothing; fires browser notifications when the player's attention is needed.
const NotificationManager = () => {
  const enabled = useNotificationPreference();
  const { user } = useAuth();
  const { currentRound, players } = useGame();

  const roundId = currentRound?.id;
  const status = currentRound?.status;
  const isCzar = !!user && currentRound?.cardCzarId === user.id;
  const hasPlayed = !!user && !!currentRound?.plays[user.id]?.length;

  // Everyone else (besides the czar) has already played, so only this player is holding up the round.
  const isLastToPlay = !!user && players.every(
    (p) => p.id === user.id || p.id === currentRound?.cardCzarId || !!currentRound?.plays[p.id]?.length,
  );

  useEffect(() => {
    if (enabled && isCzar && status === RoundStatus.SELECTING_WINNER) {
      notify("Time to pick!", "Everyone has played. Choose the winning card.", `czar-${roundId}`);
    }
  }, [enabled, isCzar, status, roundId]);

  useEffect(() => {
    if (!enabled || isCzar || hasPlayed || status !== RoundStatus.WAITING_FOR_PLAYERS) return;
    const timer = setTimeout(
      () => notify("Your turn to play", "Everyone is waiting on your cards.", `play-${roundId}`),
      IDLE_NOTIFY_MS,
    );
    return () => clearTimeout(timer);
  }, [enabled, isCzar, hasPlayed, status, roundId]);

  // Plays the idle track once the last player to play has been holding up the round for a minute.
  useEffect(() => {
    if (!enabled || isCzar || hasPlayed || !isLastToPlay || status !== RoundStatus.WAITING_FOR_PLAYERS) return;
    let audio: HTMLAudioElement | undefined;
    const timer = setTimeout(() => {
      if (!getNotificationSoundPreference()) return;
      audio = new Audio(IDLE_AUDIO_URL);
      audio.play().catch(() => {
        // Blocked by autoplay policy or missing file.
      });
    }, IDLE_AUDIO_MS);
    return () => {
      clearTimeout(timer);
      audio?.pause();
    };
  }, [enabled, isCzar, hasPlayed, isLastToPlay, status, roundId]);

  return null;
};

export default NotificationManager;
