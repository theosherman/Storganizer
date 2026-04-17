<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useRoute } from "vue-router";
import { api } from "@/composables/useApi";

interface LocationDetail {
  id: string;
  name: string;
  description: string | null;
  containers: { id: string; name: string; item_count: number }[];
}

const route = useRoute();
const location = ref<LocationDetail | null>(null);

onMounted(async () => {
  const data = await api<{ location: LocationDetail }>(`/api/locations/${route.params.id}`);
  location.value = data.location;
});
</script>

<template>
  <div v-if="location" class="p-6 max-w-3xl mx-auto">
    <h2 class="text-xl font-bold">{{ location.name }}</h2>
    <p v-if="location.description" class="text-sm text-gray-500 mt-1">{{ location.description }}</p>

    <div class="mt-6 space-y-3">
      <RouterLink
        v-for="c in location.containers"
        :key="c.id"
        :to="`/containers/${c.id}`"
        class="block p-4 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors"
      >
        <p class="font-medium">{{ c.name }}</p>
        <p class="text-sm text-gray-500">{{ c.item_count }} item{{ c.item_count !== 1 ? 's' : '' }}</p>
      </RouterLink>
      <p v-if="location.containers.length === 0" class="text-gray-500 text-center py-8">
        No containers at this location yet.
      </p>
    </div>
  </div>
</template>
