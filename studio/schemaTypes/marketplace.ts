import {defineField, defineType} from 'sanity'

export default defineType({
  name: 'marketplace',
  title: 'Marketplace',
  type: 'document',
  fields: [
    defineField({name: 'name', type: 'string'}),
  ],
})