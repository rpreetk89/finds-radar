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
      description: 'Public-facing name shown on the site (e.g. "Tech Finds"). Safe to reword any time — does not affect matching or URLs.',
      validation: (R) => R.required(),
    }),
    defineField({
      name: 'slug',
      title: 'Short Code',
      type: 'slug',
      options: {source: 'name', slugify: (input) => input.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')},
      description: 'Backend identifier used for matching products (in bulk import) and building URLs. Changing this changes live URLs — edit with care.',
      validation: (Rule) =>
        Rule.required().custom(async (value, context) => {
          if (!value?.current) return true
          const client = context.getClient({apiVersion: '2024-01-01'})
          const id = context.document?._id as string | undefined
          const rawId = id?.startsWith('drafts.') ? id.slice('drafts.'.length) : id
          const excludeIds = rawId ? [rawId, `drafts.${rawId}`] : []
          const dupeCount = await client.fetch<number>(
            `count(*[_type == "category" && slug.current == $slug && !(_id in $excludeIds)])`,
            {slug: value.current, excludeIds},
          )
          if (dupeCount > 0) {
            return `Short Code "${value.current}" is already used by another category.`
          }
          return true
        }),
    }),
  ],
})