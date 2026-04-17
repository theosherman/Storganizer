<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { api } from "@/composables/useApi";
import { useContainers } from "@/composables/useContainers";

interface ItemDetail {
  id: string;
  name: string;
  ai_label: string | null;
  description: string | null;
  status: string;
  container_id: string | null;
  container_name: string | null;
  location_id: string | null;
  location_name: string | null;
  created_at: string;
  photos: { id: string; r2_key: string; thumbnail_url: string | null }[];
}

const route = useRoute();
const router = useRouter();
const { containers, fetchAll: fetchContainers } = useContainers();

const item = ref<ItemDetail | null>(null);
const editName = ref("");
const editDescription = ref("");
const editContainerId = ref<string | null>(null);
const saving = ref(false);

onMounted(async () => {
  const data = await api<{ item: ItemDetail }>(`/api/items/${route.params.id}`);
  item.value = data.item;
  editName.value = data.item.name;
  editDescription.value = data.item.description || "";
  editContainerId.value = data.item.container_id;
  fetchContainers();
});

async function save() {
  if (!item.value) return;
  saving.value = true;
  try {
    const data = await api<{ item: ItemDetail }>(`/api/items/${item.value.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        name: editName.value,
        description: editDescription.value || null,
        container_id: editContainerId.value,
      }),
    });
    item.value = { ...item.value, ...data.item };
  } finally {
    saving.value = false;
  }
}

async function remove() {
  if (!item.value || !confirm("Delete this item?")) return;
  await api(`/api/items/${item.value.id}`, { method: "DELETE" });
  router.push("/");
}
</script>

<template>
  <div v-if="item" class="p-6 max-w-2xl mx-auto">
    <div v-if="item.photos.length > 0" class="mb-6 space-y-3">
      <div
        v-for="photo in item.photos"
        :key="photo.id"
        class="rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-800"
      >
        <img
          :src="`/api/photos/${photo.r2_key}`"
          class="w-full max-h-96 object-contain"
          alt=""
        />
      </div>
    </div>

    <p v-if="item.ai_label && item.ai_label !== item.name" class="text-sm text-gray-500 mb-4">
      AI identified as: <span class="italic">{{ item.ai_label }}</span>
    </p>

    <div class="space-y-4">
      <div>
        <label class="block text-sm font-medium mb-1">Name</label>
        <input
          v-model="editName"
          class="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      <div>
        <label class="block text-sm font-medium mb-1">Description</label>
        <textarea
          v-model="editDescription"
          rows="3"
          class="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          placeholder="Optional notes..."
        />
      </div>

      <div>
        <label class="block text-sm font-medium mb-1">Container</label>
        <select
          v-model="editContainerId"
          class="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option :value="null">— None (unsorted) —</option>
          <option v-for="c in containers" :key="c.id" :value="c.id">
            {{ c.name }}<template v-if="c.location_name"> ({{ c.location_name }})</template>
          </option>
        </select>
      </div>

      <div class="flex gap-3">
        <button
          @click="save"
          :disabled="saving"
          class="px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50"
        >
          {{ saving ? "Saving..." : "Save" }}
        </button>
        <button
          @click="remove"
          class="px-4 py-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-950 rounded-lg font-medium"
        >
          Delete
        </button>
      </div>
    </div>
  </div>
</template>
