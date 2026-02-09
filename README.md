# Ciencias para vivir mejor

Aplicación web educativa (HTML + CSS + JavaScript) para promover hábitos saludables en adolescentes (13–15 años) con el asistente conversacional **Kyrbi**.

## Estructura

- `index.html`: inicio (hero + vista rápida de Kyrbi).
- `assistant.html`: vista dedicada del asistente Kyrbi con modos (Guía general, Chef, Coach, Descanso).
- `habitos.html`: hábitos saludables conectados con Kyrbi (links con `?mode=`).
- `equipo.html`: equipo del proyecto.
- `evaluacion.html`: criterios de evaluación del proyecto.
- `seguridad.html`: política de seguridad y privacidad.
- `assets/css/styles.css`: diseño moderno, premium, responsive (sin frameworks). Paleta: azul marino + verde sobrio.
- `assets/js/app.js`: UX base + lógica del asistente Kyrbi con integración de backend.
- `assets/js/api.js`: Cliente para comunicarse con el backend de IA real.
- `assets/js/config.js`: configuración central de modos y límites.
- `server/`: Backend Node.js + Express con integración de OpenAI.
- `assets/img/favicon.svg`: ícono del sitio.

## Ejecutar (local)

Opción 1: abrir `index.html` directamente en el navegador.

Opción 2 (recomendado): servidor local.

- PowerShell (si tienes Python):

```bash
python -m http.server 5500
```

Luego abre `http://localhost:5500`.

## IA Real Implementada ✅

La aplicación ahora usa **IA real** mediante un backend Node.js + Express.

### Configuración rápida:

1. **Instala dependencias del backend:**
```bash
cd server
npm install
```

2. **Configura tu API Key:**
   - Crea `server/.env` con tu API Key de OpenAI
   - Ver `server/README.md` para detalles

3. **Inicia el servidor:**
```bash
cd server
npm start
```

4. **Abre el frontend** en tu navegador

**Ver `INSTRUCCIONES.md` para guía completa.**

## Características

- **Diseño premium**: Paleta azul marino profundo + verde sobrio, diseño moderno y profesional.
- **Asistente Kyrbi**: 4 modos (Guía general, Chef, Coach, Descanso) con respuestas contextuales.
- **Responsive**: Funciona en móviles, tablets y escritorio.
- **IA Real**: Backend con OpenAI GPT, respuestas dinámicas y contextuales.
- **Arquitectura modular**: Código limpio, separación frontend/backend.
- **Accesibilidad**: Skip links, ARIA labels, contraste adecuado.

## Privacidad

- No se guardan conversaciones (solo sessionStorage temporal).
- No se recopilan datos personales.
- Contenido educativo general (no médico).
- Ver más en `seguridad.html`.

