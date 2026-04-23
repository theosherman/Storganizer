<script setup lang="ts">
import { ref } from "vue";
import { useRoute } from "vue-router";
import { useAuthStore } from "@/stores/auth";
import { onClickOutside } from "@vueuse/core";

const route = useRoute();
const auth = useAuthStore();
const menuOpen = ref(false);
const menuRef = ref<HTMLElement | null>(null);
onClickOutside(menuRef, () => (menuOpen.value = false));

function isActive(path: string) {
  return route.path === path;
}
</script>

<template>
  <header class="sticky top-0 z-20 bg-[var(--color-bg)]/95 backdrop-blur border-b border-[var(--color-border)]">
    <div class="mx-auto max-w-3xl flex items-center gap-4 px-4 h-14">
      <RouterLink to="/" class="font-semibold text-[var(--color-accent)] tracking-tight">Storganizer</RouterLink>
      <nav class="flex items-center gap-1 ml-2">
        <RouterLink
          to="/"
          :class="[
            'px-3 py-1.5 text-sm rounded-[var(--radius-input)]',
            isActive('/')
              ? 'bg-[var(--color-raised)] text-[var(--color-text)]'
              : 'text-[var(--color-muted)] hover:text-[var(--color-text)]',
          ]"
        >Search</RouterLink>
        <RouterLink
          to="/unsorted"
          :class="[
            'px-3 py-1.5 text-sm rounded-[var(--radius-input)]',
            isActive('/unsorted')
              ? 'bg-[var(--color-raised)] text-[var(--color-text)]'
              : 'text-[var(--color-muted)] hover:text-[var(--color-text)]',
          ]"
        >Unsorted</RouterLink>
      </nav>
      <div class="flex-1" />
      <div v-if="auth.user" ref="menuRef" class="relative">
        <button
          type="button"
          aria-label="User menu"
          class="flex items-center gap-2"
          @click="menuOpen = !menuOpen"
        >
          <img
            v-if="auth.user.avatar_url"
            :src="auth.user.avatar_url"
            :alt="auth.user.name"
            class="w-8 h-8 rounded-full"
          />
          <span
            v-else
            class="w-8 h-8 rounded-full bg-[var(--color-raised)] flex items-center justify-center text-xs"
          >{{ auth.user.name?.[0] ?? "?" }}</span>
        </button>
        <div
          v-if="menuOpen"
          class="absolute right-0 top-full mt-1 bg-[var(--color-raised)] border border-[var(--color-border)] rounded-[var(--radius-card)] py-1 min-w-[10rem] shadow-lg"
        >
          <div class="px-3 py-2 text-sm text-[var(--color-muted)] border-b border-[var(--color-border)]">
            {{ auth.user.name }}
          </div>
          <button
            type="button"
            class="w-full text-left px-3 py-2 text-sm hover:bg-[var(--color-surface)]"
            @click="auth.logout(); menuOpen = false"
          >
            Logout
          </button>
        </div>
      </div>
    </div>
  </header>
</template>
