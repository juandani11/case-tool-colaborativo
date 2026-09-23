'use client';

import { RelationshipData } from '../types/diagram';

export const typeMap: Record<string, string> = {
  'INHERITANCE': 'inheritance',
  'AGGREGATION': 'aggregation',
  'COMPOSITION': 'composition',
  'ASSOCIATION': 'default',
};

export const reverseTypeMap: Record<string, string> = {
  'inheritance': 'INHERITANCE',
  'aggregation': 'AGGREGATION',
  'composition': 'COMPOSITION',
  'default': 'ASSOCIATION',
};

export function mapRelationshipTypeToReactFlow(type: string): string {
  return typeMap[type] || type.toLowerCase();
}

export function mapReactFlowTypeToRelationship(reactFlowType: string): string {
  return reverseTypeMap[reactFlowType] || reactFlowType.toUpperCase();
}

export function getReactFlowTypeFromRelationship(relationshipType: string | undefined): string {
  if (!relationshipType) return 'default';
  return typeMap[relationshipType] || relationshipType.toLowerCase();
}

export function getRelationshipTypeFromReactFlow(reactFlowType: string | undefined): string {
  if (!reactFlowType) return 'ASSOCIATION';
  return reverseTypeMap[reactFlowType] || reactFlowType.toUpperCase();
}