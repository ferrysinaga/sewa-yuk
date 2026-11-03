import './style.css'

const app = document.querySelector<HTMLDivElement>('#app')

if (!app) {
  throw new Error('App root element #app was not found.')
}

app.innerHTML = '<main><h1>Sewa Yuk</h1></main>'
