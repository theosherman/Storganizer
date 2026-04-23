<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useContainers, type Container } from "@/composables/useContainers";
import { useLocations, type Location } from "@/composables/useLocations";
import { useDefaultContainer, useDefaultLocation } from "@/composables/useDefaults";
import type { Item } from "@/composables/useItems";
import EntityCombobox from "@/components/EntityCombobox.vue";

const props = defineProps<{ item: Item }>();
const emit = defineEmits<{ sorted: [id: string] }>();

const { containers, fetchAll: fetchContainers, create: createContainer } = useContainers();
const { locations, fetchAll: fetchLocations, create: createLocation } = useLocations();

const defaultContainer = useDefaultContainer();
const defaultLocation = useDefaultLocation();

const name = ref(props.item.name);
const selectedContainer = ref<string | null>(props.item.container_id ?? defaultContainer.value);
const selectedLocation = ref<string | null>(defaultLocation.value);
const saving = ref(false);
const error = ref<string | null>(null);

onMounted(async () => {
  await Promise.all([fetchContainers(), fetchLocations()]);
});

function applyContainer(id: string | null) {
  selectedContainer.value = id;
  defaultContainer.value = id;
  if (id) {
    const c = containers.value.find((x) => x.id === id);
    if (c?.location_id) {
      selectedLocation.value = c.location_id;
      defaultLocation.value = c.location_id;
    }
  }
}

function applyLocation(id: string | null) {
  selectedLocation.value = id;
  defaultLocation.value = id;
  if (id && selectedContainer.value) {
    const c = containers.value.find((x) => x.id === selectedContainer.value);
    if (c && c.location_id !== id) {
      selectedContainer.value = null;
      defaultContainer.value = null;
    }
  }
}

async function createContainerAt(value: string): Promise<Container> {
  return await createContainer(value, selectedLocation.value ?? undefined);
}
async function createLocationAt(value: string): Promise<Location> {
  return await createLocation(value);
}

async function sort() {
  error.value = null;
  saving.value = true;
  try {
    const res = await fetch(`/api/items/${props.item.id}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.value.trim(),
        container_id: selectedContainer.value,
      }),
    });
    if (!res.ok) throw new Error("Save failed");
    emit("sorted", props.item.id);
  } catch {
    error.value = "Could not save";
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <div
    data-testid="unsorted-card"
    class="flex flex-col gap-3 p-4 bg-[var(--color-surface)] rounded-[var(--radius-card)] border border-[var(--color-border)]"
  >
    <div class="flex items-center gap-3">
      <div class="w-12 h-12 bg-[var(--color-raised)] rounded-[var(--radius-input)] overflow-hidden shrink-0">
        <img
          v-if="item.thumbnail_key"
          :src="`/api/photos/${item.thumbnail_key}`"
          class="w-full h-full object-cover"
          alt=""
        />
      </div>
      <input
        v-model="name"
        type="text"
        :placeholder="item.status === 'processing' ? 'Identifying…' : 'Name'"
        class="flex-1 bg-[var(--color-raised)] border border-[var(--color-border)] rounded-[var(--radius-input)] px-3 py-2 text-[var(--color-text)] placeholder:text-[var(--color-muted)] focus:outline-none focus:border-[var(--color-accent)]"
      />
    </div>
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
      <EntityCombobox
        data-testid="location-combobox"
        entity-label="location"
        :list="locations"
        :model-value="selectedLocation"
        :create-fn="createLocationAt"
        @update:model-value="applyLocation"
      />
      <EntityCombobox
        data-testid="container-combobox"
        entity-label="container"
        :list="containers.filter((c) => !selectedLocation || c.location_id === selectedLocation)"
        :model-value="selectedContainer"
        :create-fn="createContainerAt"
        @update:model-value="applyContainer"
      />
    </div>
    <div class="flex items-center gap-3">
      <p v-if="error" class="text-sm text-[var(--color-danger)]">{{ error }}</p>
      <div class="flex-1" />
      <button
        type="button"
        class="px-4 py-2 bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] rounded-[var(--radius-input)] text-[var(--color-text)] disabled:opacity-50"
        :disabled="saving || !selectedContainer"
        @click="sort"
      >
        {{ saving ? "Saving…" : "Sort it" }}
      </button>
    </div>
  </div>
</template>
