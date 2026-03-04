/* ==========================================================================
   Motor de respuestas de Kyrbi (simulación educativa)
   - Usa KYRBI_CONFIG.modes
   - getAssistantReply(mode, userText, history)
   ========================================================================== */

window.KyrbiEngine = (() => {
  const MODES = window.KYRBI_CONFIG.modes || {};

  const sanitize = (text) => (text || "").toString();

  const reply = {
    getAssistantReply(mode, userText /*, history */) {
      const text = sanitize(userText).toLowerCase();

      // Guardrails educativos (no médico)
      if (/\b(dolor|síntoma|sintoma|enfermo|medicina|diagnóstico|diagnostico)\b/.test(text)) {
        return {
          text:
            "Puedo ayudarte con hábitos generales, pero no hago diagnósticos. Si tienes síntomas o dolor, lo más seguro es hablar con un adulto responsable y un profesional de la salud.\n\nSi quieres, dime qué hábito te gustaría mejorar (alimentación, actividad física o descanso) y lo trabajamos paso a paso.",
        };
      }

      const wantsPlan = /\b(plan|rutina|semana|semanal|horario|organizar)\b/.test(text);
      const mentionsSchool = /\b(escuela|tarea|examen|clases)\b/.test(text);
      const mentionsStress = /\b(estrés|estres|ansiedad|nervios)\b/.test(text);

      if (mode === "general") {
        if (wantsPlan) {
          return {
            text:
              "Plan simple 7 días con 3 micro-hábitos (uno por pilar):\n1) Alimentación: 1 fruta o yogurt natural al día.\n2) Actividad: 12–15 minutos de caminata o rutina corta.\n3) Descanso: pantallas fuera 20 minutos antes de dormir.\n\nPara ajustarlo: ¿qué pilar te cuesta más y por qué",
          };
        }
        if (mentionsSchool) {
          return {
            text:
              "Cuando hay escuela, la constancia manda. Elige una mejora para esta semana:\n- Merienda inteligente (proteína + fruta)\n- Pausa activa entre tareas (5–8 min)\n- Hora fija para acostarte (±30 min)\n\n¿Cuál suena más realista hoy",
          };
        }
        return {
          text:
            "Elige un objetivo para esta semana:\nA) Más energía en clases\nB) Dormir mejor\nC) Comer más equilibrado\nD) Moverme más\n\nResponde A/B/C/D y te hago 2 preguntas para personalizar.",
        };
      }

      if (mode === "chef") {
        if (/\b(no desayuno|sin desayuno)\b/.test(text)) {
          return {
            text:
              "Un desayuno simple puede mejorar tu energía.\nOpciones rápidas:\n- Yogurt natural + fruta + avena\n- Sándwich integral con queso/huevo\n- Avena con leche + banana\n\n¿Cuál podrías probar mañana",
          };
        }
        if (/\b(refresco|soda|azúcar|azucar|dulces|golosinas)\b/.test(text)) {
          return {
            text:
              "No se trata de prohibir, sino de equilibrar:\n- Mantén la porción y acompaña con agua\n- Cambia 1 día/semana por opción más ligera\n- Agrega merienda con proteína (yogurt, queso, nueces)\n\n¿Cuántos días a la semana tomas bebidas azucaradas",
          };
        }
        if (wantsPlan) {
          return {
            text:
              "Plan rápido alimentación (7 días):\n1) Desayuno 3/7 días mínimo.\n2) Plato base: 1/2 verduras/fruta + 1/4 proteína + 1/4 carbohidrato.\n3) Merienda: fruta + yogurt/queso/nueces.\n\n¿Qué comidas haces normalmente (desayuno, almuerzo, cena, meriendas)",
          };
        }
        return {
          text:
            "Para personalizar: ¿qué te cuesta más\n1) Desayunar\n2) Elegir meriendas\n3) Comer verduras/fruta\n\nResponde 1, 2 o 3 y te doy ideas concretas.",
        };
      }

      if (mode === "coach") {
        if (/\b(no hago|nada|cero|sedentario)\b/.test(text)) {
          return {
            text:
              "Empecemos pequeño (5 días):\n- 8 min caminata o movilidad\n- 6 sentadillas\n- 6 flexiones en pared\n\n¿Prefieres mañana o tarde",
          };
        }
        if (/\b(gimnasio|pesas)\b/.test(text)) {
          return {
            text:
              "Base segura con pesas:\n- 2–3 días/semana\n- 6–10 ejercicios\n- 2–3 series cada uno\n- Esfuerzo moderado (RPE controlado)\n\nObjetivo: fuerza, resistencia o más energía general",
          };
        }
        if (mentionsStress) {
          return {
            text:
              "Moverte ayuda con el estrés. Hoy (10 min):\n- 5 min caminata suave\n- 3 min estiramientos\n- 2 min respiración lenta\n\n¿En qué momento sientes más estrés: mañana, tarde o noche",
          };
        }
        if (wantsPlan) {
          return {
            text:
              "Plan de actividad sin equipo:\n- 3 días: rutina corta (12–15 min)\n- 2 días: caminata (15–20 min)\n- 2 días: descanso activo (estiramientos)\n\n¿Tienes alguna restricción física o actividad favorita (deporte, baile, caminar)",
          };
        }
        return {
          text:
            "¿Cuánto tiempo real tienes al día para moverte\nA) 5–10 min\nB) 10–20 min\nC) 20–40 min\n\nElige A/B/C y te propongo rutina acorde.",
        };
      }

      if (mode === "descanso") {
        if (/\b(no duermo|insomnio|me cuesta dormir)\b/.test(text)) {
          return {
            text:
              "Para esta noche:\n- Luz baja 30 min antes\n- Pantallas fuera o modo noche\n- Respiración 4–6 (3 min)\n\n¿Qué suele pasar al acostarte: celular, preocupaciones o despertares frecuentes",
          };
        }
        if (mentionsSchool) {
          return {
            text:
              "Con escuela, mantén hora de dormir en rango de 30 min.\n¿A qué hora necesitas levantarte Calculo hora ideal de acostarte.",
          };
        }
        if (wantsPlan) {
          return {
            text:
              "Plan de descanso (7 días):\n1) Hora fija de despertar (±30 min)\n2) Cierre: 10 min sin pantallas\n3) Preparación: mochila/ropa lista (menos estrés)\n\n¿Tu mayor problema es: quedarte tarde, despertar cansado o despertarte en la noche",
          };
        }
        return {
          text:
            "Del 1 al 10, ¿qué tan descansado te sientes al despertar\nLuego te doy 2 cambios pequeños de alto impacto.",
        };
      }

      return { text: "Listo. ¿Qué te gustaría trabajar primero" };
    },

    getModeSwitchMessage(mode) {
      const m = MODES[mode];
      if (!m) return "Modo actualizado.";
      return `He cambiado a ${m.label}.\n${m.tone}. Dime qué quieres mejorar y te hago preguntas cortas para guiarte.`;
    },
  };

  return reply;
})();

