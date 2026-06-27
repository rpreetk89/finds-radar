import {defineConfig} from 'sanity'
import {structureTool} from 'sanity/structure'
import {visionTool} from '@sanity/vision'
import {schemaTypes} from './schemaTypes'

const baseConfig = {
  plugins: [structureTool(), visionTool()],
  schema: {
    types: schemaTypes,
  },
}

export default defineConfig([
  {
    ...baseConfig,
    name: 'production-workspace',
    title: 'FindsRadar (Prod)',
    projectId: '2qbe726s',
    dataset: 'production',
    basePath: '/cms/prod',
    // Add this line below
    // assetPublicPath: '/cms/static', 
  },
  {
    ...baseConfig,
    name: 'dev-workspace',
    title: 'FindsRadar (Dev)',
    projectId: '2qbe726s',
    dataset: 'dev',
    basePath: '/cms/dev',
    // Add this line below
   // assetPublicPath: '/cms/static',
  },
])