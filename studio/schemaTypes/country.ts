import {defineField, defineType} from 'sanity'

export default defineType({
  name: 'country',
  title: 'Country',
  type: 'document',
  fields: [
    defineField({name: 'name', title: 'Name', type: 'string'}),
    defineField({name: 'code', title: 'ISO Code', type: 'string', description: 'Lowercase ISO code (e.g., us, ca, in)'}),
    defineField({name: 'flag', title: 'Flag Emoji', type: 'string', description: 'Emoji flag e.g. 🇺🇸'}),
    defineField({name: 'isDefault', title: 'Default Country', type: 'boolean', description: 'Set true for US — this country serves at /'}),
    defineField({
      name: 'showInNav',
      title: 'Show in Country Selector',
      type: 'boolean',
      description: 'Toggle on when this country has enough curated content to be featured in the navigation dropdown.',
      initialValue: false,
    }),
  ],
})