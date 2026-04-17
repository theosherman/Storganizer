<script setup lang="ts">
import { onMounted } from "vue";
import { useRoute } from "vue-router";
import { useAuthStore } from "@/stores/auth";
import AppSidebar from "@/components/AppSidebar.vue";

const auth = useAuthStore();
const route = useRoute();

onMounted(() => {
  auth.fetchUser();
});
</script>

<template>
  <div v-if="auth.loading" class="flex items-center justify-center min-h-screen">
    <p class="text-gray-500">Loading...</p>
  </div>
  <template v-else>
    <template v-if="route.name === 'login'">
      <RouterView />
    </template>
    <template v-else>
      <AppSidebar />
      <main class="lg:ml-64 min-h-screen bg-gray-50 dark:bg-gray-950">
        <RouterView />
      </main>
    </template>
  </template>
</template>
