-- Migration: Ajout de la colonne parent_id à work_lead_type
-- Date: 2026-01-27
-- Description: Permet de créer des sous-catégories de types d'axes de travail (un seul niveau)

ALTER TABLE work_lead_type
ADD COLUMN parent_id UUID REFERENCES work_lead_type(id) ON DELETE SET NULL;

-- Index pour améliorer les performances des requêtes sur la hiérarchie
CREATE INDEX idx_work_lead_type_parent_id ON work_lead_type(parent_id);
