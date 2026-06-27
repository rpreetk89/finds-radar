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
      name: 'usage_category',
      title: 'Usage Categories',
      type: 'array',
      of: [{type: 'string'}],
      options: {
        list: [
          {title: 'Health', value: 'Health'},
          {title: 'Home', value: 'Home'},
          {title: 'Tech', value: 'Tech'},
          {title: 'Travel', value: 'Travel'},
        ],
        layout: 'tags',
      },
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