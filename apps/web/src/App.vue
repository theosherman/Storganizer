<script setup lang="ts">
import { computed, onMounted } from "vue";
import { useRoute } from "vue-router";
import { useAuthStore } from "@/stores/auth";
import AppHeader from "@/components/AppHeader.vue";
import CameraFab from "@/components/CameraFab.vue";

const auth = useAuthStore();
const route = useRoute();

const showChrome = computed(
  () => route.name !== "login" && route.name !== "camera"
);
const showFab = computed(
  () => route.name === "search" || route.name === "unsorted"
);

onMounted(() => {
  auth.fetchUser();
});
</script>

<template>
  <div v-if="auth.loading" class="flex items-center justify-center min-h-screen">
    <p class="text-[var(--color-muted)]">Loading...</p>
  </div>
  <template v-else>
    <AppHeader v-if="showChrome" />
    <main class="min-h-screen">
      <RouterView />
    </main>
    <CameraFab v-if="showFab" />
  </template>
</template>
