import {defineConfig} from 'sanity'
import {structureTool} from 'sanity/structure'
import {visionTool} from '@sanity/vision'
import {schemaTypes} from './schemaTypes'
import {BulkImportTool} from './plugins/BulkImport'
import {DashboardTool} from './plugins/Dashboard'

const dashboardTool = {name: 'dashboard', title: 'Dashboard', component: DashboardTool}
const bulkImportTool = {name: 'bulk-import', title: 'Bulk Import', component: BulkImportTool}

const newestFirst = [{field: '_createdAt', direction: 'desc'} as const]

const baseConfig = {
  plugins: [
    structureTool({
      structure: (S) =>
        S.list()
          .title('FindsRadar')
          .items([
            // ── Products ───────────────────────────────────────────────────
            S.listItem()
              .title('All Products')
              .schemaType('product')
              .child(
                S.documentTypeList('product')
                  .title('All Products — newest first')
                  .defaultOrdering(newestFirst),
              ),
            S.listItem()
              .title('Auto-Unpublished')
              .child(
                S.documentList()
                  .title('Auto-Unpublished by checker')
                  .schemaType('product')
                  .filter('_type == "product" && auto_unpublished == true')
                  .defaultOrdering(newestFirst),
              ),
            S.listItem()
              .title('Never Checked')
              .child(
                S.documentList()
                  .title('Live but never checked')
                  .schemaType('product')
                  .filter('_type == "product" && published != false && !defined(link_checked_at) && skip_check != true')
                  .defaultOrdering(newestFirst),
              ),
            S.divider(),
            // ── Reference data ─────────────────────────────────────────────
            S.documentTypeListItem('category').title('Categories'),
            S.documentTypeListItem('marketplace').title('Marketplaces'),
            S.documentTypeListItem('country').title('Countries'),
          ]),
    }),
    visionTool(),
  ],
  schema: {
    types: schemaTypes,
  },
  tools: (prev: any[]) => [dashboardTool, ...prev, bulkImportTool],
}

export default defineConfig([
  {
    ...baseConfig,
    name: 'production-workspace',
    title: 'FindsRadar (Prod)',
    projectId: '2qbe726s',
    dataset: 'production',
    basePath: '/cms/prod',
  },
  {
    ...baseConfig,
    name: 'dev-workspace',
    title: 'FindsRadar (Dev)',
    projectId: '2qbe726s',
    dataset: 'dev',
    basePath: '/cms/dev',
  },
])