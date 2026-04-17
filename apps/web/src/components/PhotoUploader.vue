<script setup lang="ts">
import { ref } from "vue";

interface UploadedItem {
  id: string;
  name: string;
  status: string;
}

interface UploadEntry {
  file: File;
  progress: "uploading" | "done" | "error";
  item?: UploadedItem;
  previewUrl: string;
}

const uploads = ref<UploadEntry[]>([]);
const fileInput = ref<HTMLInputElement | null>(null);

async function handleFiles(event: Event) {
  const input = event.target as HTMLInputElement;
  const files = Array.from(input.files || []);
  input.value = "";

  for (const file of files) {
    const entry: UploadEntry = {
      file,
      progress: "uploading",
      previewUrl: URL.createObjectURL(file),
    };
    uploads.value.unshift(entry);

    try {
      const formData = new FormData();
      formData.append("photo", file);
      const res = await fetch("/api/items/upload", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!res.ok) throw new Error("Upload failed");
      const data = await res.json() as { item: UploadedItem };
      entry.item = data.item;
      entry.progress = "done";
      if (data.item.status === "processing") {
        pollStatus(data.item.id, entry);
      }
    } catch {
      entry.progress = "error";
    }
  }
}

function pollStatus(itemId: string, entry: UploadEntry) {
  const interval = setInterval(async () => {
    try {
      const res = await fetch(`/api/items/${itemId}`, { credentials: "include" });
      if (!res.ok) { clearInterval(interval); return; }
      const data = await res.json() as { item: UploadedItem };
      if (data.item.status === "ready") {
        entry.item = data.item;
        clearInterval(interval);
      }
    } catch {
      clearInterval(interval);
    }
  }, 2000);
}
</script>

<template>
  <div>
    <input
      ref="fileInput"
      type="file"
      accept="image/*"
      capture="environment"
      multiple
      class="hidden"
      @change="handleFiles"
    />

    <button
      @click="fileInput?.click()"
      class="w-full py-12 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-xl flex flex-col items-center gap-3 hover:border-indigo-400 dark:hover:border-indigo-600 transition-colors cursor-pointer"
    >
      <svg class="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
      </svg>
      <p class="text-gray-600 dark:text-gray-400 font-medium">Tap to take a photo or select files</p>
      <p class="text-sm text-gray-400">You can select multiple photos at once</p>
    </button>

    <div v-if="uploads.length > 0" class="mt-6 space-y-3">
      <div
        v-for="(upload, index) in uploads"
        :key="index"
        class="flex items-center gap-4 p-3 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800"
      >
        <img
          :src="upload.previewUrl"
          class="w-12 h-12 rounded object-cover"
          alt=""
        />
        <div class="flex-1 min-w-0">
          <p v-if="upload.progress === 'uploading'" class="text-sm text-gray-500 italic">Uploading...</p>
          <p v-else-if="upload.progress === 'error'" class="text-sm text-red-500">Upload failed</p>
          <template v-else-if="upload.item">
            <p class="text-sm font-medium truncate">{{ upload.item.name }}</p>
            <p v-if="upload.item.status === 'processing'" class="text-xs text-gray-400 italic">Identifying...</p>
          </template>
        </div>
        <RouterLink
          v-if="upload.item"
          :to="`/items/${upload.item.id}`"
          class="text-sm text-indigo-600 dark:text-indigo-400 hover:underline shrink-0"
        >
          View
        </RouterLink>
      </div>
    </div>
  </div>
</template>
