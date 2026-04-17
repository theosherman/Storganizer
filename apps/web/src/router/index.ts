import { createRouter, createWebHistory } from "vue-router";

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: "/",
      name: "search",
      component: () => import("@/pages/SearchPage.vue"),
    },
    {
      path: "/unsorted",
      name: "unsorted",
      component: () => import("@/pages/UnsortedPage.vue"),
    },
    {
      path: "/containers",
      name: "containers",
      component: () => import("@/pages/ContainersPage.vue"),
    },
    {
      path: "/containers/:id",
      name: "container-detail",
      component: () => import("@/pages/ContainerDetailPage.vue"),
    },
    {
      path: "/locations",
      name: "locations",
      component: () => import("@/pages/LocationsPage.vue"),
    },
    {
      path: "/locations/:id",
      name: "location-detail",
      component: () => import("@/pages/LocationDetailPage.vue"),
    },
    {
      path: "/items/:id",
      name: "item-detail",
      component: () => import("@/pages/ItemDetailPage.vue"),
    },
    {
      path: "/add",
      name: "add-items",
      component: () => import("@/pages/AddItemsPage.vue"),
    },
    {
      path: "/login",
      name: "login",
      component: () => import("@/pages/LoginPage.vue"),
    },
  ],
});

export default router;
