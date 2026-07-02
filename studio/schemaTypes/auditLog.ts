import {defineField, defineType} from 'sanity'

export default defineType({
  name: 'auditLog',
  title: 'Audit Log',
  type: 'document',
  fields: [
    defineField({
      name: 'timestamp',
      title: 'Timestamp',
      type: 'datetime',
      readOnly: true,
    }),
    defineField({
      name: 'product_ref',
      title: 'Product',
      type: 'reference',
      to: [{type: 'product'}],
      readOnly: true,
    }),
    defineField({
      name: 'product_name',
      title: 'Product Name',
      type: 'string',
      readOnly: true,
      description: 'Snapshot of the name at time of change (survives deletion).',
    }),
    defineField({
      name: 'old_status',
      title: 'Previous Status',
      type: 'string',
      readOnly: true,
    }),
    defineField({
      name: 'new_status',
      title: 'New Status',
      type: 'string',
      readOnly: true,
    }),
    defineField({
      name: 'changed_by',
      title: 'Changed By',
      type: 'string',
      readOnly: true,
      description: 'Operator email or "system:link-checker"',
    }),
    defineField({
      name: 'reason',
      title: 'Reason',
      type: 'string',
      readOnly: true,
      description: 'inactive_reason value if applicable',
    }),
  ],
  orderings: [
    {name: 'newestFirst', title: 'Newest first', by: [{field: 'timestamp', direction: 'desc'}]},
  ],
  preview: {
    select: {
      title: 'product_name',
      subtitle: 'new_status',
      description: 'changed_by',
    },
  },
})
