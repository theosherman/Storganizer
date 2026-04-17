<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useContainers } from "@/composables/useContainers";
import { useLocations } from "@/composables/useLocations";

const { containers, loading, fetchAll, create } = useContainers();
const { locations, fetchAll: fetchLocations } = useLocations();
const showCreate = ref(false);
const newName = ref("");
const newLocationId = ref<string | null>(null);

onMounted(() => {
  fetchAll();
  fetchLocations();
});

async function handleCreate() {
  if (!newName.value.trim()) return;
  await create(newName.value.trim(), newLocationId.value || undefined);
  newName.value = "";
  newLocationId.value = null;
  showCreate.value = false;
}
</script>

<template>
  <div class="p-6 max-w-3xl mx-auto">
    <div class="flex items-center justify-between mb-6">
      <h2 class="text-xl font-bold">Containers</h2>
      <button
        @click="showCreate = !showCreate"
        class="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium"
      >
        New Container
      </button>
    </div>

    <div v-if="showCreate" class="mb-6 p-4 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800">
      <div class="space-y-3">
        <input
          v-model="newName"
          placeholder="Container name..."
          class="w-full px-3 py-2 border border-gray-200 dark:border-gray-800 rounded-lg bg-transparent focus:outline-none focus:ring-2 focus:ring-indigo-500"
          @keydown.enter="handleCreate"
        />
        <select
          v-model="newLocationId"
          class="w-full px-3 py-2 border border-gray-200 dark:border-gray-800 rounded-lg bg-transparent focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option :value="null">No location</option>
          <option v-for="loc in locations" :key="loc.id" :value="loc.id">{{ loc.name }}</option>
        </select>
        <button @click="handleCreate" class="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm">Create</button>
      </div>
    </div>

    <div v-if="loading" class="text-center py-12 text-gray-500">Loading...</div>

    <div v-else-if="containers.length === 0" class="text-center py-12 text-gray-500">
      No containers yet. Create one to start organizing items.
    </div>

    <div v-else class="space-y-3">
      <RouterLink
        v-for="c in containers"
        :key="c.id"
        :to="`/containers/${c.id}`"
        class="block p-4 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors"
      >
        <p class="font-medium">{{ c.name }}</p>
        <p class="text-sm text-gray-500 mt-1">
          {{ c.item_count }} item{{ c.item_count !== 1 ? 's' : '' }}
          <span v-if="c.location_name"> &middot; {{ c.location_name }}</span>
        </p>
      </RouterLink>
    </div>
  </div>
</template>
