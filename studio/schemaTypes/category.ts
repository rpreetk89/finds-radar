import {defineField, defineType} from 'sanity'

export default defineType({
  name: 'category',
  title: 'Category',
  type: 'document',
  fields: [
    defineField({
      name: 'name',
      title: 'Name',
      type: 'string',
      description: 'Backend identifier used for matching products and building URLs. Changing this changes live URLs — edit with care.',
    }),
    defineField({
      name: 'slug',
      title: 'Short Code',
      type: 'slug',
      options: {source: 'name'},
      description: 'Studio-only bookkeeping code — not shown publicly and not used in URLs. Helps tell apart similar category names.',
    }),
    defineField({
      name: 'display_name',
      title: 'Display Name',
      type: 'string',
      description: 'Catchy public-facing name shown on the site (e.g. "Tech Finds"). Falls back to Name if left blank.',
    }),
  ],
})