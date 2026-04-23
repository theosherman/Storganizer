<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, reactive, computed, watch } from "vue";
import { useContainers } from "@/composables/useContainers";
import { useLocations } from "@/composables/useLocations";
import {
  useDefaultContainer,
  useDefaultLocation,
  useCameraMode,
} from "@/composables/useDefaults";
import EntityCombobox from "@/components/EntityCombobox.vue";

const mode = useCameraMode();
const defaultContainer = useDefaultContainer();
const defaultLocation = useDefaultLocation();

const { containers, fetchAll: fetchContainers, create: createContainer } = useContainers();
const { locations, fetchAll: fetchLocations, create: createLocation } = useLocations();

interface Thumb {
  id: string;
  blobUrl: string;
  status: "uploading" | "processing" | "ready" | "error";
  itemId: string | null;
}
const thumbs = ref<Thumb[]>([]);
const fileInput = ref<HTMLInputElement | null>(null);
const videoEl = ref<HTMLVideoElement | null>(null);
const canvasEl = ref<HTMLCanvasElement | null>(null);
const stream = ref<MediaStream | null>(null);
const fallbackNotice = ref<string | null>(null);

function applyContainer(id: string | null) {
  defaultContainer.value = id;
  if (id) {
    const c = containers.value.find((x) => x.id === id);
    if (c?.location_id) defaultLocation.value = c.location_id;
  }
}
function applyLocation(id: string | null) {
  defaultLocation.value = id;
  if (id && defaultContainer.value) {
    const c = containers.value.find((x) => x.id === defaultContainer.value);
    if (c && c.location_id !== id) defaultContainer.value = null;
  }
}
async function createContainerAt(name: string) {
  return await createContainer(name, defaultLocation.value ?? undefined);
}
async function createLocationAt(name: string) {
  return await createLocation(name);
}

async function uploadBlob(blob: Blob, filename: string) {
  const blobUrl = URL.createObjectURL(blob);
  const thumb = reactive<Thumb>({
    id: `tmp-${Date.now()}-${Math.random()}`,
    blobUrl,
    status: "uploading",
    itemId: null,
  });
  thumbs.value = [thumb, ...thumbs.value].slice(0, 5);
  try {
    const fd = new FormData();
    fd.append("photo", blob, filename);
    if (defaultContainer.value) fd.append("container_id", defaultContainer.value);
    const res = await fetch("/api/items/upload", {
      method: "POST",
      credentials: "include",
      body: fd,
    });
    if (!res.ok) throw new Error("upload failed");
    const data = (await res.json()) as { item: { id: string; status: string } };
    thumb.itemId = data.item.id;
    thumb.status = data.item.status === "ready" ? "ready" : "processing";
  } catch {
    thumb.status = "error";
  }
}

async function startStream() {
  fallbackNotice.value = null;
  try {
    const s = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "environment" },
    });
    stream.value = s;
    if (videoEl.value) {
      try {
        videoEl.value.srcObject = s;
      } catch {
        // Mocked/synthetic streams may not satisfy HTMLMediaElement.srcObject;
        // don't fail the whole startStream path over a playback binding.
      }
      await videoEl.value.play().catch(() => {});
    }
  } catch {
    fallbackNotice.value = "Camera unavailable — switched to Native mode.";
    mode.value = "native";
  }
}

function stopStream() {
  stream.value?.getTracks().forEach((t) => t.stop());
  stream.value = null;
}

async function captureFromStream() {
  if (!videoEl.value || !canvasEl.value) return;
  const v = videoEl.value;
  const c = canvasEl.value;
  c.width = v.videoWidth || 1280;
  c.height = v.videoHeight || 960;
  const ctx = c.getContext("2d");
  if (!ctx) return;
  ctx.drawImage(v, 0, 0, c.width, c.height);
  const blob: Blob | null = await new Promise((resolve) =>
    c.toBlob((b) => resolve(b), "image/jpeg", 0.9)
  );
  if (blob) await uploadBlob(blob, `shot-${Date.now()}.jpg`);
}

function onShutter() {
  if (mode.value === "continuous") captureFromStream();
  else fileInput.value?.click();
}
async function onFilePicked(e: Event) {
  const target = e.target as HTMLInputElement;
  const files = Array.from(target.files ?? []);
  target.value = "";
  for (const file of files) await uploadBlob(file, file.name);
}

