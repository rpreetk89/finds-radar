import {defineCliConfig} from 'sanity/cli'

export default defineCliConfig({
  api: {
    projectId: '2qbe726s',
    dataset: 'dev'
  },
  // This tells the Sanity build process to prepend /cms/ to asset URLs
 // vite: {
 //   base: '/cms/'
 // }
})