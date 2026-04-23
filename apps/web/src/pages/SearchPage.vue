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
  <div class="px-4 py-6 max-w-3xl mx-auto">
    <input
      v-model="query"
      type="search"
      placeholder="Search items, containers, locations…"
      class="w-full px-4 py-3 bg-[var(--color-raised)] border border-[var(--color-border)] rounded-[var(--radius-input)] text-lg text-[var(--color-text)] placeholder:text-[var(--color-muted)] focus:outline-none focus:border-[var(--color-accent)]"
    />

    <div v-if="loading && items.length === 0" class="text-center py-12 text-[var(--color-muted)]">
      Searching…
    </div>
    <div v-else-if="items.length === 0" class="text-center py-12">
      <p class="text-[var(--color-muted)] mb-4">No items yet.</p>
    </div>
    <div v-else class="mt-6 space-y-2">
      <ItemCard v-for="item in items" :key="item.id" :item="item" />
    </div>
  </div>
</template>
