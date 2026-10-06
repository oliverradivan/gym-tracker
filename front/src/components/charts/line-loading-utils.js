export function resolveLineLoadingPulseMode(phase) {
  switch (phase) {
    case "loading":
      return "loop";
    case "exiting":
      return "exit";
    case "revealingLoading":
      return "enter";
    default:
      return null;
  }
}
