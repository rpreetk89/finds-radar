const {createClient} = require('@sanity/client')

const client = createClient({
  projectId: '2qbe726s',
  dataset: 'dev', // Change to 'production' when you are ready to import to prod
  useCdn: false,
  apiVersion: '2026-06-26',
  token: 'skd6zOkYkakBrIZQQyuoyEYS29MGtpsYfptJZbYzDjXKaKnqplbztCezOGVoYnrRquEEN9dHQ3pkQphHsKGD1eLX0Mw3N13BIPEr03DjVgYnTk0Ifmb1PNX8BrDantEZ0RIVZaFsa9OpMzy9A3uSMAX1OM2dmdVITXwqRthDVLAE2aL02P76' // Generate this in your Sanity Manage dashboard
})

async function updateReferences() {
  // Replace these IDs with the actual IDs of your new Marketplace documents
  const marketplaceRefs = {
    'Amazon': '860148a7-430f-42e4-b391-bfa7c9bdca9e',
    'Temu': 'abbd213f-6b3b-4b22-abdd-6f25d725d2a4'
  }

  const products = await client.fetch(`*[_type == "product"]`)
  
  for (const product of products) {
    if (typeof product.marketplace === 'string') {
      const newRef = marketplaceRefs[product.marketplace]
      if (newRef) {
        await client.patch(product._id)
          .set({ marketplace: { _type: 'reference', _ref: newRef } })
          .commit()
        console.log(`Updated ${product.name}`)
      }
    }
  }
}

updateReferences()