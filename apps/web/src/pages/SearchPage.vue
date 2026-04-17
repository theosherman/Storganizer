<script setup lang="ts">
import { ref, watch, onMounted } from "vue";
import { useItems } from "@/composables/useItems";
import ItemCard from "@/components/ItemCard.vue";

const { items, loading, search } = useItems();
const query = ref("");
let debounceTimer: ReturnType<typeof setTimeout>;

watch(query, (val) => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => search(val), 300);
});

onMounted(() => {
  search("");
});
</script>

<template>
  <div class="p-6 max-w-3xl mx-auto">
    <div class="mb-6">
      <input
        v-model="query"
        type="search"
        placeholder="Search items, containers, locations..."
        class="w-full px-4 py-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl text-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
      />
    </div>

    <div v-if="loading && items.length === 0" class="text-center py-12 text-gray-500">
      Searching...
    </div>

    <div v-else-if="items.length === 0 && !query" class="text-center py-12">
      <p class="text-gray-500 mb-4">No items yet. Start by adding some!</p>
      <RouterLink
        to="/add"
        class="inline-flex px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700"
      >
        Add Items
      </RouterLink>
    </div>

    <div v-else-if="items.length === 0 && query" class="text-center py-12 text-gray-500">
      No results for "{{ query }}"
    </div>

    <div v-else class="space-y-3">
      <ItemCard v-for="item in items" :key="item.id" :item="item" />
    </div>
  </div>
</template>
