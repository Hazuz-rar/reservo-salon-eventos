const registroForm = document.getElementById('registroForm');

registroForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  const name = document.getElementById('nombre').value.trim();
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  const confirmPassword =
    document.getElementById('confirmPassword').value;

  // Verificar que las contraseñas coincidan
  if (password !== confirmPassword) {
    alert('Las contraseñas no coinciden.');
    return;
  }

  try {
    const response = await fetch('/api/auth/register', {
      method: 'POST',

      headers: {
        'Content-Type': 'application/json'
      },

      body: JSON.stringify({
        name,
        email,
        password
      })
    });

    const data = await response.json();

    if (!response.ok) {
      alert(data.message);
      return;
    }

    alert(data.message);

    // Después de registrarse, mandar al login
    window.location.href = 'login.html';

  } catch (error) {
    console.error(error);

    alert(
      'No fue posible comunicarse con el servidor.'
    );
  }
});
