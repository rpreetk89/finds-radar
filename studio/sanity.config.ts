import {defineConfig} from 'sanity'
import {structureTool} from 'sanity/structure'
import {visionTool} from '@sanity/vision'
import {media} from 'sanity-plugin-media'
import {schemaTypes} from './schemaTypes'
import {BulkImportTool} from './plugins/BulkImport'
import {DashboardTool} from './plugins/Dashboard'
import {FetchProductDetailsAction} from './actions/FetchProductDetails'

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
              .title('📝 Drafts')
              .child(
                S.documentList()
                  .title('Drafts')
                  .schemaType('product')
                  .filter('_type == "product" && status == "draft" && !defined(deleted_at)')
                  .defaultOrdering(newestFirst),
              ),
            S.listItem()
              .title('⛔ Inactive')
              .child(
                S.documentList()
                  .title('Inactive products')
                  .schemaType('product')
                  .filter('_type == "product" && status == "inactive" && !defined(deleted_at)')
                  .defaultOrdering(newestFirst),
              ),
            S.listItem()
              .title('🔍 Never Checked')
              .child(
                S.documentList()
                  .title('Live but never link-checked')
                  .schemaType('product')
                  .filter('_type == "product" && status == "published" && !defined(link_checked_at) && skip_check != true')
                  .defaultOrdering(newestFirst),
              ),
            S.divider(),
            // ── Reference data ─────────────────────────────────────────────
            S.documentTypeListItem('category').title('Categories'),
            S.documentTypeListItem('marketplace').title('Marketplaces'),
            S.documentTypeListItem('country').title('Countries'),
            S.divider(),
            // ── Audit log ─────────────────────────────────────────────────
            S.listItem()
              .title('📋 Audit Log')
              .child(
                S.documentList()
                  .title('Status change history')
                  .schemaType('auditLog')
                  .filter('_type == "auditLog"')
                  .defaultOrdering([{field: 'timestamp', direction: 'desc'}]),
              ),
          ]),
    }),
    visionTool(),
    media(),
  ],
  schema: {
    types: schemaTypes,
  },
  document: {
    actions: (prev: any[], context: any) =>
      context.schemaType === 'product'
        ? [FetchProductDetailsAction, ...prev]
        : prev,
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
