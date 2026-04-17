<script setup lang="ts">
import { ref } from "vue";
import { useRoute } from "vue-router";
import { useAuthStore } from "@/stores/auth";

const route = useRoute();
const auth = useAuthStore();
const mobileOpen = ref(false);

const navItems = [
  { name: "Search", path: "/" },
  { name: "Unsorted", path: "/unsorted" },
  { name: "Containers", path: "/containers" },
  { name: "Locations", path: "/locations" },
];

function isActive(path: string) {
  return route.path === path;
}
</script>

<template>
  <button
    class="fixed top-4 left-4 z-50 lg:hidden p-2 rounded-md bg-gray-100 dark:bg-gray-800"
    @click="mobileOpen = !mobileOpen"
    aria-label="Toggle menu"
  >
    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path v-if="!mobileOpen" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
      <path v-else stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
    </svg>
  </button>

  <div
    v-if="mobileOpen"
    class="fixed inset-0 z-30 bg-black/50 lg:hidden"
    @click="mobileOpen = false"
  />

  <aside
    :class="[
      'fixed top-0 left-0 z-40 h-full w-64 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 flex flex-col transition-transform lg:translate-x-0',
      mobileOpen ? 'translate-x-0' : '-translate-x-full'
    ]"
  >
    <div class="p-6">
      <h1 class="text-xl font-bold text-indigo-600 dark:text-indigo-400">Storganizer</h1>
    </div>

    <nav class="flex-1 px-3 space-y-1">
      <RouterLink
        v-for="item in navItems"
        :key="item.path"
        :to="item.path"
        :class="[
          'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
          isActive(item.path)
            ? 'bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300'
            : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
        ]"
        @click="mobileOpen = false"
      >
        {{ item.name }}
      </RouterLink>
    </nav>

    <div class="p-3">
      <RouterLink
        to="/add"
        class="flex items-center justify-center gap-2 w-full px-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors"
        @click="mobileOpen = false"
      >
        Add Items
      </RouterLink>
    </div>

    <div v-if="auth.user" class="p-4 border-t border-gray-200 dark:border-gray-800">
      <div class="flex items-center gap-3">
        <img
          v-if="auth.user.avatar_url"
          :src="auth.user.avatar_url"
          :alt="auth.user.name"
          class="w-8 h-8 rounded-full"
        />
        <div class="flex-1 min-w-0">
          <p class="text-sm font-medium truncate">{{ auth.user.name }}</p>
        </div>
        <button
          @click="auth.logout()"
          class="text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
        >
          Logout
        </button>
      </div>
    </div>
  </aside>
</template>