onMounted(async () => {
  await Promise.all([fetchContainers(), fetchLocations()]);
  if (mode.value === "continuous") await startStream();
});

watch(mode, async (next) => {
  if (next === "continuous") await startStream();
  else stopStream();
});

onBeforeUnmount(stopStream);

const shownContainers = computed(() =>
  containers.value.filter((c) => !defaultLocation.value || c.location_id === defaultLocation.value)
);
</script>

<template>
  <div class="fixed inset-0 bg-[var(--color-bg)] text-[var(--color-text)] flex flex-col">
    <div class="flex items-center gap-2 p-3 border-b border-[var(--color-border)]">
      <RouterLink
        to="/"
        class="px-2 py-1 text-sm text-[var(--color-muted)] hover:text-[var(--color-text)]"
        aria-label="Back"
      >← Back</RouterLink>
      <div class="flex-1" />
      <div role="group" class="flex bg-[var(--color-raised)] rounded-[var(--radius-input)] p-0.5">
        <button
          type="button"
          :class="[
            'px-3 py-1 text-sm rounded-[var(--radius-input)]',
            mode === 'continuous' ? 'bg-[var(--color-accent)]' : 'text-[var(--color-muted)]',
          ]"
          @click="mode = 'continuous'"
        >Continuous</button>
        <button
          type="button"
          :class="[
            'px-3 py-1 text-sm rounded-[var(--radius-input)]',
            mode === 'native' ? 'bg-[var(--color-accent)]' : 'text-[var(--color-muted)]',
          ]"
          @click="mode = 'native'"
        >Native</button>
      </div>
    </div>

    <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 p-3 border-b border-[var(--color-border)]">
      <EntityCombobox
        data-testid="location-combobox"
        entity-label="location"
        :list="locations"
        :model-value="defaultLocation"
        :create-fn="createLocationAt"
        @update:model-value="applyLocation"
      />
      <EntityCombobox
        data-testid="container-combobox"
        entity-label="container"
        :list="shownContainers"
        :model-value="defaultContainer"
        :create-fn="createContainerAt"
        @update:model-value="applyContainer"
      />
    </div>

    <div class="flex-1 flex items-center justify-center bg-black relative">
      <p
        v-if="fallbackNotice"
        data-testid="camera-fallback-notice"
        class="absolute top-2 left-1/2 -translate-x-1/2 bg-[var(--color-raised)] border border-[var(--color-border)] rounded-[var(--radius-card)] px-3 py-1 text-sm z-10"
      >{{ fallbackNotice }}</p>
      <video
        v-if="mode === 'continuous'"
        ref="videoEl"
        data-testid="viewfinder"
        autoplay
        playsinline
        muted
        class="w-full h-full object-cover"
      ></video>
      <p v-else class="text-[var(--color-muted)] text-sm">
        Tap the shutter to take a photo
      </p>
      <canvas ref="canvasEl" class="hidden"></canvas>
      <input
        ref="fileInput"
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        class="hidden"
        @change="onFilePicked"
      />
      <button
        v-if="mode === 'continuous'"
        type="button"
        data-testid="shutter"
        aria-label="Take photo"
        class="absolute bottom-6 left-1/2 -translate-x-1/2 w-16 h-16 rounded-full bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] border-4 border-[var(--color-text)]/20 shadow-lg z-10"
        @click="onShutter"
      ></button>
    </div>

    <div class="flex items-center gap-2 p-3 overflow-x-auto border-t border-[var(--color-border)]">
      <RouterLink
        v-for="t in thumbs"
        :key="t.id"
        :to="t.itemId ? `/items/${t.itemId}` : ''"
        class="w-12 h-12 bg-[var(--color-raised)] rounded-[var(--radius-input)] overflow-hidden shrink-0 relative"
      >
        <img :src="t.blobUrl" class="w-full h-full object-cover" alt="" />
        <span
          v-if="t.status === 'error'"
          class="absolute inset-0 bg-[var(--color-danger)]/60 flex items-center justify-center text-xs"
        >!</span>
      </RouterLink>
    </div>

    <div v-if="mode !== 'continuous'" class="p-3 flex justify-end">
      <button
        type="button"
        data-testid="shutter"
        aria-label="Take photo"
        class="w-16 h-16 rounded-full bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] border-4 border-[var(--color-text)]/20"
        @click="onShutter"
      ></button>
    </div>
  </div>
</template>
