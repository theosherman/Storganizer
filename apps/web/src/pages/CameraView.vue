<script setup lang="ts">
import { onMounted, ref, computed } from "vue";
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
  const thumb: Thumb = {
    id: `tmp-${Date.now()}-${Math.random()}`,
    blobUrl,
    status: "uploading",
    itemId: null,
  };
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

function onShutter() {
  // Native mode only in this task; Task 14 branches on continuous.
  fileInput.value?.click();
}
async function onFilePicked(e: Event) {
  const target = e.target as HTMLInputElement;
  const files = Array.from(target.files ?? []);
  target.value = "";
  for (const file of files) await uploadBlob(file, file.name);
}

onMounted(async () => {
  await Promise.all([fetchContainers(), fetchLocations()]);
});

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
      <p class="text-[var(--color-muted)] text-sm">
        {{ mode === "native" ? "Tap the shutter to take a photo" : "Viewfinder (Task 14)" }}
      </p>
      <input
        ref="fileInput"
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        class="hidden"
        @change="onFilePicked"
      />
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

    <div class="p-3 flex justify-end">
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
