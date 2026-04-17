import { ref } from "vue";
import { api } from "./useApi";

export interface Container {
  id: string;
  name: string;
  description: string | null;
  location_id: string | null;
  location_name: string | null;
  item_count: number;
  created_at: string;
}

export function useContainers() {
  const containers = ref<Container[]>([]);
  const loading = ref(false);

  async function fetchAll(locationId?: string) {
    loading.value = true;
    try {
      const params = locationId ? `?location_id=${locationId}` : "";
      const data = await api<{ containers: Container[] }>(`/api/containers${params}`);
      containers.value = data.containers;
    } finally {
      loading.value = false;
    }
  }

  async function create(name: string, locationId?: string) {
    const data = await api<{ container: Container }>("/api/containers", {
      method: "POST",
      body: JSON.stringify({ name, location_id: locationId || null }),
    });
    containers.value.unshift(data.container);
    return data.container;
  }

  return { containers, loading, fetchAll, create };
}
