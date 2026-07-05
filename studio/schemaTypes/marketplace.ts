import {defineField, defineType} from 'sanity'

export default defineType({
  name: 'marketplace',
  title: 'Marketplace',
  type: 'document',
  fields: [
    defineField({name: 'name', title: 'Name', type: 'string'}),
    defineField({
      name: 'slug',
      title: 'Slug',
      type: 'slug',
      options: {source: 'name'},
      description: 'URL-safe identifier, auto-generated from name',
    }),
    defineField({
      name: 'display_name',
      title: 'Display Name',
      type: 'string',
      description: 'Public-facing name shown to visitors (e.g. "Amazon" instead of "Amazon US"). Share the same value across country variants of the same marketplace. Falls back to Name if left blank.',
    }),
    defineField({name: 'domain', title: 'Domain', type: 'string', description: 'e.g. amazon.com, flipkart.com'}),
    defineField({
      name: 'country',
      title: 'Country',
      type: 'reference',
      to: [{type: 'country'}],
      description: 'The country this marketplace serves',
    }),
  ],
})