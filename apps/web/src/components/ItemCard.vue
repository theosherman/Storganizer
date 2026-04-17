<script setup lang="ts">
import type { Item } from "@/composables/useItems";

defineProps<{ item: Item }>();
</script>

<template>
  <RouterLink
    :to="`/items/${item.id}`"
    class="flex items-center gap-4 p-4 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors"
  >
    <div class="w-14 h-14 bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center justify-center text-gray-400 shrink-0 overflow-hidden">
      <img
        v-if="item.thumbnail_key"
        :src="`/api/photos/${item.thumbnail_key}`"
        class="w-full h-full object-cover"
        alt=""
      />
      <svg v-else class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
      </svg>
    </div>
    <div class="flex-1 min-w-0">
      <p class="font-medium truncate">
        <span v-if="item.status === 'processing'" class="text-gray-400 italic">Processing...</span>
        <span v-else>{{ item.name }}</span>
      </p>
      <p v-if="item.container_name" class="text-sm text-gray-500 dark:text-gray-400 truncate">
        {{ item.container_name }}
        <span v-if="item.location_name"> &rarr; {{ item.location_name }}</span>
      </p>
      <p v-else class="text-sm text-gray-400 italic">Unsorted</p>
    </div>
  </RouterLink>
</template>
