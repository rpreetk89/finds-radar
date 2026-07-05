import {defineField, defineType} from 'sanity'

// Singleton — not exposed in the Studio structure sidebar. Managed entirely by the
// Dashboard plugin's "Push changes to site" panel via a fixed document id.
export default defineType({
  name: 'deployStatus',
  title: 'Deploy Status',
  type: 'document',
  fields: [
    defineField({name: 'lastDeployedAt', title: 'Last Deployed At', type: 'datetime'}),
    defineField({name: 'lastDeployedBy', title: 'Last Deployed By', type: 'string'}),
  ],
})
