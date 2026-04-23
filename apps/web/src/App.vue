<script setup lang="ts">
import { onMounted } from "vue";
import { useAuthStore } from "@/stores/auth";

const auth = useAuthStore();

onMounted(() => {
  auth.fetchUser();
});
</script>

<template>
  <div v-if="auth.loading" class="flex items-center justify-center min-h-screen">
    <p class="text-[var(--color-muted)]">Loading...</p>
  </div>
  <template v-else>
    <RouterView />
  </template>
</template>
