import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'

const link = document.createElement('link')
link.rel = 'stylesheet'
link.href = 'https://cdnjs.cloudflare.com/ajax/libs/%40tabler/icons-webfont/3.3.0/tabler-icons.min.css'
document.head.appendChild(link)

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
