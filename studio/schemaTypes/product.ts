import {defineField, defineType} from 'sanity'

export default defineType({
  name: 'product',
  title: 'Product',
  type: 'document',
  fields: [
    defineField({name: 'name', type: 'string'}),
    defineField({name: 'description', type: 'text'}),
    defineField({name: 'affiliate_link', type: 'url'}),
    defineField({
        name: 'marketplace',
        title: 'Marketplace',
        type: 'reference', // Links to a marketplace document
        to: [{type: 'marketplace'}],
    }),
    defineField({
      name: 'media',
      type: 'array',
      of: [{type: 'image'}] 
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
  of: [{type: 'reference', to: [{type: 'category'}]}], // Links to the category document
}),
],
})