import nextConfig from 'eslint-config-next'

const config = [...nextConfig, { ignores: ['.claude/worktrees/**'] }]

export default config
