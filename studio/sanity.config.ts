import {defineConfig} from 'sanity'
import {structureTool} from 'sanity/structure'
import {visionTool} from '@sanity/vision'
import {schemaTypes} from './schemaTypes'

// 1. Define shared config
const baseConfig = {
  plugins: [structureTool(), visionTool()],
  schema: {
    types: schemaTypes,
  },
}

// 2. Export workspaces
export default defineConfig([
  {
    ...baseConfig,
    name: 'production-workspace',
    title: 'FindsRadar (Prod)',
    projectId: '2qbe726s',
    dataset: 'production',
    basePath: '/cms/production', // Changed to /cms/production
  },
  {
    ...baseConfig,
    name: 'dev-workspace',
    title: 'FindsRadar (Dev)',
    projectId: '2qbe726s',
    dataset: 'dev',
    basePath: '/cms', // Your new main entry point
  },
])