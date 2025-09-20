import { createRouter, createWebHistory } from 'vue-router'
import Home from '../views/Home.vue'
import PatientPortal from '../views/PatientPortal.vue'
import HospitalPortal from '../views/HospitalPortal.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'Home',
      component: Home
    },
    {
      path: '/patient',
      name: 'PatientPortal',
      component: PatientPortal
    },
    {
      path: '/hospital',
      name: 'HospitalPortal',
      component: HospitalPortal
    }
  ]
})

export default router