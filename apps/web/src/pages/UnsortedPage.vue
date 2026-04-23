<script setup lang="ts">
import { onMounted, computed } from "vue";
import { useItems } from "@/composables/useItems";
import UnsortedCard from "@/components/UnsortedCard.vue";

const { items, loading, fetchUnorganized } = useItems();

const count = computed(() => items.value.length);

onMounted(fetchUnorganized);

function onSorted(id: string) {
  items.value = items.value.filter((i) => i.id !== id);
}
</script>

<template>
  <div class="px-4 py-6 max-w-3xl mx-auto">
    <h1 class="text-xl font-semibold mb-4">Unsorted · {{ count }}</h1>
    <div v-if="loading && items.length === 0" class="text-center py-8 text-[var(--color-muted)]">Loading…</div>
    <div v-else-if="items.length === 0" class="text-center py-8 text-[var(--color-muted)]">
      Nothing to sort.
    </div>
    <div v-else class="space-y-3">
      <UnsortedCard
        v-for="item in items"
        :key="item.id"
        :item="item"
        @sorted="onSorted"
      />
    </div>
  </div>
</template>
