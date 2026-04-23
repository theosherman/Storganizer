<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useItems } from "@/composables/useItems";
import { useContainers } from "@/composables/useContainers";
import { useLocations } from "@/composables/useLocations";
import { useDefaultContainer, useDefaultLocation } from "@/composables/useDefaults";
import EntityCombobox from "@/components/EntityCombobox.vue";

const route = useRoute();
const router = useRouter();
const { updateItem, deleteItem } = useItems();
const { containers, fetchAll: fetchContainers, create: createContainer } = useContainers();
const { locations, fetchAll: fetchLocations, create: createLocation } = useLocations();

const defaultContainer = useDefaultContainer();
const defaultLocation = useDefaultLocation();

interface DetailPhoto { id: string; r2_key: string; thumbnail_url: string | null; created_at: string }
interface DetailItem {
  id: string;
  name: string;
  description: string | null;
  status: string;
  container_id: string | null;
  container_name: string | null;
  location_id: string | null;
  location_name: string | null;
  photos: DetailPhoto[];
}

const item = ref<DetailItem | null>(null);
const name = ref("");
const containerId = ref<string | null>(null);
const locationId = ref<string | null>(null);
const saving = ref(false);
const error = ref<string | null>(null);

async function load() {
  const res = await fetch(`/api/items/${route.params.id}`, { credentials: "include" });
  if (!res.ok) {
    router.replace("/");
    return;
  }
  const data = (await res.json()) as { item: DetailItem };
  item.value = data.item;
  name.value = data.item.name;
  containerId.value = data.item.container_id;
  locationId.value = data.item.location_id;
}

function applyContainer(id: string | null) {
  containerId.value = id;
  defaultContainer.value = id;
  if (id) {
    const c = containers.value.find((x) => x.id === id);
    if (c?.location_id) {
      locationId.value = c.location_id;
      defaultLocation.value = c.location_id;
    }
  }
}
function applyLocation(id: string | null) {
  locationId.value = id;
  defaultLocation.value = id;
  if (id && containerId.value) {
    const c = containers.value.find((x) => x.id === containerId.value);
    if (c && c.location_id !== id) {
      containerId.value = null;
      defaultContainer.value = null;
    }
  }
}
async function createContainerAt(value: string) {
  return await createContainer(value, locationId.value ?? undefined);
}
async function createLocationAt(value: string) {
  return await createLocation(value);
}

async function save() {
  if (!item.value) return;
  saving.value = true;
  error.value = null;
  try {
    await updateItem(item.value.id, {
      name: name.value.trim(),
      container_id: containerId.value,
    });
    router.back();
  } catch {
    error.value = "Save failed";
  } finally {
    saving.value = false;
  }
}

async function remove() {
  if (!item.value) return;
  if (!window.confirm("Delete this item?")) return;
  try {
    await deleteItem(item.value.id);
    router.replace("/");
  } catch {
    error.value = "Delete failed";
  }
}

onMounted(async () => {
  await Promise.all([load(), fetchContainers(), fetchLocations()]);
});
</script>

<template>
  <div v-if="item" class="px-4 py-6 max-w-2xl mx-auto space-y-4">
    <div class="aspect-square w-full bg-[var(--color-raised)] rounded-[var(--radius-card)] overflow-hidden">
      <img
        v-if="item.photos[0]"
        :src="`/api/photos/${item.photos[0].r2_key}`"
        class="w-full h-full object-cover"
        alt=""
      />
    </div>

    <input
      v-model="name"
      data-testid="item-name"
      type="text"
      class="w-full px-3 py-2 bg-[var(--color-raised)] border border-[var(--color-border)] rounded-[var(--radius-input)] text-[var(--color-text)] text-lg focus:outline-none focus:border-[var(--color-accent)]"
    />

    <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
      <EntityCombobox
        entity-label="location"
        :list="locations"
        :model-value="locationId"
        :create-fn="createLocationAt"
        @update:model-value="applyLocation"
      />
      <EntityCombobox
        entity-label="container"
        :list="containers.filter((c) => !locationId || c.location_id === locationId)"
        :model-value="containerId"
        :create-fn="createContainerAt"
        @update:model-value="applyContainer"
      />
    </div>

    <p v-if="error" class="text-sm text--[var(--color-danger)]">{{ error }}</p>

    <div class="flex gap-2">
      <button
        type="button"
        class="flex-1 py-2 bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] rounded-[var(--radius-input)]"
        :disabled="saving"
        @click="save"
      >
        {{ saving ? "Saving…" : "Save" }}
      </button>
      <button
        type="button"
        class="py-2 px-4 border border-[var(--color-danger)] text-[var(--color-danger)] rounded-[var(--radius-input)]"
        @click="remove"
      >
        Delete
      </button>
    </div>
  </div>
</template>
