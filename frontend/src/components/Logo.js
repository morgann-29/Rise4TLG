import { useTheme } from '../contexts/ThemeContext'

function Logo({ className = 'h-12' }) {
  const { darkMode } = useTheme()

  // Logos a placer dans public/
  // - logo-light.png (pour theme clair)
  // - logo-dark.png (pour theme sombre)
  const logoSrc = darkMode ? '/logo-dark.png' : '/logo-light.png'

  return (
    <img
      src={logoSrc}
      alt="Logo"
      className={className}
      onError={(e) => {
        // Fallback si le logo n'existe pas
        e.target.style.display = 'none'
      }}
    />
  )
}

export default Logo
