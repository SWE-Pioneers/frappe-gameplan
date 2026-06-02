import { defineConfig, type PluginOption } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueJsx from '@vitejs/plugin-vue-jsx'
import path from 'path'
import { visualizer } from 'rollup-plugin-visualizer'
// @ts-expect-error frappe-ui/vite ships untyped JS; drop this once it gains types.
import frappeui from 'frappe-ui/vite'

// frappe-ui is resolved through node_modules — the published package by default,
// or the local ../frappe-ui checkout when symlinked via `yarn dev:local`. Either
// way its `exports`/`imports` maps drive resolution, so no aliases are needed here.
export default defineConfig({
  define: {
    __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: 'false',
  },
  plugins: [
    frappeui({
      frontendRoute: '/g',
      frappeTypes: {
        input: {
          gameplan: [
            'gp_project',
            'gp_member',
            'gp_team',
            'gp_comment',
            'gp_discussion',
            'gp_page',
            'gp_task',
            'gp_poll',
            'gp_guest_access',
            'gp_invitation',
            'gp_user_profile',
            'gp_notification',
            'gp_activity',
            'gp_search_feedback',
            'gp_draft',
            'gp_tag',
            'gp_pinned_project',
          ],
        },
      },
    }),
    vue(),
    vueJsx(),
    visualizer({ emitFile: true }) as PluginOption,
  ],
  server: {
    host: '0.0.0.0',
    allowedHosts: true,
    // Allow serving the symlinked checkout's real path (yarn dev:local).
    fs: {
      allow: ['..', 'node_modules', '../frappe-ui'],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  optimizeDeps: {
    include: ['feather-icons'],
  },
})
