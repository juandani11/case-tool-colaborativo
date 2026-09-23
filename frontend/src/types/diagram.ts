export interface Attribute {
  id: string;
  name: string;
  type: 'String' | 'Integer' | 'UUID' | 'BigDecimal' | 'Date' | 'Boolean' | 'etc';
  isPk: boolean;
  nullable: boolean;
  unique: boolean;
}

export interface MethodParameter {
  name: string;
  type: string;
}

export interface Method {
  id: string;
  name: string;
  returnType: string;
  parameters: MethodParameter[];
  visibility: 'public' | 'private' | 'protected';
}

export interface AssociationOf {
  // Arista * a * conservada (Bloque 2: ya no se elimina al convertir).
  // La arista es la fuente de verdad para tipo y cardinalidades.
  edgeId: string;
  sourceId: string;
  targetId: string;
  // Solo en diagramas de la etapa intermedia (Opción A con arista
  // eliminada): respaldo para sintetizar la relación. Opcionales.
  type?: string;
  cardinalityFrom?: string;
  cardinalityTo?: string;
}

export interface EntityNodeData {
  label: string;
  attributes: Attribute[];
  methods: Method[];
  stereotype: 'class' | 'interface';
  // Marca visual: el nodo es clase asociativa de una relación * a *
  // (sus atributos alimentan la entidad intermedia, no una tabla propia).
  isAssociationClass?: boolean;
  // Respaldo de la arista original (Opción A): permite restaurar la
  // relación * a * al desvincular o borrar el nodo asociativo.
  associationOf?: AssociationOf;
  // Clase abstracta: nombre en cursiva.
  isAbstract?: boolean;
  // Nodo de nota: fondo amarillo, solo texto libre.
  isNote?: boolean;
  // Soft-lock: usuario que está editando este nodo (via awareness).
  lockedBy?: { name: string; color: string; timestamp: number };
}

// Tipos UML 2.5 que el editor ofrece en la UI (con rombo/triángulo)
export type UmlRelationshipType =
  | 'ASSOCIATION'
  | 'AGGREGATION'
  | 'COMPOSITION'
  | 'INHERITANCE';

// Tipos ER heredados (diagramas antiguos / importados). Se dibujan como
// asociación simple; la semántica * a * la resuelve el AST con entidad intermedia.
export type ErRelationshipType =
  | 'ONE_TO_ONE'
  | 'ONE_TO_MANY'
  | 'MANY_TO_ONE'
  | 'MANY_TO_MANY';

export type RelationshipType = UmlRelationshipType | ErRelationshipType;

export interface RelationshipData {
  label?: string;
  type: RelationshipType;
  cardinalityFrom?: string;
  cardinalityTo?: string;
  // Atributos propios de la relación. Si la relación es * a *,
  // se materializan en la entidad intermedia (clase asociativa).
  intermediateAttributes?: Attribute[];
  // Vínculo a clase asociativa: ID del nodo visible cuyos atributos
  // alimentan la entidad intermedia. El nodo es la fuente de verdad
  // (se edita con EntityEditorPanel); el AST lo excluye de `entities`.
  // Legacy (la arista se eliminaba al convertir). Ver associationClassNodeId.
  associationClassId?: string;
  // Modelo vigente (Bloque 2): la arista * a * SE CONSERVA y apunta al nodo.
  // nodesToAST la procesa igual que associationClassId (alias).
  associationClassNodeId?: string;
  // Marca interna de aristas punteadas conectoras (Opción A).
  // nodesToAST/XMI/Sidebar las excluyen: no son relaciones reales.
  isAssociationClassLink?: boolean;
}

// ── AST que se envía al generador de backend ────────────────────────────

export interface AstEntity {
  id: string;
  name: string;
  attributes: Attribute[];
}

export interface AstRelationshipEnd {
  id: string;
  entityName: string;
}

export interface AstRelationship {
  id: string;
  source: AstRelationshipEnd;
  target: AstRelationshipEnd;
  // Aliases planos para compatibilidad con el generador
  fromEntity: string;
  toEntity: string;
  type: RelationshipData['type'];
  cardinalityFrom?: string;
  cardinalityTo?: string;
  foreignKey?: string;
  // Solo presentes cuando la relación es * a *
  intermediateEntity?: string;
  intermediateTable?: string;
  intermediateAttributes?: Attribute[];
  // true cuando la intermedia proviene de una clase asociativa visible
  // (nodo vinculado por associationClassId) en vez de nombre auto-generado.
  isAssociationClass?: boolean;
}