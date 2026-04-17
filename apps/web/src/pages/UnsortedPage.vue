<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useItems } from "@/composables/useItems";
import { useContainers } from "@/composables/useContainers";
import ItemCard from "@/components/ItemCard.vue";

const { items, loading, fetchUnorganized, updateItem } = useItems();
const { containers, fetchAll: fetchContainers } = useContainers();
const selected = ref<Set<string>>(new Set());
const showAssign = ref(false);

onMounted(() => {
  fetchUnorganized();
  fetchContainers();
});

function toggleSelect(id: string) {
  if (selected.value.has(id)) {
    selected.value.delete(id);
  } else {
    selected.value.add(id);
  }
}

async function assignSelected(containerId: string) {
  for (const itemId of selected.value) {
    await updateItem(itemId, { container_id: containerId });
  }
  selected.value.clear();
  showAssign.value = false;
  fetchUnorganized();
}
</script>

<template>
  <div class="p-6 max-w-3xl mx-auto">
    <div class="flex items-center justify-between mb-6">
      <h2 class="text-xl font-bold">Unsorted Items</h2>
      <button
        v-if="selected.size > 0"
        @click="showAssign = true"
        class="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium"
      >
        Assign {{ selected.size }} item{{ selected.size > 1 ? 's' : '' }}
      </button>
    </div>

    <div v-if="loading" class="text-center py-12 text-gray-500">Loading...</div>

    <div v-else-if="items.length === 0" class="text-center py-12">
      <p class="text-gray-500">All items are organized!</p>
    </div>

    <div v-else class="space-y-3">
      <div
        v-for="item in items"
        :key="item.id"
        class="flex items-center gap-3"
      >
        <input
          type="checkbox"
          :checked="selected.has(item.id)"
          @change="toggleSelect(item.id)"
          class="w-5 h-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
        />
        <div class="flex-1">
          <ItemCard :item="item" />
        </div>
      </div>
    </div>

    <div v-if="showAssign" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50" @click.self="showAssign = false">
      <div class="bg-white dark:bg-gray-900 rounded-xl p-6 w-full max-w-md mx-4">
        <h3 class="text-lg font-bold mb-4">Assign to Container</h3>
        <div class="space-y-2 max-h-64 overflow-y-auto">
          <button
            v-for="c in containers"
            :key="c.id"
            @click="assignSelected(c.id)"
            class="w-full text-left px-4 py-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <p class="font-medium">{{ c.name }}</p>
            <p v-if="c.location_name" class="text-sm text-gray-500">{{ c.location_name }}</p>
          </button>
        </div>
        <button @click="showAssign = false" class="mt-4 w-full py-2 text-gray-500 text-sm">Cancel</button>
      </div>
    </div>
  </div>
</template>
