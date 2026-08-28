# Herramienta CASE Colaborativa con IA

Herramienta de diseño de software colaborativa en tiempo real, centrada en el modelo conceptual (UML o DER), con asistente de IA para construcción de diagramas y generación de backend Spring Boot + PostgreSQL.

## Estado actual (Semana 2)

- ✅ Editor colaborativo de diagramas entidad-relación/clases UML.
- ✅ Creación de entidades (nodos) con nombre editable.
- ✅ Relaciones entre entidades (aristas).
- ✅ Sincronización en tiempo real mediante Yjs y WebSockets.
- ✅ Exportar/importar diagrama en formato JSON.
- ✅ Edición manual de atributos (panel lateral).
- ✅ Agente IA para comandos en lenguaje natural (texto y voz).
- ❌ Generación de código (Semana 3).
- ❌ Exportación a PlantUML/SQL (Semana 3).

## Requisitos

- Node.js v20+
- npm
- API key de Groq (gratuita) o instalar Ollama local (alternativa)

## Estructura del proyecto
case-tool/
├── backend/ # Servidor WebSocket + API REST para IA
│ ├── server.js
│ ├── .env
│ └── package.json
├── frontend/ # Aplicación Next.js con React Flow
│ └── src/
│ ├── app/
│ │ └── page.tsx
│ ├── components/
│ │ ├── EntityNode.tsx
│ │ ├── Toolbar.tsx
│ │ └── EntityEditorPanel.tsx
│ ├── hooks/
│ │ ├── useCollaborativeFlow.ts
│ │ └── useAICommand.ts
│ ├── types/
│ │ └── diagram.ts
│ └── utils/
│ └── ast.ts
└── README.md

text

## Instalación

1. Clonar repositorio.
2. Backend:
   ```bash
   cd backend
   npm install
Frontend:

bash
cd frontend
npm install
Configuración
Obtener API key de Groq (gratuita) registrándote en console.groq.com.

Crear archivo backend/.env con:

text
GROQ_API_KEY=tu_api_key_aqui
GROQ_MODEL=openai/gpt-oss-20b
Puedes cambiar GROQ_MODEL por otro modelo disponible en tu cuenta (consulta la lista con curl https://api.groq.com/openai/v1/models -H "Authorization: Bearer TU_API_KEY").

(Opcional) Si prefieres usar Ollama local, modifica server.js para usar la API de Ollama (código comentado).

Ejecución
Iniciar backend (WebSocket + API):

bash
cd backend
npm start
El servidor escucha en http://localhost:1234 (WebSocket y API REST).

Iniciar frontend:

bash
cd frontend
npm run dev
Abrir http://localhost:3000 en el navegador.

Para probar colaboración, abrir dos pestañas o navegadores diferentes.

Funcionalidades actuales
Agregar Entidad: botón + Entidad en la barra superior.

Conectar entidades: arrastrar desde el handle inferior de una entidad al superior de otra.

Exportar JSON: descarga el diagrama actual.

Importar JSON: carga un diagrama previamente exportado.

Indicador de conexión: muestra si el cliente está conectado al servidor de colaboración.

Comandos de IA: escribe un comando en lenguaje natural (ej. "Crea entidad Producto con nombre y precio") y presiona Enter o el botón "Enviar". La IA devuelve mutaciones que se aplican al diagrama.

Reconocimiento de voz: haz clic en el botón 🎤 y dicta el comando (requiere Chrome/Edge y conexión segura en localhost).

Edición de atributos: selecciona una entidad para abrir el panel lateral. Renombra la entidad, añade/elimina atributos, cambia tipos y marca PK, nullable, unique. Guarda los cambios con el botón "Guardar cambios".

Próximos pasos (Semana 3)
□ Generación de código Spring Boot + PostgreSQL a partir del diagrama.
□ Exportación a PlantUML y SQL.
□ Persistencia del diagrama en base de datos (actualmente solo Yjs en memoria).
□ Mejoras en el panel de edición (drag & drop de atributos, importación desde JSON de entidades).
□ Aplicación móvil con asistente por voz.
Solución de problemas
La IA no responde: verifica que el backend esté corriendo y que GROQ_API_KEY sea válida. Revisa el modelo en GROQ_MODEL.

El reconocimiento de voz no funciona: asegúrate de usar Chrome o Edge y estar en localhost o HTTPS.

El WebSocket se desconecta: comprueba que NEXT_PUBLIC_WS_URL en frontend/.env.local sea ws://localhost:1234.

Licencia
Este proyecto es de código abierto para fines educativos.