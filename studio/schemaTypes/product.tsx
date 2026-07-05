import React from 'react'
import {defineField, defineType} from 'sanity'
import {ImageIcon} from '@sanity/icons'

export default defineType({
  name: 'product',
  title: 'Product',
  type: 'document',
  fields: [
    // ── Core fields ────────────────────────────────────────────────────────────
    defineField({name: 'name', title: 'Name', type: 'string', validation: (R) => R.required()}),
    defineField({name: 'description', title: 'Description', type: 'text'}),
    defineField({name: 'affiliate_link', title: 'Affiliate Link', type: 'url', validation: (R) => R.required()}),
    defineField({
      name: 'featured',
      title: 'Featured',
      type: 'boolean',
      description: 'Adds this product to the homepage "Featured" list (max 10 sitewide) and pins it in its category card.',
      initialValue: false,
      validation: (Rule) =>
        Rule.custom(async (value, context) => {
          if (!value) return true
          const client = context.getClient({apiVersion: '2024-01-01'})
          const id = context.document?._id as string | undefined
          const rawId = id?.startsWith('drafts.') ? id.slice('drafts.'.length) : id
          const excludeIds = rawId ? [rawId, `drafts.${rawId}`] : []
          const otherCount = await client.fetch<number>(
            `count(*[_type == "product" && featured == true && !defined(deleted_at) && !(_id in $excludeIds)])`,
            {excludeIds},
          )
          if (otherCount >= 10) {
            return '10 products are already Featured — un-feature one before adding another.'
          }
          return true
        }),
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
      options: {layout: 'grid'},
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
            select: {media: 'asset', url: 'url'},
            prepare: (value: Record<string, any>) => ({
              title: String(value.url || 'Image'),
              media: value.media
                ? value.media
                : value.url
                  ? () => (
                      <img
                        src={value.url}
                        alt=""
                        style={{width: '100%', height: '100%', objectFit: 'cover'}}
                      />
                    )
                  : ImageIcon,
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
