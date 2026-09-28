// Contenido del manual embebido (boton Ayuda / F1). Markdown en `content`
// para editar texto sin tocar componentes; HelpModal lo renderiza con
// react-markdown. Solo documentar funcionalidades REALES (nada inventado).
export interface ManualSection {
  id: string;
  title: string;
  icon: string;
  content: string;
}

export const MANUAL_SECTIONS: ManualSection[] = [
  {
    id: 'intro',
    title: 'Introduccion',
    icon: '📖',
    content: `
# Que es esta herramienta?

Es una herramienta CASE colaborativa con inteligencia artificial para
el diseno de bases de datos mediante diagramas de clases UML 2.5.

## Funcionalidades principales

- **Editor colaborativo en tiempo real** (varios usuarios a la vez).
- **Asistente de IA** por voz y texto para modificar el diagrama.
- **Generacion automatica de backend** Spring Boot + PostgreSQL.
- **Exportacion a XMI** para integrarse con Enterprise Architect.
- **App movil** que consume el backend generado.
    `,
  },
  {
    id: 'getting-started',
    title: 'Primeros pasos',
    icon: '🚀',
    content: `
# Primeros pasos

## 1. Crear un diagrama

1. Inicia sesion en la aplicacion.
2. En el dashboard, haz clic en **"+ Nuevo diagrama"**.
3. Se abre el editor con un lienzo vacio.

## 2. Agregar clases

1. En la paleta lateral izquierda, arrastra **"Clase"** al lienzo.
2. Renombra la clase haciendo doble clic sobre el nombre.
3. Agrega atributos en el panel derecho.

## 3. Crear relaciones

**Metodo 1 - Paleta:**
1. En la paleta, haz clic en el tipo de relacion.
2. Haz clic en el nodo origen.
3. Haz clic en el nodo destino.

**Metodo 2 - Drag desde handles:**
1. Arrastra desde cualquier parte de un nodo hacia otro.
    `,
  },
  {
    id: 'entities',
    title: 'Entidades y atributos',
    icon: '📦',
    content: `
# Entidades y atributos

## Tipos de entidades

- **Clase**: entidad estandar de UML.
- **Interfaz**: clase con estereotipo \`<<interface>>\`.
- **Clase abstracta**: clase con estereotipo \`<<abstract>>\`.
- **Nota**: comentario de texto libre.

## Atributos

Cada atributo tiene:
- **Nombre**: identificador del atributo.
- **Tipo**: String, Integer, UUID, BigDecimal, Date, Boolean.
- **PK**: si es clave primaria.
- **Unique**: si debe ser unico.
- **Nullable**: si puede ser nulo.

## Clases asociativas

Cuando una relacion es \`* a *\`, puedes convertirla en **clase
asociativa** para agregar atributos propios:

1. Selecciona la arista.
2. En el panel, haz clic en **"Convertir en clase asociativa"**.
3. Se crea un nodo intermedio con nombre automatico.
4. Agrega los atributos propios (ej: cantidad, fecha).
    `,
  },
  {
    id: 'relationships',
    title: 'Relaciones UML',
    icon: '🔗',
    content: `
# Relaciones UML 2.5

| Tipo | Notacion | Uso |
|------|----------|-----|
| Asociacion | Linea simple | Relacion general |
| Herencia | Triangulo hueco | Generalizacion |
| Composicion | Rombo lleno | Relacion fuerte |
| Agregacion | Rombo vacio | Relacion debil |

## Multiplicidades

- \`1\`: exactamente uno.
- \`0..1\`: cero o uno.
- \`*\`: cero o muchos.
- \`1..*\`: uno o muchos.

Edita las multiplicidades en el panel de la arista.

## Self-loops

Para crear una relacion de una entidad consigo misma:
1. Activa el modo conexion desde la paleta.
2. Haz clic en el nodo origen.
3. Haz clic otra vez en el mismo nodo.
    `,
  },
  {
    id: 'ai-assistant',
    title: 'Asistente de IA',
    icon: '🤖',
    content: `
# Asistente de IA

## Comandos por texto

Haz clic en el boton **"Chat"** en la toolbar y escribe comandos
como:

- \`"crea clase Producto con nombre y precio"\`
- \`"agrega atributo email a Cliente"\`
- \`"relaciona Cliente con Pedido uno a muchos"\`
- \`"elimina la clase Producto"\`

## Comandos por voz

1. Haz clic en el icono de **microfono**.
2. Dicta el comando.
3. El sistema transcribe con Whisper y aplica los cambios.

## Generacion desde imagen

1. Haz clic en **"Desde imagen"**.
2. Sube una foto del diagrama (papel, pizarra, etc.).
3. La IA interpreta la imagen y la convierte en un diagrama editable.

## Recomendaciones

- Habla claro y sin ruido de fondo.
- Usa frases cortas y directas.
- Revisa siempre los cambios antes de guardar.
    `,
  },
  {
    id: 'collaboration',
    title: 'Colaboracion en tiempo real',
    icon: '👥',
    content: `
# Colaboracion en tiempo real

## Invitar colaboradores

1. Haz clic en **"Miembros"** en la toolbar.
2. Ingresa el username del colaborador.
3. Asigna un rol:
   - **EDITOR**: puede editar el diagrama.
   - **VIEWER**: solo puede ver.
4. Haz clic en **"Invitar"**.

## Roles

| Rol | Permisos |
|-----|----------|
| OWNER | Control total. Puede eliminar el diagrama. |
| EDITOR | Lee y modifica. |
| VIEWER | Solo lectura. |

## Presencia de usuarios

Los avatares en la toolbar muestran quien esta conectado. Cada
usuario tiene un color asignado.

## Soft-lock

Cuando un usuario esta editando un nodo, los demas ven un borde de
color y el nombre del usuario. Esto evita conflictos.
    `,
  },
  {
    id: 'export',
    title: 'Exportar e importar',
    icon: '📤',
    content: `
# Exportar e importar

## Formatos soportados

- **JSON**: para backup y reimportar en la herramienta.
- **XMI**: estandar UML 2.5, compatible con Enterprise Architect.

## Exportar

1. Haz clic en **"JSON"** o **"XMI"** en la toolbar.
2. El archivo se descarga automaticamente.

## Importar

1. Haz clic en **"Importar"**.
2. Selecciona un archivo \`.json\` o \`.xmi\`.
3. El diagrama se reconstruye en el editor.
    `,
  },
  {
    id: 'generate',
    title: 'Generar backend',
    icon: '⚙️',
    content: `
# Generar backend Spring Boot

## Pasos

1. Disena el diagrama de clases con al menos una entidad con PK.
2. Haz clic en **"Generar"** en la toolbar.
3. Se descarga un ZIP con el proyecto completo.

## Que incluye el ZIP?

- **pom.xml**: dependencias Maven.
- **Entidades JPA** (\`@Entity\`) con relaciones correctas.
- **Repositorios** (\`JpaRepository\`).
- **Servicios** (\`@Service\`) con transacciones.
- **Controladores** (\`@RestController\`) con endpoints CRUD.
- **DTOs** para transferencia de datos.
- **Seguridad JWT**.
- **Migraciones SQL**.

## Como ejecutarlo

1. Descomprime el ZIP.
2. Configura PostgreSQL en \`application.properties\`.
3. Ejecuta: \`mvn spring-boot:run\`.
4. El backend arranca en \`http://localhost:8080\`.
    `,
  },
  {
    id: 'dashboard',
    title: 'Dashboard',
    icon: '🏠',
    content: `
# Dashboard

## Secciones

- **Mis diagramas**: los que creaste como OWNER.
- **Compartidos conmigo**: donde eres EDITOR o VIEWER.

## Acciones

- **Crear**: boton "+ Nuevo diagrama".
- **Buscar**: filtro por nombre en tiempo real.
- **Abrir**: clic en cualquier card.
- **Renombrar**: desde el editor.
- **Eliminar**: desde el editor (solo OWNER).
    `,
  },
  {
    id: 'faq',
    title: 'Preguntas frecuentes',
    icon: '❓',
    content: `
# Preguntas frecuentes

## Puedo usar la herramienta sin internet?

El editor web requiere conexion para la colaboracion en tiempo real.
La app movil generada si funciona offline.

## Que pasa si dos personas mueven el mismo nodo?

El CRDT (Yjs) resuelve el conflicto automaticamente. Ademas, el
soft-lock indica visualmente quien esta editando.

## Puedo importar un diagrama de Enterprise Architect?

Si, a traves del formato XMI. Exporta el diagrama desde Architect
como XMI y luego importalo en esta herramienta.

## Donde se guardan mis diagramas?

En el servidor, como archivos JSON. Se persisten automaticamente
al cerrar el editor.
    `,
  },
];
