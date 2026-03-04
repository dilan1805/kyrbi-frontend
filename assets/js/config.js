/* ==========================================================================
   Configuracion central de Kyrbi (modes, limites y copy)
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
      label: "Guia general",
      tone: "Claro, cercano y estructurado",
      dotColor: "green",
      intro: [
        "### Resumen rapido\nHola, soy Kyrbi. Te ayudo a ordenar habitos de forma practica y realista.",
        "### Recomendaciones\n- Elegimos un solo habito foco para hoy.\n- Definimos una accion pequena y medible.\n\n### Siguiente paso\n¿Quieres empezar por alimentacion, actividad fisica o descanso?",
      ],
    },
    chef: {
      label: "Chef",
      tone: "Enfoque en alimentacion (equilibrio y energia)",
      dotColor: "green",
      intro: [
        "### Resumen rapido\nModo Chef activado. Vamos a mejorar tu alimentacion sin complicarte.",
        "### Recomendaciones\n- Ajustamos primero una comida clave del dia.\n- Buscamos opciones accesibles para horario escolar.\n\n### Siguiente paso\n¿Como suele ser tu desayuno en un dia normal?",
      ],
    },
    coach: {
      label: "Coach",
      tone: "Enfoque en actividad fisica (metas y constancia)",
      dotColor: "green",
      intro: [
        "### Resumen rapido\nModo Coach activado. Priorizaremos constancia sobre intensidad.",
        "### Recomendaciones\n- Definimos bloques cortos de 10 a 20 minutos.\n- Conectamos movimiento con tu rutina real.\n\n### Siguiente paso\n¿Cuantos dias por semana te puedes mover de forma realista?",
      ],
    },
    descanso: {
      label: "Descanso",
      tone: "Enfoque en sueno y bienestar (rutina y calma)",
      dotColor: "green",
      intro: [
        "### Resumen rapido\nModo Descanso activado. Vamos a mejorar sueno y energia diaria.",
        "### Recomendaciones\n- Ajustamos una rutina nocturna corta y repetible.\n- Reducimos friccion con pantallas antes de dormir.\n\n### Siguiente paso\n¿A que hora te duermes y despiertas en dias de escuela?",
      ],
    },
  },
};
