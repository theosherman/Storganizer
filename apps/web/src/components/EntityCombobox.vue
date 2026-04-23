<script setup lang="ts" generic="E extends { id: string; name: string }">
import { computed, ref, watch } from "vue";
import {
  ComboboxRoot,
  ComboboxAnchor,
  ComboboxInput,
  ComboboxContent,
  ComboboxItem,
  ComboboxViewport,
} from "reka-ui";

defineOptions({ inheritAttrs: false });

const props = defineProps<{
  list: E[];
  modelValue: string | null;
  entityLabel: string;
  createFn: (name: string) => Promise<E>;
}>();

const emit = defineEmits<{
  "update:modelValue": [id: string | null];
  created: [entity: E];
}>();

const query = ref("");
const error = ref<string | null>(null);
const open = ref(false);

const selected = computed(() => props.list.find((e) => e.id === props.modelValue) ?? null);

watch(
  selected,
  (s) => {
    if (s) query.value = s.name;
  },
  { immediate: true }
);

const filtered = computed(() => {
  const q = query.value.trim().toLowerCase();
  if (!q) return props.list;
  return props.list.filter((e) => e.name.toLowerCase().includes(q));
});

const showCreate = computed(() => {
  const q = query.value.trim();
  if (!q) return false;
  return !props.list.some((e) => e.name.toLowerCase() === q.toLowerCase());
});

function handleOpen(val: boolean) {
  open.value = val;
  if (!val && selected.value) {
    query.value = selected.value.name;
  }
}

async function handleSelect(value: string | null | undefined) {
  if (value == null) return;
  const strValue = String(value);
  error.value = null;
  if (strValue.startsWith("__create__:")) {
    const name = strValue.slice("__create__:".length);
    try {
      const created = await props.createFn(name);
      emit("created", created);
      emit("update:modelValue", created.id);
      query.value = created.name;
      open.value = false;
    } catch (e) {
      error.value = `Could not create ${props.entityLabel}`;
    }
    return;
  }
  const found = props.list.find((e) => e.id === strValue);
  if (found) {
    emit("update:modelValue", found.id);
    query.value = found.name;
    open.value = false;
  }
}
</script>

<template>
  <div class="relative">
    <ComboboxRoot
      :model-value="modelValue ?? ''"
      :open="open"
      :ignore-filter="true"
      @update:open="handleOpen"
      @update:model-value="(v) => handleSelect(v as string)"
    >
      <ComboboxAnchor
        class="flex items-center bg-[var(--color-raised)] border border-[var(--color-border)] rounded-[var(--radius-input)] px-3 py-2"
      >
        <ComboboxInput
          v-bind="$attrs"
          class="flex-1 bg-transparent outline-none text-[var(--color-text)] placeholder:text-[var(--color-muted)]"
          :placeholder="`Pick a ${entityLabel}...`"
          :model-value="query"
          :display-value="(id: unknown) => props.list.find((e) => e.id === id)?.name ?? (id ? String(id) : '')"
          @update:model-value="(v) => (query = String(v))"
          @focus="open = true"
          @click="open = true"
        />
      </ComboboxAnchor>
      <ComboboxContent
        class="absolute left-0 right-0 top-full mt-1 bg-[var(--color-raised)] border border-[var(--color-border)] rounded-[var(--radius-card)] shadow-lg overflow-hidden z-20"
      >
        <ComboboxViewport class="max-h-64 overflow-y-auto">
          <ComboboxItem
            v-for="entity in filtered"
            :key="entity.id"
            :value="entity.id"
            class="px-3 py-2 cursor-pointer hover:bg-[var(--color-surface)] data-[highlighted]:bg-[var(--color-surface)]"
          >
            {{ entity.name }}
          </ComboboxItem>
          <ComboboxItem
            v-if="showCreate"
            :value="`__create__:${query.trim()}`"
            class="px-3 py-2 cursor-pointer border-t border-[var(--color-border)] text-[var(--color-accent)] hover:bg-[var(--color-surface)] data-[highlighted]:bg-[var(--color-surface)]"
          >
            + Create "{{ query.trim() }}"
          </ComboboxItem>
        </ComboboxViewport>
      </ComboboxContent>
    </ComboboxRoot>
    <p v-if="error" class="text-[var(--color-danger)] text-sm mt-1">{{ error }}</p>
  </div>
</template>
