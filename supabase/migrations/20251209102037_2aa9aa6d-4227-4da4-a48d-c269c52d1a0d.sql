-- Ajouter une policy pour permettre l'insertion publique anonyme sur project_contacts
-- Cela permet aux visiteurs des sites générés d'envoyer des messages de contact

CREATE POLICY "Anyone can insert contacts"
ON public.project_contacts
FOR INSERT
TO anon, authenticated
WITH CHECK (true);
