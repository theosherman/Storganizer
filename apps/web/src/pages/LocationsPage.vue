<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useLocations } from "@/composables/useLocations";

const { locations, loading, fetchAll, create } = useLocations();
const showCreate = ref(false);
const newName = ref("");

onMounted(() => fetchAll());

async function handleCreate() {
  if (!newName.value.trim()) return;
  await create(newName.value.trim());
  newName.value = "";
  showCreate.value = false;
}
</script>

<template>
  <div class="p-6 max-w-3xl mx-auto">
    <div class="flex items-center justify-between mb-6">
      <h2 class="text-xl font-bold">Locations</h2>
      <button
        @click="showCreate = !showCreate"
        class="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium"
      >
        New Location
      </button>
    </div>

    <div v-if="showCreate" class="mb-6 p-4 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800">
      <input
        v-model="newName"
        placeholder="Location name (e.g. Attic, Garage Shelf B)..."
        class="w-full px-3 py-2 border border-gray-200 dark:border-gray-800 rounded-lg bg-transparent focus:outline-none focus:ring-2 focus:ring-indigo-500"
        @keydown.enter="handleCreate"
      />
      <button @click="handleCreate" class="mt-3 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm">Create</button>
    </div>

    <div v-if="loading" class="text-center py-12 text-gray-500">Loading...</div>

    <div v-else-if="locations.length === 0" class="text-center py-12 text-gray-500">
      No locations yet. Create one to organize your containers.
    </div>

    <div v-else class="space-y-3">
      <RouterLink
        v-for="loc in locations"
        :key="loc.id"
        :to="`/locations/${loc.id}`"
        class="block p-4 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors"
      >
        <p class="font-medium">{{ loc.name }}</p>
        <p v-if="loc.description" class="text-sm text-gray-500 mt-1">{{ loc.description }}</p>
      </RouterLink>
    </div>
  </div>
</template>
