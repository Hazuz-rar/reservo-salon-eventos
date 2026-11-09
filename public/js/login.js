const loginForm = document.getElementById('loginForm');

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  const email = document
    .getElementById('email')
    .value
    .trim();

  const password = document
    .getElementById('password')
    .value;

  try {
    const response = await fetch('/api/auth/login', {
      method: 'POST',

      headers: {
        'Content-Type': 'application/json'
      },

      body: JSON.stringify({
        email,
        password
      })
    });

    const data = await response.json();

    if (!response.ok) {
      alert(data.message);
      return;
    }

    localStorage.setItem(
      'reservoToken',
      data.token
    );

    localStorage.setItem(
      'reservoUser',
      JSON.stringify(data.user)
    );

    alert(
      `Bienvenido, ${data.user.name}`
    );

    const next = new URLSearchParams(window.location.search).get('next');
    window.location.href = ['calendario.html', 'perfil.html'].includes(next) ? next : 'inicio.html';

  } catch (error) {
    console.error(error);

    alert(
      'No fue posible comunicarse con el servidor.'
    );
  }
});
