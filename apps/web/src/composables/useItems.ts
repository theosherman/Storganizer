import { ref } from "vue";
import { api } from "./useApi";

export interface Item {
  id: string;
  name: string;
  ai_label: string | null;
  description: string | null;
  status: string;
  container_id: string | null;
  container_name: string | null;
  location_name: string | null;
  thumbnail_key: string | null;
  created_at: string;
}

export function useItems() {
  const items = ref<Item[]>([]);
  const loading = ref(false);

  async function search(query: string) {
    loading.value = true;
    try {
      const params = query ? `?q=${encodeURIComponent(query)}` : "";
      const data = await api<{ items: Item[] }>(`/api/items${params}`);
      items.value = data.items;
    } finally {
      loading.value = false;
    }
  }

  async function fetchUnorganized() {
    loading.value = true;
    try {
      const data = await api<{ items: Item[] }>("/api/items?unorganized=true");
      items.value = data.items;
    } finally {
      loading.value = false;
    }
  }

  async function updateItem(id: string, updates: Partial<Pick<Item, "name" | "description" | "container_id">>) {
    const data = await api<{ item: Item }>(`/api/items/${id}`, {
      method: "PATCH",
      body: JSON.stringify(updates),
    });
    return data.item;
  }

  async function deleteItem(id: string) {
    await api(`/api/items/${id}`, { method: "DELETE" });
  }

  return { items, loading, search, fetchUnorganized, updateItem, deleteItem };
}
