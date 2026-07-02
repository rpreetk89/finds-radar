import {defineField, defineType} from 'sanity'

export default defineType({
  name: 'product',
  title: 'Product',
  type: 'document',
  fields: [
    // ── Core fields ────────────────────────────────────────────────────────────
    defineField({name: 'name', title: 'Name', type: 'string', validation: (R) => R.required()}),
    defineField({name: 'description', title: 'Description', type: 'text'}),
    defineField({name: 'price', title: 'Price', type: 'string', description: 'Display price e.g. $19.99'}),
    defineField({name: 'affiliate_link', title: 'Affiliate Link', type: 'url', validation: (R) => R.required()}),
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

    // ── Media ─────────────────────────────────────────────────────────────────
    defineField({
      name: 'media',
      title: 'Images',
      type: 'array',
      description: 'Upload images directly (preferred) or paste URLs as fallback.',
      of: [
        {
          type: 'object',
          name: 'mediaItem',
          fields: [
            {
              name: 'asset',
              title: 'Upload Image',
              type: 'image',
              options: {hotspot: true},
            },
            {
              name: 'url',
              title: 'Or paste image URL',
              type: 'url',
              description: 'Fallback — used only if no image is uploaded above',
            },
          ],
          preview: {
            select: {media: 'asset', title: 'url'},
            prepare: (value: Record<string, any>) => ({
              title: String(value.title || 'Image'),
              media: value.media,
            }),
          },
        },
      ],
    }),

    // ── Lifecycle ──────────────────────────────────────────────────────────────
    defineField({
      name: 'status',
      title: 'Status',
      type: 'string',
      initialValue: 'draft',
      validation: (R) => R.required(),
      options: {
        list: [
          {title: '📝 Draft', value: 'draft'},
          {title: '✅ Published', value: 'published'},
          {title: '⛔ Inactive', value: 'inactive'},
        ],
        layout: 'radio',
      },
      description: 'Draft = not live. Published = live on site. Inactive = was live, now off.',
    }),
    defineField({
      name: 'inactive_reason',
      title: 'Inactive Reason',
      type: 'string',
      hidden: ({document}) => document?.status !== 'inactive',
      options: {
        list: [
          {title: 'Broken link', value: 'broken_link'},
          {title: 'Seasonal / no longer available', value: 'seasonal'},
          {title: 'Manually removed', value: 'manual'},
          {title: 'Duplicate', value: 'duplicate'},
          {title: 'Quality issue', value: 'quality'},
          {title: 'Other', value: 'other'},
        ],
      },
    }),
    defineField({
      name: 'inactive_since',
      title: 'Inactive Since',
      type: 'datetime',
      readOnly: true,
      hidden: ({document}) => document?.status !== 'inactive',
      description: 'Set automatically when status moves to Inactive.',
    }),
    defineField({
      name: 'changed_by',
      title: 'Status Changed By',
      type: 'string',
      readOnly: true,
      description: 'Who or what last changed the status. "system:link-checker" = automated.',
    }),
    defineField({
      name: 'deleted_at',
      title: 'Deleted At',
      type: 'datetime',
      readOnly: true,
      description: 'Soft delete timestamp. Products with this set are excluded from the site. 30-day undo window.',
    }),

    // ── Optional review fields ─────────────────────────────────────────────────
    defineField({
      name: 'reviewed_by',
      title: 'Reviewed By',
      type: 'string',
      description: 'Optional — who reviewed this before publishing.',
    }),
    defineField({
      name: 'reviewed_at',
      title: 'Reviewed At',
      type: 'datetime',
      description: 'Optional — when it was reviewed.',
    }),

    // ── Automation fields (read-only) ──────────────────────────────────────────
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
    }),
    defineField({
      name: 'skip_check',
      title: 'Skip automated checks',
      type: 'boolean',
      description: 'Exclude from the daily link checker. Use for valid products that trigger false positives.',
      initialValue: false,
    }),
  ],
})
