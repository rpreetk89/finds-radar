import {defineField, defineType} from 'sanity'

export default defineType({
  name: 'product',
  title: 'Product',
  type: 'document',
  fields: [
    defineField({name: 'name', title: 'Name', type: 'string'}),
    defineField({name: 'description', title: 'Description', type: 'text'}),
    defineField({name: 'price', title: 'Price', type: 'string', description: 'Display price e.g. $19.99'}),
    defineField({name: 'affiliate_link', title: 'Affiliate Link', type: 'url'}),
    defineField({name: 'published', title: 'Published', type: 'boolean', initialValue: false}),
    defineField({
      name: 'featured',
      title: 'Show in Category Card',
      type: 'boolean',
      description: 'Pin to the homepage category card (max 4 per category shown)',
      initialValue: false,
    }),
    defineField({
      name: 'marketplace',
      title: 'Marketplace',
      type: 'reference',
      to: [{type: 'marketplace'}],
    }),
    defineField({
      name: 'country',
      title: 'Country',
      type: 'reference',
      to: [{type: 'country'}],
    }),
    defineField({
      name: 'categories',
      title: 'Categories',
      type: 'array',
      of: [{type: 'reference', to: [{type: 'category'}]}],
    }),

    // ── Automation fields (read-only in Studio) ─────────────────────────────
    defineField({
      name: 'link_status',
      title: 'Link Status',
      type: 'string',
      readOnly: true,
      description: 'Set automatically by the daily link checker.',
      options: {
        list: [
          {title: '✅ OK', value: 'ok'},
          {title: '❌ Unavailable', value: 'broken'},
          {title: '⚠️ Check error (timeout / bot block)', value: 'error'},
        ],
      },
    }),
    defineField({
      name: 'link_checked_at',
      title: 'Link Last Checked',
      type: 'datetime',
      readOnly: true,
      description: 'Timestamp of the last automated content check.',
    }),
    defineField({
      name: 'auto_unpublished',
      title: 'Auto-unpublished',
      type: 'boolean',
      readOnly: true,
      description: 'True when the link checker unpublished this product automatically.',
      initialValue: false,
    }),
    defineField({
      name: 'unpublish_reason',
      title: 'Unpublish Reason',
      type: 'string',
      readOnly: true,
      description: 'The signal that triggered auto-unpublish.',
    }),

    // ── Manual override ─────────────────────────────────────────────────────
    defineField({
      name: 'skip_check',
      title: 'Skip automated checks',
      type: 'boolean',
      description:
        'Enable to exclude this product from the daily link checker. Use when the product is valid but triggers a false positive.',
      initialValue: false,
    }),

    defineField({
      name: 'media',
      title: 'Media',
      type: 'array',
      of: [
        {
          type: 'object',
          name: 'mediaItem',
          fields: [
            {name: 'url', title: 'URL', type: 'url'},
            {
              name: 'type',
              title: 'Type',
              type: 'string',
              options: {list: ['image', 'video']},
              initialValue: 'image',
            },
          ],
        },
      ],
    }),
  ],
})
