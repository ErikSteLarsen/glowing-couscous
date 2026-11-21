const form = document.querySelector('form')
const site = document.querySelector('#site')
const error = document.querySelector('#error')
const submit = document.querySelector('button[type="submit"]')
const quickOption = document.querySelector('.quick-option')

window.tempoSetup.getSetup().then(({ site: value, offerLocalhost, error: loadError }) => {
  if (!site.value) site.value = value
  error.textContent = loadError
  quickOption.hidden = !offerLocalhost
}).catch(() => {})

quickOption.addEventListener('click', () => {
  site.value = 'http://localhost:3000'
  error.textContent = ''
  site.focus()
})

form.addEventListener('submit', async (event) => {
  event.preventDefault()
  submit.disabled = true
  quickOption.disabled = true
  error.textContent = ''
  try {
    await window.tempoSetup.openSite(site.value)
  } catch {
    error.textContent = 'Enter a valid Tempo site URL or try again.'
  } finally {
    submit.disabled = false
    quickOption.disabled = false
  }
})
