import { createRouter, createWebHistory } from "vue-router";

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: "/",
      name: "search",
      component: () => import("@/pages/SearchPage.vue"),
    },
  ],
});

export default router;
