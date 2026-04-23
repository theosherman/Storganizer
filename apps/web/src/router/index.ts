import { createRouter, createWebHistory } from "vue-router";

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/", name: "search", component: () => import("@/pages/SearchPage.vue") },
    { path: "/unsorted", name: "unsorted", component: () => import("@/pages/UnsortedPage.vue") },
    { path: "/camera", name: "camera", component: () => import("@/pages/CameraView.vue") },
    { path: "/items/:id", name: "item-detail", component: () => import("@/pages/ItemDetailPage.vue") },
    { path: "/login", name: "login", component: () => import("@/pages/LoginPage.vue") },
    { path: "/:pathMatch(.*)*", redirect: "/" },
  ],
});

export default router;
