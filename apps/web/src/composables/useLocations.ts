import { ref } from "vue";
import { api } from "./useApi";

export interface Location {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
}

export function useLocations() {
  const locations = ref<Location[]>([]);
  const loading = ref(false);

  async function fetchAll() {
    loading.value = true;
    try {
      const data = await api<{ locations: Location[] }>("/api/locations");
      locations.value = data.locations;
    } finally {
      loading.value = false;
    }
  }

  async function create(name: string, description?: string) {
    const data = await api<{ location: Location }>("/api/locations", {
      method: "POST",
      body: JSON.stringify({ name, description }),
    });
    locations.value.unshift(data.location);
    return data.location;
  }

  return { locations, loading, fetchAll, create };
}
