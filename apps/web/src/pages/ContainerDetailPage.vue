<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useRoute } from "vue-router";
import { api } from "@/composables/useApi";
import ItemCard from "@/components/ItemCard.vue";
import type { Item } from "@/composables/useItems";

interface ContainerDetail {
  id: string;
  name: string;
  description: string | null;
  location_id: string | null;
  location_name: string | null;
  items: Item[];
}

const route = useRoute();
const container = ref<ContainerDetail | null>(null);

onMounted(async () => {
  const data = await api<{ container: ContainerDetail }>(`/api/containers/${route.params.id}`);
  container.value = data.container;
});
</script>

<template>
  <div v-if="container" class="p-6 max-w-3xl mx-auto">
    <h2 class="text-xl font-bold">{{ container.name }}</h2>
    <p v-if="container.location_name" class="text-sm text-gray-500 mt-1">
      {{ container.location_name }}
    </p>

    <div class="mt-6 space-y-3">
      <ItemCard v-for="item in container.items" :key="item.id" :item="item" />
      <p v-if="container.items.length === 0" class="text-gray-500 text-center py-8">
        No items in this container yet.
      </p>
    </div>
  </div>
</template>
