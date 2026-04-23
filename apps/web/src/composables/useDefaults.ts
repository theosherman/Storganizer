import { useLocalStorage } from "@vueuse/core";

export type CameraMode = "continuous" | "native";

export function useDefaultContainer() {
  return useLocalStorage<string | null>("default-container", null);
}

export function useDefaultLocation() {
  return useLocalStorage<string | null>("default-location", null);
}

export function useCameraMode() {
  return useLocalStorage<CameraMode>("camera-mode", "continuous");
}
