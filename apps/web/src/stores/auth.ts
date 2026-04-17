import { defineStore } from "pinia";
import { ref } from "vue";

interface User {
  id: string;
  email: string;
  name: string;
  avatar_url: string | null;
  role: string;
}

export const useAuthStore = defineStore("auth", () => {
  const user = ref<User | null>(null);
  const loading = ref(true);

  async function fetchUser() {
    try {
      const res = await fetch("/api/auth/me", { credentials: "include" });
      const data = await res.json();
      user.value = data.user;
    } catch {
      user.value = null;
    } finally {
      loading.value = false;
    }
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    user.value = null;
    window.location.href = "/login";
  }

  return { user, loading, fetchUser, logout };
});
