import nextConfig from 'eslint-config-next'

const config = [
  ...nextConfig,
  {
    ignores: ['fitness-coaching-platform-design/**'],
  },
]

export default config
