/* ==========================================================================
   Configuración central de Kyrbi (modes, límites y copy)
   ========================================================================== */
window.KYRBI_CONFIG = {
  typing: {
    baseMs: 340,
    maxMs: 900,
    perCharMs: 10,
  },
  limits: {
    userText: 320,
    userTextApp: 260,
  },
  storage: {
    enabled: true,
    key: "kyrbi_session_v1",
  },
  modes: {
    general: {
      label: "Guía general",
      tone: "Claro, cercano y estructurado",
      dotColor: "green",
      intro: [
        "Hola, soy Kyrbi. Estoy aquí para ayudarte a construir hábitos saludables de forma clara y práctica.",
        "Esto es orientación educativa (no médica). ¿Qué te gustaría mejorar primero: alimentación, actividad física o descanso?",
      ],
    },
    chef: {
      label: "Chef",
      tone: "Enfoque en alimentación (equilibrio y energía)",
      dotColor: "green",
      intro: [
        "Modo Chef activado. Vamos a mejorar tu alimentación con ideas simples y realistas.",
        "Para ayudarte mejor: ¿cómo son tus desayunos en un día normal y a qué hora sueles comer?",
      ],
    },
    coach: {
      label: "Coach",
      tone: "Enfoque en actividad física (metas y constancia)",
      dotColor: "green",
      intro: [
        "Modo Coach activado. Vamos a movernos más sin complicarnos.",
        "Pregunta rápida: ¿cuántos días a la semana te mueves (caminar, deporte o ejercicios) y cuánto tiempo?",
      ],
    },
    descanso: {
      label: "Descanso",
      tone: "Enfoque en sueño y bienestar (rutina y calma)",
      dotColor: "green",
      intro: [
        "Modo Descanso activado. Vamos a cuidar tu sueño y tu energía.",
        "Para empezar: ¿a qué hora te duermes y a qué hora te levantas en días de escuela?",
      ],
    },
  },
};
