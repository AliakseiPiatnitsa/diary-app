import './globals.css'

export const metadata = {
  title: 'дневник',
  description: 'дневник самопознания',
  manifest: '/manifest.json',
  // Говорит Safari на iPhone: это приложение, а не просто сайт
  appleWebApp: {
    capable: true,
    title: 'Дневник',
    statusBarStyle: 'black-translucent',
  },
}

// Отдельно настраиваем viewport — масштаб и размер на мобильном
export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#0C0C1E',
}

export default function RootLayout({ children }) {
  return (
    <html lang="ru">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Crimson+Pro:ital,wght@0,300;0,400;1,300;1,400&family=Inter:wght@300;400&display=swap"
        />
        {/* Иконка для iPhone при добавлении на рабочий стол */}
        <link rel="apple-touch-icon" href="/icon-192.png" />
        {/* Цвет строки состояния на iPhone */}
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </head>
      <body>{children}</body>
    </html>
  )
}
