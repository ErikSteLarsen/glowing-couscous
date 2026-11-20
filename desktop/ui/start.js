const form = document.querySelector('form')
const site = document.querySelector('#site')
const error = document.querySelector('#error')
const submit = document.querySelector('button')

window.tempoSetup.getSite().then((value) => {
  if (!site.value) site.value = value
}).catch(() => {})

form.addEventListener('submit', async (event) => {
  event.preventDefault()
  submit.disabled = true
  error.textContent = ''
  try {
    await window.tempoSetup.openSite(site.value)
  } catch {
    error.textContent = 'Enter a valid Tempo site URL or try again.'
  } finally {
    submit.disabled = false
  }
})
